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
    } = data;

    const res = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );

    const deliveryId = res.id || res.lastInsertRowid;
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
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        throw new Error(
          `Invalid field name: ${key}. Allowed fields: ${allowedFields.join(", ")}`
        );
      }
      fields.push(`${key} = $${values.length + 1}`);
      values.push(value);
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
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "created_at";
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

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) as total FROM deliveries ${whereClause}`;
    const dataSql = `SELECT * FROM deliveries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ${addParam(
      limit
    )} OFFSET ${addParam(offset)}`;

    const countResult = await query(countSql, params.slice(0, params.length - 2));
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

  async function getDailyStats(date = null) {
    const tzExpr = `created_at AT TIME ZONE '${TIME_ZONE}'`;
    let sql;
    let params = [];

    if (date) {
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
        WHERE (${tzExpr})::date = $1::date
      `;
      params = [date];
    } else {
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
        WHERE (${tzExpr})::date = CURRENT_DATE
      `;
    }

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

  return {
    type: "postgres",
    query,
    insertDelivery,
    bulkCreateDeliveries,
    updateDelivery,
    findDeliveryByPhone,
    findDeliveryByPhoneForUpdate,
    getDeliveryById,
    getDeliveryHistory,
    getTodayDeliveries,
    getDeliveries,
    getDailyStats,
    searchDeliveries,
    saveHistory,
    close: async () => pool.end(),
    getRawDb: () => pool,
    TIME_ZONE,
  };
}

module.exports = createPostgresQueries;

