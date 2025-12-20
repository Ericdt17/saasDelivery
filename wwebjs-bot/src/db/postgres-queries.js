const config = require("../config");

function createPostgresQueries(pool) {
  const TIME_ZONE = config.TIME_ZONE || "UTC";

  const convertPlaceholders = (sql, params) => {
    if (!sql.includes("?")) {
      return { sql, params };
    }
    let index = 0;
    const convertedSql = sql.replace(/\?/g, () => `$${++index}`);
    return { sql: convertedSql, params };
  };

  const normalizeDateFunctions = (sql) => {
    let converted = sql;
    converted = converted.replace(
      /DATE\(created_at,\s*'localtime'\)/gi,
      `(created_at AT TIME ZONE '${TIME_ZONE}')::date`
    );
    converted = converted.replace(
      /DATE\('now',\s*'localtime'\)/gi,
      "CURRENT_DATE"
    );
    converted = converted.replace(/DATE\(created_at\)/gi, "created_at::date");
    return converted;
  };

  const query = async (sql, params = []) => {
    const convertedSql = normalizeDateFunctions(sql);
    const { sql: finalSql, params: finalParams } = convertPlaceholders(
      convertedSql,
      params
    );
    const result = await pool.query(finalSql, finalParams);

    if (finalSql.trim().toUpperCase().startsWith("SELECT")) {
      if (finalSql.toUpperCase().includes("LIMIT 1")) {
        return result.rows[0] || null;
      }
      return result.rows;
    }

    if (result.rows && result.rows.length && result.rows[0].id) {
      return {
        id: result.rows[0].id,
        lastInsertRowid: result.rows[0].id,
        changes: result.rowCount || 0,
      };
    }

    return {
      lastInsertRowid: null,
      changes: result.rowCount || 0,
    };
  };

  async function saveHistory({ delivery_id, action, details, actor = "bot" }) {
    const res = await query(
      "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES ($1, $2, $3, $4) RETURNING id",
      [delivery_id, action, details, actor]
    );
    return res.id;
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

    const res = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, agency_id, group_id, whatsapp_message_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
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

    const deliveryId = res.id || res[0]?.id || res.lastInsertRowid;
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
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      for (let i = 0; i < deliveries.length; i++) {
        const row = deliveries[i];
        try {
          const res = await client.query(
            `INSERT INTO deliveries 
              (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id`,
            [
              row.phone,
              row.customer_name,
              row.items,
              row.amount_due || 0,
              row.amount_paid || 0,
              row.status || "pending",
              row.quartier,
              row.notes,
              row.carrier,
            ]
          );
          const deliveryId = res.rows[0].id;
          await client.query(
            "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES ($1, $2, $3, $4)",
            [deliveryId, "created", JSON.stringify(row), row.actor || "bot"]
          );
          inserted.push({ index: i, id: deliveryId });
        } catch (error) {
          failed.push({ index: i, error: error.message });
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

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
      
      fields.push(`${key} = $${values.length + 1}`);
      values.push(processedValue);
    }

    if (!fields.length) {
      throw new Error("No valid fields to update");
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE deliveries SET ${fields.join(", ")} WHERE id = $${
      values.length
    }`;
    return query(sql, values);
  }

  async function findDeliveryByPhone(phone, status = null) {
    const params = [phone];
    let sql = "SELECT * FROM deliveries WHERE phone = $1";

    if (status) {
      sql += " AND status = $2";
      params.push(status);
    } else {
      sql += " AND status NOT IN ('delivered', 'failed', 'cancelled')";
    }

    sql += " ORDER BY created_at DESC LIMIT 1";
    return query(sql, params);
  }

  async function findDeliveryByPhoneForUpdate(phone) {
    return query(
      "SELECT * FROM deliveries WHERE phone = $1 ORDER BY created_at DESC LIMIT 1",
      [phone]
    );
  }

  async function findDeliveryByMessageId(whatsappMessageId) {
    return query(
      "SELECT * FROM deliveries WHERE whatsapp_message_id = $1 ORDER BY created_at DESC LIMIT 1",
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
    const tzExpr = `created_at AT TIME ZONE '${TIME_ZONE}'`;
    return query(
      `SELECT * FROM deliveries 
       WHERE (${tzExpr})::date = CURRENT_DATE
       ORDER BY created_at DESC`
    );
  }

  async function getDeliveryById(id) {
    return query("SELECT * FROM deliveries WHERE id = $1 LIMIT 1", [id]);
  }

  async function getDeliveryHistory(deliveryId) {
    return query(
      "SELECT * FROM delivery_history WHERE delivery_id = $1 ORDER BY created_at DESC",
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
    const tzExpr = `created_at AT TIME ZONE '${TIME_ZONE}'`;

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (status) {
      conditions.push(`status = ${addParam(status)}`);
    }

    if (date) {
      conditions.push(`(${tzExpr})::date = ${addParam(date)}::date`);
    }

    if (startDate && endDate) {
      conditions.push(
        `(${tzExpr})::date >= ${addParam(startDate)}::date AND (${tzExpr})::date <= ${addParam(endDate)}::date`
      );
    }

    if (phone) {
      conditions.push(`phone LIKE ${addParam(`%${phone}%`)}`);
    }

    if (agency_id !== null) {
      conditions.push(`agency_id = ${addParam(agency_id)}`);
    }

    if (group_id !== null) {
      conditions.push(`group_id = ${addParam(group_id)}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) as total FROM deliveries ${whereClause}`;
    const dataSql = `SELECT * FROM deliveries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${addParam(
      limit
    )} OFFSET ${addParam(offset)}`;

    const countResult = await query(
      countSql,
      params.slice(0, params.length - 2)
    );
    const total = Array.isArray(countResult)
      ? countResult[0]?.total || 0
      : countResult?.total || 0;

    const deliveries = await query(dataSql, params);

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
    const tzExpr = `created_at AT TIME ZONE '${TIME_ZONE}'`;
    let sql;
    let params = [];
    const conditions = [];
    let paramIndex = 1;

    const addParam = (value) => {
      params.push(value);
      return `$${paramIndex++}`;
    };

    // Date condition
    if (date) {
      conditions.push(`(${tzExpr})::date = ${addParam(date)}::date`);
    } else {
      conditions.push(`(${tzExpr})::date = CURRENT_DATE`);
    }

    // Agency filter
    if (agency_id !== null) {
      conditions.push(`agency_id = ${addParam(agency_id)}`);
    }

    // Group filter
    if (group_id !== null) {
      conditions.push(`group_id = ${addParam(group_id)}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    sql = `
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END), 0) as pickup,
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COALESCE(SUM(amount_due - amount_paid), 0) as total_remaining,
        COALESCE(SUM(amount_due), 0) as total_due
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
    return query(
      `SELECT * FROM deliveries 
       WHERE phone ILIKE $1 
       OR items ILIKE $1 
       OR customer_name ILIKE $1 
       OR quartier ILIKE $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [searchTerm]
    );
  }

  // ============================================
  // Agency Queries
  // ============================================

  async function createAgency({
    name,
    email,
    password_hash,
    role = "agency",
    is_active = true,
    agency_code = null,
  }) {
    // Normalize agency_code: trim and uppercase if provided
    const normalizedCode = agency_code ? agency_code.trim().toUpperCase() : null;
    
    const result = await query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active, agency_code) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, email, password_hash, role, is_active, normalizedCode]
    );
    return result.id || result[0]?.id;
  }

  async function getAgencyById(id) {
    const result = await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result;
  }

  async function getAgencyByEmail(email) {
    const result = await query(
      `SELECT id, name, email, password_hash, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE email = $1 LIMIT 1`,
      [email]
    );
    // query() already returns result.rows[0] || null for LIMIT 1 queries
    return result;
  }

  async function findAgencyByCode(code) {
    // Case-insensitive search for agency code
    // Normalize code: trim and uppercase
    const normalizedCode = (code || "").trim().toUpperCase();
    
    if (!normalizedCode || normalizedCode.length < 4) {
      return null;
    }

    const result = await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE UPPER(TRIM(agency_code)) = $1 AND is_active = true 
       LIMIT 1`,
      [normalizedCode]
    );
    
    return result;
  }

  async function getAllAgencies() {
    // Only return active agencies (is_active = true)
    return await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64, created_at, updated_at 
       FROM agencies 
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
  }

  async function updateAgency(
    id,
    { name, email, password_hash, role, is_active, agency_code, address, phone, logo_base64 }
  ) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (password_hash !== undefined) {
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(password_hash);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }
    if (agency_code !== undefined) {
      // Normalize agency_code: trim and uppercase if provided, null if empty
      const normalizedCode = agency_code && typeof agency_code === 'string' && agency_code.trim() 
        ? agency_code.trim().toUpperCase() 
        : null;
      console.log(`[Postgres UpdateAgency] agency_code received:`, agency_code, "normalized to:", normalizedCode);
      updates.push(`agency_code = $${paramIndex++}`);
      params.push(normalizedCode);
    } else {
      console.log(`[Postgres UpdateAgency] agency_code is undefined, not updating`);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (logo_base64 !== undefined) {
      updates.push(`logo_base64 = $${paramIndex++}`);
      params.push(logo_base64);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE agencies SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
    console.log(`[Postgres UpdateAgency] Executing SQL:`, sql);
    console.log(`[Postgres UpdateAgency] Params:`, params);
    
    try {
      const result = await query(sql, params);
      console.log(`[Postgres UpdateAgency] Update result:`, result);
      return { changes: result.changes || 0 };
    } catch (error) {
      console.error(`[Postgres UpdateAgency] Error executing update:`, error.message);
      console.error(`[Postgres UpdateAgency] SQL was:`, sql);
      console.error(`[Postgres UpdateAgency] Params were:`, params);
      throw error;
    }
  }

  async function deleteAgency(id) {
    // Soft delete: set is_active = false
    return await updateAgency(id, { is_active: false });
  }

  // ============================================
  // Group Queries
  // ============================================

  async function createGroup({
    agency_id,
    whatsapp_group_id,
    name,
    is_active = true,
  }) {
    const result = await query(
      `INSERT INTO groups (agency_id, whatsapp_group_id, name, is_active) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [agency_id, whatsapp_group_id, name, is_active]
    );
    return result.id || result[0]?.id;
  }

  async function getGroupById(id) {
    const result = await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active, 
              g.created_at, g.updated_at,
              a.name as agency_name
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       WHERE g.id = $1 LIMIT 1`,
      [id]
    );
    return result;
  }

  async function getGroupsByAgency(agency_id, includeInactive = false) {
    const whereClause = includeInactive 
      ? 'WHERE g.agency_id = $1'
      : 'WHERE g.agency_id = $1 AND g.is_active = true';
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
    const whereClause = includeInactive ? '' : 'WHERE g.is_active = true';
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
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE groups SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );
    return { changes: result.changes || 0 };
  }

  async function deleteGroup(id) {
    // Soft delete: set is_active = false
    return await updateGroup(id, { is_active: false });
  }

  async function hardDeleteGroup(id) {
    // Hard delete: permanently remove from database
    const result = await query(`DELETE FROM groups WHERE id = $1`, [id]);
    return { changes: result.changes || 0 };
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
       VALUES ($1, $2, $3) RETURNING id`,
      [agency_id, quartier, parseFloat(tarif_amount) || 0]
    );
    return result.id || result[0]?.id;
  }

  async function getTariffById(id) {
    const result = await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at,
              a.name as agency_name
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       WHERE t.id = $1 LIMIT 1`,
      [id]
    );
    return result;
  }

  async function getTariffByAgencyAndQuartier(agency_id, quartier) {
    const result = await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at
       FROM tariffs t
       WHERE t.agency_id = $1 AND t.quartier = $2 LIMIT 1`,
      [agency_id, quartier]
    );
    return result;
  }

  async function getTariffsByAgency(agency_id) {
    return await query(
      `SELECT t.id, t.agency_id, t.quartier, t.tarif_amount, 
              t.created_at, t.updated_at,
              a.name as agency_name
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       WHERE t.agency_id = $1
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
    let paramIndex = 1;

    if (agency_id !== undefined) {
      updates.push(`agency_id = $${paramIndex++}`);
      params.push(agency_id);
    }
    if (quartier !== undefined) {
      updates.push(`quartier = $${paramIndex++}`);
      params.push(quartier);
    }
    if (tarif_amount !== undefined) {
      updates.push(`tarif_amount = $${paramIndex++}`);
      params.push(parseFloat(tarif_amount) || 0);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE tariffs SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
    const result = await query(sql, params);

    return { changes: result.changes || 0 };
  }

  async function deleteTariff(id) {
    const result = await query(
      `DELETE FROM tariffs WHERE id = $1`,
      [id]
    );

    return { changes: result.changes || 0 };
  }

  return {
    type: "postgres",
    query,
    insertDelivery,
    bulkCreateDeliveries,
    updateDelivery,
    updateDeliveryByMessageId,
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
    close: async () => pool.end(),
    getRawDb: () => pool,
    TIME_ZONE,
  };
}

module.exports = createPostgresQueries;
