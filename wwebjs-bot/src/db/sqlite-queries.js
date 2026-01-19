const config = require("../config");

function createSqliteQueries(db) {
  const TIME_ZONE = config.TIME_ZONE || "UTC";

  const run = (sql, params = []) => {
    const stmt = db.prepare(sql);
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith("SELECT")) {
      if (upper.includes("LIMIT 1")) {
        return stmt.get(...params);
      }
      return stmt.all(...params);
    }
    const result = stmt.run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes,
    };
  };

  const query = (sql, params = []) => {
    try {
      return Promise.resolve(run(sql, params));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  function initSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'agency',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        whatsapp_group_id TEXT UNIQUE,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        customer_name TEXT,
        items TEXT,
        amount_due REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        quartier TEXT,
        notes TEXT,
        carrier TEXT,
        agency_id INTEGER,
        group_id INTEGER,
        whatsapp_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS delivery_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        actor TEXT DEFAULT 'bot',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email);
      CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id);
      CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
      CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id ON deliveries(whatsapp_message_id);
      CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id);
    `);
  }

  const normalizeDate = (date) => (date ? date : null);

  async function saveHistory({ delivery_id, action, details, actor = "bot" }) {
    const result = await query(
      "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES (?, ?, ?, ?)",
      [delivery_id, action, details, actor]
    );
    return result.lastInsertRowid;
  }

  async function insertDelivery(data) {
    const {
      phone,
      customer_name,
      items,
      amount_due,
      amount_paid = 0,
      status = "pending",
      quartier,
      notes,
      carrier,
      agency_id,
      group_id,
      whatsapp_message_id,
      delivery_fee,
    } = data;

    const result = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, agency_id, group_id, whatsapp_message_id, delivery_fee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        phone,
        customer_name,
        items,
        amount_due || 0,
        amount_paid,
        status,
        quartier,
        notes,
        carrier,
        agency_id || null,
        group_id || null,
        whatsapp_message_id || null,
        delivery_fee !== undefined && delivery_fee !== null ? Math.round(parseFloat(delivery_fee) * 100) / 100 : null,
      ]
    );

    const deliveryId = result.lastInsertRowid;
    await saveHistory({
      delivery_id: deliveryId,
      action: "created",
      details: JSON.stringify(data),
    });
    return deliveryId;
  }

  async function bulkCreateDeliveries(deliveries = []) {
    const inserted = [];
    const failed = [];

    const insertStmt = db.prepare(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const historyStmt = db.prepare(
      "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES (?, ?, ?, ?)"
    );

    const trx = db.transaction((rows) => {
      rows.forEach((row, index) => {
        try {
          const res = insertStmt.run(
            row.phone,
            row.customer_name,
            row.items,
            row.amount_due || 0,
            row.amount_paid || 0,
            row.status || "pending",
            row.quartier,
            row.notes,
            row.carrier
          );
          historyStmt.run(
            res.lastInsertRowid,
            "created",
            JSON.stringify(row),
            row.actor || "bot"
          );
          inserted.push({ index, id: res.lastInsertRowid });
        } catch (error) {
          failed.push({ index, error: error.message });
        }
      });
    });

    trx(deliveries);

    return { inserted, failed };
  }

  async function updateDelivery(id, updates = {}) {
    const allowedFields = [
      "phone",
      "customer_name",
      "items",
      "amount_due",
      "amount_paid",
      "status",
      "quartier",
      "notes",
      "carrier",
      "agency_id",
      "group_id",
      "whatsapp_message_id",
      "delivery_fee",
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        throw new Error(
          `Invalid field name: ${key}. Allowed fields: ${allowedFields.join(", ")}`
        );
      }
      
      // Round amount fields to 2 decimal places to ensure exact values
      let processedValue = value;
      if ((key === "amount_due" || key === "amount_paid" || key === "delivery_fee") && value != null) {
        processedValue = Math.round(parseFloat(value) * 100) / 100;
      }
      
      fields.push(`${key} = ?`);
      values.push(processedValue);
    }

    if (!fields.length) {
      throw new Error("No valid fields to update");
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const sql = `UPDATE deliveries SET ${fields.join(", ")} WHERE id = ?`;
    return query(sql, values);
  }

  async function findDeliveryByPhone(phone, status = null) {
    let sql = "SELECT * FROM deliveries WHERE phone = ?";
    const params = [phone];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    } else {
      sql += " AND status NOT IN ('delivered', 'failed', 'cancelled')";
    }

    sql += " ORDER BY created_at DESC LIMIT 1";
    return query(sql, params);
  }

  async function findDeliveryByPhoneForUpdate(phone) {
    return query(
      "SELECT * FROM deliveries WHERE phone = ? ORDER BY created_at DESC LIMIT 1",
      [phone]
    );
  }

  async function findDeliveryByMessageId(whatsappMessageId) {
    return query(
      "SELECT * FROM deliveries WHERE whatsapp_message_id = ? ORDER BY created_at DESC LIMIT 1",
      [whatsappMessageId]
    );
  }

  async function updateDeliveryByMessageId(whatsappMessageId, updates = {}) {
    // First find the delivery by message ID
    const delivery = await findDeliveryByMessageId(whatsappMessageId);
    
    if (!delivery) {
      throw new Error(`Delivery not found with whatsapp_message_id: ${whatsappMessageId}`);
    }

    // Use the existing updateDelivery function with the found ID
    return await updateDelivery(delivery.id, updates);
  }

  async function getTodayDeliveries() {
    return query(
      `SELECT * FROM deliveries 
       WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
       ORDER BY created_at DESC`
    );
  }

  async function getDeliveryById(id) {
    return query("SELECT * FROM deliveries WHERE id = ? LIMIT 1", [id]);
  }

  async function getDeliveryHistory(deliveryId) {
    return query(
      "SELECT * FROM delivery_history WHERE delivery_id = ? ORDER BY created_at DESC",
      [deliveryId]
    );
  }

  async function getDeliveries(options = {}) {
    const {
      page = 1,
      limit = 50,
      status = null,
      date = null,
      phone = null,
      startDate = null,
      endDate = null,
      sortBy = "created_at",
      sortOrder = "DESC",
      agency_id = null,
      group_id = null,
    } = options;

    const normalizedDate = normalizeDate(date);
    const normalizedStartDate = normalizeDate(startDate);
    const normalizedEndDate = normalizeDate(endDate);

    const allowedSortFields = [
      "id",
      "phone",
      "created_at",
      "updated_at",
      "status",
      "amount_due",
      "amount_paid",
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "created_at";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (normalizedDate) {
      conditions.push(`DATE(created_at, 'localtime') = DATE(?, 'localtime')`);
      params.push(normalizedDate);
    }

    if (normalizedStartDate && normalizedEndDate) {
      conditions.push(
        `DATE(created_at, 'localtime') >= DATE(?, 'localtime') AND DATE(created_at, 'localtime') <= DATE(?, 'localtime')`
      );
      params.push(normalizedStartDate, normalizedEndDate);
    }

    if (phone) {
      conditions.push("phone LIKE ?");
      params.push(`%${phone}%`);
    }

    if (agency_id !== null) {
      conditions.push("agency_id = ?");
      params.push(agency_id);
    }

    if (group_id !== null) {
      conditions.push("group_id = ?");
      params.push(group_id);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) as total FROM deliveries ${whereClause}`;
    const dataSql = `SELECT * FROM deliveries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;

    const totalResult = await query(countSql, params);
    const total = Array.isArray(totalResult)
      ? totalResult[0]?.total || 0
      : totalResult?.total || 0;

    const deliveries = await query(dataSql, [...params, limit, offset]);

    return {
      deliveries: Array.isArray(deliveries)
        ? deliveries
        : [deliveries].filter(Boolean),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getDailyStats(date = null, agency_id = null, group_id = null) {
    const normalizedDate = normalizeDate(date);
    let sql;
    let params = [];
    const conditions = [];

    // Date condition
    if (normalizedDate) {
      conditions.push(`DATE(created_at, 'localtime') = DATE(?, 'localtime')`);
      params.push(normalizedDate);
    } else {
      conditions.push(`DATE(created_at, 'localtime') = DATE('now', 'localtime')`);
    }

    // Agency filter
    if (agency_id !== null) {
      conditions.push(`agency_id = ?`);
      params.push(agency_id);
    }

    // Group filter
    if (group_id !== null) {
      conditions.push(`group_id = ?`);
      params.push(group_id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    sql = `
      SELECT 
        COUNT(*) as total,
        IFNULL(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered,
        IFNULL(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
        IFNULL(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
        IFNULL(SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END), 0) as pickup,
        IFNULL(SUM(amount_paid), 0) as total_collected,
        IFNULL(SUM(amount_due - amount_paid), 0) as total_remaining,
        IFNULL(SUM(amount_due), 0) as total_due
      FROM deliveries
      ${whereClause}
    `;

    const result = await query(sql, params);
    const stats = Array.isArray(result) ? result[0] : result;

    return {
      total: Number(stats?.total) || 0,
      delivered: Number(stats?.delivered) || 0,
      failed: Number(stats?.failed) || 0,
      pending: Number(stats?.pending) || 0,
      pickup: Number(stats?.pickup) || 0,
      total_collected: Number(stats?.total_collected) || 0,
      total_remaining: Number(stats?.total_remaining) || 0,
      total_due: Number(stats?.total_due) || 0,
    };
  }

  async function searchDeliveries(term) {
    if (!term || !term.trim()) return [];
    const searchTerm = `%${term.trim()}%`;
    const results = await query(
      `SELECT * FROM deliveries 
       WHERE phone LIKE ? 
       OR items LIKE ? 
       OR customer_name LIKE ? 
       OR quartier LIKE ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );
    // Ensure we always return an array
    return Array.isArray(results) ? results : results ? [results] : [];
  }

  // ============================================
  // Agency Queries
  // ============================================

  async function createAgency({
    name,
    email,
    password_hash,
    role = "agency",
    is_active = 1,
    agency_code = null,
  }) {
    // Ensure is_active is a number (1 or 0) for SQLite
    const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
    
    // Normalize agency_code: trim and uppercase if provided
    const normalizedCode = agency_code ? agency_code.trim().toUpperCase() : null;
    
    const result = await query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active, agency_code) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, password_hash, role, isActiveValue, normalizedCode]
    );
    return result.lastInsertRowid;
  }

  async function getAgencyById(id) {
    return await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE id = ? LIMIT 1`,
      [id]
    );
  }

  async function getAgencyByEmail(email) {
    return await query(
      `SELECT id, name, email, password_hash, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE email = ? LIMIT 1`,
      [email]
    );
  }

  async function findAgencyByCode(code) {
    // Case-insensitive search for agency code
    // Normalize code: trim and uppercase
    const normalizedCode = (code || "").trim().toUpperCase();
    
    if (!normalizedCode || normalizedCode.length < 4) {
      return null;
    }

    return await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE UPPER(TRIM(agency_code)) = ? AND is_active = 1 
       LIMIT 1`,
      [normalizedCode]
    );
  }

  async function getAllAgencies() {
    // Only return active agencies (is_active = 1)
    return await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE is_active = 1
       ORDER BY created_at DESC`
    );
  }

  async function updateAgency(
    id,
    { name, email, password_hash, role, is_active, agency_code, address, phone, logo_base64 }
  ) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }
    if (password_hash !== undefined) {
      updates.push("password_hash = ?");
      params.push(password_hash);
    }
    if (role !== undefined) {
      updates.push("role = ?");
      params.push(role);
    }
    if (is_active !== undefined) {
      // Ensure is_active is a number (1 or 0) for SQLite
      const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
      updates.push("is_active = ?");
      params.push(isActiveValue);
    }
    if (agency_code !== undefined) {
      // Normalize agency_code: trim and uppercase if provided, null if empty
      const normalizedCode = agency_code && typeof agency_code === 'string' && agency_code.trim() 
        ? agency_code.trim().toUpperCase() 
        : null;
      console.log(`[SQLite UpdateAgency] agency_code received:`, agency_code, "normalized to:", normalizedCode);
      updates.push("agency_code = ?");
      params.push(normalizedCode);
    } else {
      console.log(`[SQLite UpdateAgency] agency_code is undefined, not updating`);
    }
    if (address !== undefined) {
      updates.push("address = ?");
      params.push(address);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      params.push(phone);
    }
    if (logo_base64 !== undefined) {
      updates.push("logo_base64 = ?");
      params.push(logo_base64);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const sql = `UPDATE agencies SET ${updates.join(", ")} WHERE id = ?`;
    console.log(`[SQLite UpdateAgency] Executing SQL:`, sql);
    console.log(`[SQLite UpdateAgency] Params:`, params);
    
    try {
      const result = await query(sql, params);
      console.log(`[SQLite UpdateAgency] Update result:`, result);
      return result;
    } catch (error) {
      console.error(`[SQLite UpdateAgency] Error executing update:`, error.message);
      console.error(`[SQLite UpdateAgency] SQL was:`, sql);
      console.error(`[SQLite UpdateAgency] Params were:`, params);
      throw error;
    }
  }

  async function deleteAgency(id) {
    // Soft delete: set is_active = 0
    return await updateAgency(id, { is_active: 0 });
  }

  // ============================================
  // Group Queries
  // ============================================

  async function createGroup({
    agency_id,
    whatsapp_group_id,
    name,
    is_active = 1,
  }) {
    // Ensure is_active is a number (1 or 0) for SQLite
    const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
    
    const result = await query(
      `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active) 
       VALUES (?, ?, ?, ?)`,
      [agency_id, whatsapp_group_id, name, isActiveValue]
    );
    return result.lastInsertRowid;
  }

  async function getGroupById(id) {
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       WHERE g.id = ? LIMIT 1`,
      [id]
    );
  }

  async function getGroupsByAgency(agency_id, includeInactive = false) {
    const whereClause = includeInactive 
      ? 'WHERE g.agency_id = ?'
      : 'WHERE g.agency_id = ? AND g.is_active = 1';
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       ${whereClause}
       ORDER BY g.created_at DESC`,
      [agency_id]
    );
  }

  async function getAllGroups(includeInactive = false) {
    const whereClause = includeInactive ? '' : 'WHERE g.is_active = 1';
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       ${whereClause}
       ORDER BY g.created_at DESC`
    );
  }

  async function updateGroup(id, { name, is_active }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (is_active !== undefined) {
      // Ensure is_active is a number (1 or 0) for SQLite
      const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
      updates.push("is_active = ?");
      params.push(isActiveValue);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const sql = `UPDATE groups SET ${updates.join(", ")} WHERE id = ?`;
    console.log(`[SQLite updateGroup] Executing SQL: ${sql}`);
    console.log(`[SQLite updateGroup] Parameters:`, params);
    console.log(`[SQLite updateGroup] This is an UPDATE query, NOT a DELETE`);
    
    const result = await query(sql, params);
    
    console.log(`[SQLite updateGroup] Query result:`, result);
    console.log(`[SQLite updateGroup] Changes: ${result?.changes || 0}`);
    
    return result;
  }

  async function deleteGroup(id) {
    // Soft delete: set is_active = 0
    return await updateGroup(id, { is_active: 0 });
  }

  async function hardDeleteGroup(id) {
    // Hard delete: permanently remove from database
    const result = await query(`DELETE FROM groups WHERE id = ?`, [id]);
    return result;
  }

  // ============================================
  // Tariff Queries
  // ============================================

  async function createTariff({
    agency_id,
    quartier,
    tarif_amount,
  }) {
    const result = await query(
      `INSERT INTO tariffs (agency_id, quartier, tarif_amount) 
       VALUES (?, ?, ?)`,
      [agency_id, quartier, parseFloat(tarif_amount) || 0]
    );
    return result.lastInsertRowid;
  }

  async function getTariffById(id) {
    return await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at,
              a.name as agency_name
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
  }

  async function getTariffByAgencyAndQuartier(agency_id, quartier) {
    return await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at
       FROM tariffs t
       WHERE t.agency_id = ? AND t.quartier = ? LIMIT 1`,
      [agency_id, quartier]
    );
  }

  async function getTariffsByAgency(agency_id) {
    return await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at,
              a.name as agency_name
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       WHERE t.agency_id = ?
       ORDER BY t.quartier ASC`,
      [agency_id]
    );
  }

  async function getAllTariffs() {
    return await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at,
              a.name as agency_name
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       ORDER BY a.name ASC, t.quartier ASC`
    );
  }

  async function updateTariff(
    id,
    { agency_id, quartier, tarif_amount }
  ) {
    const updates = [];
    const params = [];

    if (agency_id !== undefined) {
      updates.push(`agency_id = ?`);
      params.push(agency_id);
    }
    if (quartier !== undefined) {
      updates.push(`quartier = ?`);
      params.push(quartier);
    }
    if (tarif_amount !== undefined) {
      updates.push(`tarif_amount = ?`);
      params.push(parseFloat(tarif_amount) || 0);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE tariffs SET ${updates.join(", ")} WHERE id = ?`;
    return await query(sql, params);
  }

  async function deleteTariff(id) {
    return await query(
      `DELETE FROM tariffs WHERE id = ?`,
      [id]
    );
  }

  async function deleteDelivery(id) {
    // Delete history first to avoid FK constraint issues (and keep behavior consistent with Postgres)
    await query("DELETE FROM delivery_history WHERE delivery_id = ?", [id]);
    return await query("DELETE FROM deliveries WHERE id = ?", [id]);
  }

  return {
    type: "sqlite",
    initSchema,
    query,
    insertDelivery,
    bulkCreateDeliveries,
    updateDelivery,
    findDeliveryByPhone,
    findDeliveryByPhoneForUpdate,
    findDeliveryByMessageId,
    getDeliveryById,
    getDeliveryHistory,
    getTodayDeliveries,
    getDeliveries,
    getDailyStats,
    searchDeliveries,
    saveHistory,
    deleteDelivery,
    // Agency queries
    createAgency,
    getAgencyById,
    getAgencyByEmail,
    findAgencyByCode,
    getAllAgencies,
    updateAgency,
    deleteAgency,
    // Group queries
    createGroup,
    getGroupById,
    getGroupsByAgency,
    getAllGroups,
    updateGroup,
    deleteGroup,
    hardDeleteGroup,
    // Tariff queries
    createTariff,
    getTariffById,
    getTariffByAgencyAndQuartier,
    getTariffsByAgency,
    getAllTariffs,
    updateTariff,
    deleteTariff,
    close: async () => db.close(),
    getRawDb: () => db,
    TIME_ZONE,
  };
}

module.exports = createSqliteQueries;
