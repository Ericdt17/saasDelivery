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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
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
    } = data;

    const result = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, agency_id, group_id, whatsapp_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        throw new Error(
          `Invalid field name: ${key}. Allowed fields: ${allowedFields.join(", ")}`
        );
      }
      fields.push(`${key} = ?`);
      values.push(value);
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
  }) {
    // Ensure is_active is a number (1 or 0) for SQLite
    const isActiveValue = is_active === true || is_active === 1 ? 1 : 0;
    
    const result = await query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, password_hash, role, isActiveValue]
    );
    return result.lastInsertRowid;
  }

  async function getAgencyById(id) {
    return await query(
      `SELECT id, name, email, role, is_active, created_at, updated_at 
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

  async function getAllAgencies() {
    return await query(
      `SELECT id, name, email, role, is_active, created_at, updated_at 
       FROM agencies 
       ORDER BY created_at DESC`
    );
  }

  async function updateAgency(
    id,
    { name, email, password_hash, role, is_active }
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

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const result = await query(
      `UPDATE agencies SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
    return result;
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

  async function getGroupsByAgency(agency_id) {
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       WHERE g.agency_id = ?
       ORDER BY g.created_at DESC`,
      [agency_id]
    );
  }

  async function getAllGroups() {
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
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

    const result = await query(
      `UPDATE groups SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
    return result;
  }

  async function deleteGroup(id) {
    // Soft delete: set is_active = 0
    return await updateGroup(id, { is_active: 0 });
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
    // Agency queries
    createAgency,
    getAgencyById,
    getAgencyByEmail,
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
    close: async () => db.close(),
    getRawDb: () => db,
    TIME_ZONE,
  };
}

module.exports = createSqliteQueries;
