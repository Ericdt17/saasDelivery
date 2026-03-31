const config = require("../config");
const logger = require("../logger");

const RETRYABLE_ERRORS = [
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
  "connection timeout",
  "ECONNRESET",
  "EPIPE",
];

const isRetryable = (err) =>
  RETRYABLE_ERRORS.some((msg) => err?.message?.includes(msg));

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

  const query = async (sql, params = [], { retries = 3 } = {}) => {
    const convertedSql = normalizeDateFunctions(sql);
    const { sql: finalSql, params: finalParams } = convertPlaceholders(
      convertedSql,
      params
    );

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
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
      } catch (err) {
        lastErr = err;
        if (attempt < retries && isRetryable(err)) {
          logger.warn(
            { err, attempt, sql: finalSql.slice(0, 120) },
            "Transient DB connection error — retrying"
          );
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
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
      delivery_fee,
      agency_id,
      group_id,
      whatsapp_message_id,
      tariff_pending,
    } = data;

    // Round amount fields to 2 decimal places to ensure exact values
    const roundedAmountDue = amount_due != null ? Math.round(parseFloat(amount_due) * 100) / 100 : 0;
    const roundedAmountPaid = amount_paid != null ? Math.round(parseFloat(amount_paid) * 100) / 100 : 0;

    const hasQuartier = quartier != null && String(quartier).trim() !== "";
    const fee = delivery_fee != null ? parseFloat(delivery_fee) : NaN;
    const computedTariffPending =
      status === "pending" && hasQuartier && (!Number.isFinite(fee) || fee <= 0);
    const finalTariffPending =
      tariff_pending === undefined || tariff_pending === null
        ? computedTariffPending
        : Boolean(tariff_pending);

    const res = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, delivery_fee, agency_id, group_id, whatsapp_message_id, tariff_pending)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
      [
        phone,
        customer_name,
        items,
        roundedAmountDue,
        roundedAmountPaid,
        status,
        quartier,
        notes,
        carrier,
        Number.isFinite(fee) ? fee : null,
        agency_id || null,
        group_id || null,
        whatsapp_message_id || null,
        finalTariffPending,
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
          // Round amount fields to 2 decimal places to ensure exact values
          const roundedAmountDue = row.amount_due != null ? Math.round(parseFloat(row.amount_due) * 100) / 100 : 0;
          const roundedAmountPaid = row.amount_paid != null ? Math.round(parseFloat(row.amount_paid) * 100) / 100 : 0;
          const status = row.status || "pending";
          const hasQuartier = row.quartier != null && String(row.quartier).trim() !== "";
          const fee = row.delivery_fee != null ? parseFloat(row.delivery_fee) : NaN;
          const tariffPending =
            status === "pending" && hasQuartier && (!Number.isFinite(fee) || fee <= 0);
          
          const res = await client.query(
            `INSERT INTO deliveries 
              (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier, delivery_fee, tariff_pending)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              RETURNING id`,
            [
              row.phone,
              row.customer_name,
              row.items,
              roundedAmountDue,
              roundedAmountPaid,
              status,
              row.quartier,
              row.notes,
              row.carrier,
              Number.isFinite(fee) ? fee : null,
              tariffPending,
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
      "tariff_pending",
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
      if (key === "tariff_pending") {
        processedValue = Boolean(value);
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

  async function deleteDelivery(id) {
    // Hard delete: removes delivery and its history (CASCADE)
    const result = await query(
      `DELETE FROM deliveries WHERE id = $1`,
      [id]
    );
    return { changes: result.changes || 0 };
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
      "group_id",
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

  async function createExpedition({
    agency_id,
    group_id,
    destination,
    agence_de_voyage,
    frais_de_course = 0,
    frais_de_lagence_de_voyage = 0,
    status = "en_attente",
    notes = null,
  }) {
    const res = await query(
      `INSERT INTO expeditions
        (agency_id, group_id, destination, agence_de_voyage, frais_de_course, frais_de_lagence_de_voyage, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        agency_id,
        group_id,
        destination,
        agence_de_voyage,
        Math.round(parseFloat(frais_de_course || 0) * 100) / 100,
        Math.round(parseFloat(frais_de_lagence_de_voyage || 0) * 100) / 100,
        status,
        notes,
      ]
    );
    return res.id || res[0]?.id;
  }

  async function getExpeditionById(id) {
    return query(
      `SELECT e.*, g.name as group_name
       FROM expeditions e
       LEFT JOIN groups g ON g.id = e.group_id
       WHERE e.id = $1
       LIMIT 1`,
      [id]
    );
  }

  async function getExpeditions({
    page = 1,
    limit = 50,
    startDate = null,
    endDate = null,
    status = null,
    group_id = null,
    agency_id = null,
    search = null,
    sortBy = "created_at",
    sortOrder = "DESC",
  } = {}) {
    const validSortBy = ["created_at", "updated_at", "destination", "agence_de_voyage", "status"];
    const validSortOrder = ["ASC", "DESC"];
    const safeSortBy = validSortBy.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = validSortOrder.includes(String(sortOrder).toUpperCase())
      ? String(sortOrder).toUpperCase()
      : "DESC";

    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    const addParam = (value) => {
      params.push(value);
      return `$${paramIndex++}`;
    };

    if (startDate) {
      conditions.push(`e.created_at::date >= ${addParam(startDate)}::date`);
    }
    if (endDate) {
      conditions.push(`e.created_at::date <= ${addParam(endDate)}::date`);
    }
    if (status) {
      conditions.push(`e.status = ${addParam(status)}`);
    }
    if (group_id !== null && group_id !== undefined) {
      conditions.push(`e.group_id = ${addParam(group_id)}`);
    }
    if (agency_id !== null && agency_id !== undefined) {
      conditions.push(`e.agency_id = ${addParam(agency_id)}`);
    }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      const p = addParam(term);
      conditions.push(`(e.destination ILIKE ${p} OR e.agence_de_voyage ILIKE ${p} OR g.name ILIKE ${p})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countSql = `
      SELECT COUNT(*) as total
      FROM expeditions e
      LEFT JOIN groups g ON g.id = e.group_id
      ${whereClause}
    `;
    const totalResult = await query(countSql, params);
    const total = Number(Array.isArray(totalResult) ? totalResult[0]?.total : totalResult?.total) || 0;

    const dataSql = `
      SELECT e.*, g.name as group_name
      FROM expeditions e
      LEFT JOIN groups g ON g.id = e.group_id
      ${whereClause}
      ORDER BY e.${safeSortBy} ${safeSortOrder}
      LIMIT ${addParam(Number(limit))}
      OFFSET ${addParam(offset)}
    `;
    const rows = await query(dataSql, params);

    return {
      expeditions: Array.isArray(rows) ? rows : [rows].filter(Boolean),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        totalPages: Math.ceil(Number(total) / Number(limit || 1)),
      },
    };
  }

  async function updateExpedition(id, updates = {}) {
    const allowedFields = [
      "group_id",
      "destination",
      "agence_de_voyage",
      "frais_de_course",
      "frais_de_lagence_de_voyage",
      "status",
      "notes",
    ];

    const fields = [];
    const values = [];

    for (const [key, rawValue] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        continue;
      }
      let value = rawValue;
      if ((key === "frais_de_course" || key === "frais_de_lagence_de_voyage") && value != null) {
        value = Math.round(parseFloat(value) * 100) / 100;
      }
      fields.push(`${key} = $${fields.length + 1}`);
      values.push(value);
    }

    if (fields.length === 0) {
      return { changes: 0 };
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    return query(
      `UPDATE expeditions SET ${fields.join(", ")} WHERE id = $${values.length}`,
      values
    );
  }

  async function deleteExpedition(id) {
    return query("DELETE FROM expeditions WHERE id = $1", [id]);
  }

  async function getExpeditionStats({
    startDate = null,
    endDate = null,
    group_id = null,
    agency_id = null,
    status = null,
  } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    const addParam = (value) => {
      params.push(value);
      return `$${paramIndex++}`;
    };

    if (startDate) conditions.push(`created_at::date >= ${addParam(startDate)}::date`);
    if (endDate) conditions.push(`created_at::date <= ${addParam(endDate)}::date`);
    if (group_id !== null && group_id !== undefined) conditions.push(`group_id = ${addParam(group_id)}`);
    if (agency_id !== null && agency_id !== undefined) conditions.push(`agency_id = ${addParam(agency_id)}`);
    if (status) conditions.push(`status = ${addParam(status)}`);

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await query(
      `SELECT
        COUNT(*)::int as total_expeditions,
        COALESCE(SUM(frais_de_course), 0) as total_frais_de_course,
        COALESCE(SUM(frais_de_lagence_de_voyage), 0) as total_frais_de_lagence_de_voyage
       FROM expeditions
       ${whereClause}`,
      params
    );

    const row = Array.isArray(result) ? result[0] : result;
    const totalCourse = Number(row?.total_frais_de_course) || 0;
    const totalVoyage = Number(row?.total_frais_de_lagence_de_voyage) || 0;
    return {
      total_expeditions: Number(row?.total_expeditions) || 0,
      total_frais_de_course: totalCourse,
      total_frais_de_lagence_de_voyage: totalVoyage,
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
    group_id = null,
    parent_agency_id = null,
  }) {
    // Normalize agency_code: trim and uppercase if provided
    const normalizedCode = agency_code ? agency_code.trim().toUpperCase() : null;

    const result = await query(
      `INSERT INTO agencies (name, email, password_hash, role, is_active, agency_code, group_id, parent_agency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, email, password_hash, role, is_active, normalizedCode, group_id, parent_agency_id]
    );
    return result.id || result[0]?.id;
  }

  async function getAgencyById(id) {
    const result = await query(
      `SELECT id, name, email, agency_code, role, is_active, address, phone, logo_base64,
              group_id, parent_agency_id, created_at, updated_at
       FROM agencies
       WHERE id = $1 LIMIT 1`,
      [id]
    );
    // query() with LIMIT 1 already returns object or null
    return result || null;
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
      `SELECT id, name, email, agency_code, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE UPPER(TRIM(agency_code)) = $1 AND is_active = true 
       LIMIT 1`,
      [normalizedCode]
    );
    
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getAllAgencies() {
    // Only return active agencies (is_active = true)
    return await query(
      `SELECT id, name, email, agency_code, role, is_active, created_at, updated_at 
       FROM agencies 
       WHERE is_active = true
       ORDER BY created_at DESC`
    );
  }

  async function updateAgency(
    id,
    { name, email, password_hash, role, is_active, agency_code, group_id, parent_agency_id }
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
      const normalizedCode = agency_code && typeof agency_code === 'string' && agency_code.trim()
        ? agency_code.trim().toUpperCase()
        : null;
      updates.push(`agency_code = $${paramIndex++}`);
      params.push(normalizedCode);
    }
    if (group_id !== undefined) {
      updates.push(`group_id = $${paramIndex++}`);
      params.push(group_id !== null ? parseInt(group_id) : null);
    }
    if (parent_agency_id !== undefined) {
      updates.push(`parent_agency_id = $${paramIndex++}`);
      params.push(parent_agency_id !== null ? parseInt(parent_agency_id) : null);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE agencies SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
    const result = await query(sql, params);
    return { changes: result.changes || 0 };
  }

  async function getVendorsByAgency(agency_id) {
    return await query(
      `SELECT a.id, a.name, a.email, a.role, a.is_active,
              a.group_id, a.parent_agency_id, a.created_at, a.updated_at,
              g.name AS group_name
       FROM agencies a
       LEFT JOIN groups g ON g.id = a.group_id
       WHERE a.role = 'vendor' AND a.parent_agency_id = $1
       ORDER BY a.created_at DESC`,
      [agency_id]
    );
  }

  async function deleteAgency(id) {
    // Soft delete: set is_active = false
    return await updateAgency(id, { is_active: false });
  }

  // ============================================
  // Reminders (Agency Reminder Contacts + Reminders)
  // ============================================

  async function createAgencyReminderContact({ agency_id, label, phone, is_active = true }) {
    const result = await query(
      `INSERT INTO agency_reminder_contacts (agency_id, label, phone, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [agency_id, label, phone, is_active]
    );
    return result.id || result[0]?.id;
  }

  async function getAgencyReminderContacts({ agency_id, includeInactive = false } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    const addParam = (v) => {
      params.push(v);
      return `$${paramIndex++}`;
    };

    if (agency_id !== null && agency_id !== undefined) {
      conditions.push(`agency_id = ${addParam(agency_id)}`);
    }
    if (!includeInactive) {
      conditions.push(`is_active = true`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return query(
      `SELECT id, agency_id, label, phone, is_active, created_at, updated_at
       FROM agency_reminder_contacts
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );
  }

  async function getAgencyReminderContactById(id) {
    const result = await query(
      `SELECT id, agency_id, label, phone, is_active, created_at, updated_at
       FROM agency_reminder_contacts
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return result || null;
  }

  async function updateAgencyReminderContact(id, { label, phone, is_active } = {}) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(label);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
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

    const sql = `UPDATE agency_reminder_contacts SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
    const result = await query(sql, params);
    return { changes: result.changes || 0 };
  }

  async function deleteAgencyReminderContact(id) {
    // Soft delete
    return await updateAgencyReminderContact(id, { is_active: false });
  }

  async function createReminderCampaign({
    agency_id,
    contact_id = null,
    message,
    send_at,
    timezone = "Africa/Douala",
    audience_mode = "contacts",
    send_interval_min_sec = 60,
    send_interval_max_sec = 120,
    window_start = null,
    window_end = null,
    status = "scheduled",
    created_by_user_id = null,
    targets = [],
  }) {
    const reminder = await query(
      `INSERT INTO reminders (
        agency_id, contact_id, message, send_at, timezone, status, created_by_user_id,
        audience_mode, send_interval_min_sec, send_interval_max_sec, window_start, window_end,
        total_targets, sent_count, failed_count, skipped_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 0)
      RETURNING id`,
      [
        agency_id,
        contact_id,
        message,
        send_at,
        timezone,
        status,
        created_by_user_id,
        audience_mode,
        send_interval_min_sec,
        send_interval_max_sec,
        window_start,
        window_end,
        targets.length,
      ]
    );

    const reminderId = reminder.id || reminder[0]?.id;
    if (targets.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;
      for (const target of targets) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, 'queued')`);
        params.push(reminderId, target.target_type, target.target_value);
      }
      await query(
        `INSERT INTO reminder_targets (reminder_id, target_type, target_value, status)
         VALUES ${values.join(", ")}`,
        params
      );
    }
    return reminderId;
  }

  async function getReminders({
    agency_id,
    status,
    contact_id,
    startDate,
    endDate,
    limit = 200,
    offset = 0,
  } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    const addParam = (v) => {
      params.push(v);
      return `$${paramIndex++}`;
    };

    if (agency_id !== null && agency_id !== undefined) conditions.push(`r.agency_id = ${addParam(agency_id)}`);
    if (status) conditions.push(`r.status = ${addParam(status)}`);
    if (contact_id) conditions.push(`r.contact_id = ${addParam(contact_id)}`);
    if (startDate) conditions.push(`r.send_at::date >= ${addParam(startDate)}::date`);
    if (endDate) conditions.push(`r.send_at::date <= ${addParam(endDate)}::date`);

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return query(
      `SELECT
        r.id,
        r.agency_id,
        r.contact_id,
        c.label as contact_label,
        c.phone as contact_phone,
        r.message,
        r.send_at,
        r.timezone,
        r.audience_mode,
        r.send_interval_min_sec,
        r.send_interval_max_sec,
        r.window_start,
        r.window_end,
        r.status,
        r.total_targets,
        r.sent_count,
        r.failed_count,
        r.skipped_count,
        r.sent_at,
        r.last_error,
        r.created_by_user_id,
        r.created_at,
        r.updated_at
       FROM reminders r
       LEFT JOIN agency_reminder_contacts c ON c.id = r.contact_id
       ${whereClause}
       ORDER BY r.send_at DESC
       LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`,
      params
    );
  }

  async function getReminderById(id) {
    const result = await query(
      `SELECT id, agency_id, contact_id, message, send_at, timezone,
              audience_mode, send_interval_min_sec, send_interval_max_sec, window_start, window_end,
              status, total_targets, sent_count, failed_count, skipped_count,
              sent_at, last_error, created_by_user_id, created_at, updated_at
       FROM reminders
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    return result || null;
  }

  async function getReminderTargets(reminder_id) {
    return query(
      `SELECT id, reminder_id, target_type, target_value, status, attempts, last_error, sent_at, created_at, updated_at
       FROM reminder_targets
       WHERE reminder_id = $1
       ORDER BY id ASC`,
      [reminder_id]
    );
  }

  async function cancelReminder(id) {
    const result = await query(
      `UPDATE reminders
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status IN ('scheduled', 'running')`,
      [id]
    );
    if ((result.changes || 0) > 0) {
      await query(
        `UPDATE reminder_targets
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE reminder_id = $1 AND status = 'queued'`,
        [id]
      );
    }
    return { changes: result.changes || 0 };
  }

  async function deleteReminder(id) {
    const result = await query(
      `DELETE FROM reminders WHERE id = $1`,
      [id]
    );
    return { changes: result.changes || 0 };
  }

  async function retryReminderFailed(id) {
    await query(
      `UPDATE reminder_targets
       SET status = 'queued', updated_at = CURRENT_TIMESTAMP
       WHERE reminder_id = $1 AND status IN ('failed', 'skipped')`,
      [id]
    );
    const countersRow = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count
       FROM reminder_targets
       WHERE reminder_id = $1
       LIMIT 1`,
      [id]
    );
    const counters = Array.isArray(countersRow) ? countersRow[0] || {} : (countersRow || {});
    await query(
      `UPDATE reminders
       SET status = CASE WHEN $2::int > 0 THEN 'running' ELSE status END,
           sent_count = $3, failed_count = $4, skipped_count = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, Number(counters.queued_count || 0), Number(counters.sent_count || 0), Number(counters.failed_count || 0), Number(counters.skipped_count || 0)]
    );
    return { changes: 1 };
  }

  async function pollQueuedReminderTargets({ limit = 25 } = {}) {
    return query(
      `SELECT
        rt.id AS target_id,
        rt.reminder_id,
        rt.target_type,
        rt.target_value,
        rt.attempts,
        r.message,
        r.timezone,
        r.window_start,
        r.window_end,
        r.send_interval_min_sec,
        r.send_interval_max_sec,
        r.status AS reminder_status
       FROM reminder_targets rt
       JOIN reminders r ON r.id = rt.reminder_id
       WHERE rt.status = 'queued'
         AND r.status IN ('scheduled', 'running')
         AND r.send_at <= CURRENT_TIMESTAMP
       ORDER BY r.send_at ASC, rt.id ASC
       LIMIT $1`,
      [limit]
    );
  }

  async function markReminderTargetProcessing(reminder_id) {
    await query(
      `UPDATE reminders
       SET status = 'running', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'scheduled'`,
      [reminder_id]
    );
  }

  async function updateReminderTargetStatus(target_id, status, last_error = null) {
    const isSent = status === "sent";
    await query(
      `UPDATE reminder_targets
       SET status = $2::varchar, attempts = attempts + 1, last_error = $3,
           sent_at = CASE WHEN $2::varchar = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [target_id, status, last_error]
    );

    const reminderRef = await query(
      `SELECT reminder_id FROM reminder_targets WHERE id = $1 LIMIT 1`,
      [target_id]
    );
    const reminderId = reminderRef?.reminder_id;
    if (!reminderId) return { changes: 0 };

    const countersRow = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count
       FROM reminder_targets
       WHERE reminder_id = $1
       LIMIT 1`,
      [reminderId]
    );
    const counters = Array.isArray(countersRow) ? countersRow[0] || {} : (countersRow || {});

    const queued = Number(counters.queued_count || 0);
    const sent = Number(counters.sent_count || 0);
    const failed = Number(counters.failed_count || 0);
    const skipped = Number(counters.skipped_count || 0);
    const done = queued === 0;
    const nextStatus = done
      ? (failed > 0 && sent === 0 ? "failed" : "completed")
      : "running";
    await query(
      `UPDATE reminders
       SET status = $2::varchar,
           sent_count = $3,
           failed_count = $4,
           skipped_count = $5,
           sent_at = CASE WHEN $2::varchar = 'completed' THEN CURRENT_TIMESTAMP ELSE sent_at END,
           last_error = CASE WHEN $6 THEN NULL ELSE $7 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [reminderId, nextStatus, sent, failed, skipped, isSent, last_error]
    );
    return { changes: 1 };
  }

  async function markReminderSent(id) {
    const result = await query(
      `UPDATE reminders
       SET status = 'completed', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = NULL
       WHERE id = $1 AND status = 'scheduled'`,
      [id]
    );
    return { changes: result.changes || 0 };
  }

  async function markReminderFailed(id, last_error) {
    const result = await query(
      `UPDATE reminders
       SET status = 'failed', updated_at = CURRENT_TIMESTAMP, last_error = $2
       WHERE id = $1 AND status = 'scheduled'`,
      [id, String(last_error || "")].slice(0, 2)
    );
    return { changes: result.changes || 0 };
  }

  async function getDueReminders({ limit = 50 } = {}) {
    return query(
      `SELECT
        r.id,
        r.agency_id,
        r.contact_id,
        c.phone as contact_phone,
        r.message,
        r.send_at,
        r.timezone
       FROM reminders r
       JOIN agency_reminder_contacts c ON c.id = r.contact_id
       WHERE r.status IN ('scheduled', 'running')
         AND r.send_at <= CURRENT_TIMESTAMP
         AND c.is_active = true
       ORDER BY r.send_at ASC
       LIMIT $1`,
      [limit]
    );
  }

  async function setReminderTotals(reminder_id, totals = {}) {
    return query(
      `UPDATE reminders
       SET total_targets = $2, sent_count = $3, failed_count = $4, skipped_count = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        reminder_id,
        Number(totals.total_targets || 0),
        Number(totals.sent_count || 0),
        Number(totals.failed_count || 0),
        Number(totals.skipped_count || 0),
      ]
    );
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
              a.name as agency_name,
              (SELECT MAX(d.created_at) FROM deliveries d WHERE d.group_id = g.id) as last_delivery_at
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       WHERE g.id = $1 LIMIT 1`,
      [id]
    );
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getGroupsByAgency(agency_id) {
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active,
              g.created_at, g.updated_at,
              a.name as agency_name,
              (SELECT MAX(d.created_at) FROM deliveries d WHERE d.group_id = g.id) as last_delivery_at
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
       WHERE g.agency_id = $1
       ORDER BY g.created_at DESC`,
      [agency_id]
    );
  }

  async function getAllGroups() {
    return await query(
      `SELECT g.id, g.agency_id, g.whatsapp_group_id, g.name, g.is_active,
              g.created_at, g.updated_at,
              a.name as agency_name,
              (SELECT MAX(d.created_at) FROM deliveries d WHERE d.group_id = g.id) as last_delivery_at
       FROM groups g
       LEFT JOIN agencies a ON g.agency_id = a.id
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
    const result = await query(`DELETE FROM groups WHERE id = $1`, [id]);
    return { changes: result.changes || 0 };
  }

  // ============================================
  // Tariff Queries
  // ============================================

  async function createTariff({ agency_id, quartier, tarif_amount }) {
    const result = await query(
      `INSERT INTO tariffs (agency_id, quartier, tarif_amount) 
       VALUES ($1, $2, $3) RETURNING id`,
      [agency_id, quartier, tarif_amount]
    );
    return result.id || result[0]?.id;
  }

  async function getTariffById(id) {
    const result = await query(
      `SELECT * FROM tariffs WHERE id = $1 LIMIT 1`,
      [id]
    );
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getTariffByAgencyAndQuartier(agency_id, quartier) {
    const result = await query(
      `SELECT * FROM tariffs 
       WHERE agency_id = $1 AND quartier = $2 LIMIT 1`,
      [agency_id, quartier]
    );
    // query() with LIMIT 1 already returns object or null
    return result || null;
  }

  async function getTariffsByAgency(agency_id) {
    return await query(
      `SELECT * FROM tariffs 
       WHERE agency_id = $1 
       ORDER BY quartier ASC`,
      [agency_id]
    );
  }

  async function getAllTariffs() {
    return await query(
      `SELECT t.*, a.name as agency_name 
       FROM tariffs t
       LEFT JOIN agencies a ON t.agency_id = a.id
       ORDER BY t.agency_id, t.quartier ASC`
    );
  }

  async function updateTariff(id, { quartier, tarif_amount }) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (quartier !== undefined) {
      updates.push(`quartier = $${paramIndex++}`);
      params.push(quartier);
    }
    if (tarif_amount !== undefined) {
      updates.push(`tarif_amount = $${paramIndex++}`);
      params.push(tarif_amount);
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
    createExpedition,
    getExpeditions,
    getExpeditionById,
    updateExpedition,
    deleteExpedition,
    getExpeditionStats,
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
    getVendorsByAgency,
    // Reminders
    createAgencyReminderContact,
    getAgencyReminderContacts,
    getAgencyReminderContactById,
    updateAgencyReminderContact,
    deleteAgencyReminderContact,
    createReminder: createReminderCampaign,
    createReminderCampaign,
    getReminders,
    getReminderById,
    getReminderTargets,
    cancelReminder,
    deleteReminder,
    retryReminderFailed,
    pollQueuedReminderTargets,
    markReminderTargetProcessing,
    updateReminderTargetStatus,
    markReminderSent,
    markReminderFailed,
    getDueReminders,
    setReminderTotals,
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
