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
    } = data;

    const result = await query(
      `INSERT INTO deliveries 
        (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  async function getDailyStats(date = null) {
    const normalizedDate = normalizeDate(date);
    let sql;
    let params = [];

    if (normalizedDate) {
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
        WHERE DATE(created_at, 'localtime') = DATE(?, 'localtime')
      `;
      params = [normalizedDate];
    } else {
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
        WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
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

  return {
    type: "sqlite",
    initSchema,
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
    close: async () => db.close(),
    getRawDb: () => db,
    TIME_ZONE,
  };
}

module.exports = createSqliteQueries;
