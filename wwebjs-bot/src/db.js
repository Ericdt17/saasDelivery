const config = require("./config");
const { initDatabase } = require("./db-adapter");

// Initialize the appropriate database (SQLite or PostgreSQL)
const adapter = initDatabase();
const db = adapter.getRawDb();

// Tables are initialized by the adapter

// Helper function to add history entry
async function addHistory(deliveryId, action, details, actor = "bot") {
  if (config.DB_TYPE === "postgres") {
    const result = await adapter.query(
      "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES ($1, $2, $3, $4) RETURNING id",
      [deliveryId, action, details, actor]
    );
    return result;
  } else {
    // SQLite - returns promise for consistency
    return await adapter.query(
      "INSERT INTO delivery_history (delivery_id, action, details, actor) VALUES (?, ?, ?, ?)",
      [deliveryId, action, details, actor]
    );
  }
}

// Helper function to update delivery
async function updateDelivery(id, updates) {
  // Whitelist of allowed field names to prevent SQL injection
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
    // Validate field name against whitelist
    if (!allowedFields.includes(key)) {
      throw new Error(
        `Invalid field name: ${key}. Allowed fields: ${allowedFields.join(", ")}`
      );
    }

    if (config.DB_TYPE === "postgres") {
      fields.push(`${key} = $${values.length + 1}`);
    } else {
      fields.push(`${key} = ?`);
    }
    values.push(value);
  }

  if (fields.length === 0) {
    throw new Error("No valid fields to update");
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  if (config.DB_TYPE === "postgres") {
    const sql = `UPDATE deliveries SET ${fields.join(", ")} WHERE id = $${values.length}`;
    return await adapter.query(sql, values);
  } else {
    const sql = `UPDATE deliveries SET ${fields.join(", ")} WHERE id = ?`;
    return adapter.query(sql, values);
  }
}

// Helper function to create delivery
async function createDelivery(data) {
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

  if (config.DB_TYPE === "postgres") {
    const sql = `
      INSERT INTO deliveries 
      (phone, customer_name, items, amount_due, amount_paid, status, quartier, notes, carrier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const result = await adapter.query(sql, [
      phone,
      customer_name,
      items,
      amount_due || 0,
      amount_paid,
      status,
      quartier,
      notes,
      carrier,
    ]);

    // PostgreSQL returns { id, lastInsertRowid, changes }
    const deliveryId = result?.id || result?.lastInsertRowid;
    if (!deliveryId) {
      throw new Error(
        "Failed to create delivery: No ID returned from database"
      );
    }
    await addHistory(deliveryId, "created", JSON.stringify(data));
    return deliveryId;
  } else {
    // SQLite - returns promise for consistency
    const result = await adapter.query(
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
    if (!deliveryId) {
      throw new Error(
        "Failed to create delivery: No ID returned from database"
      );
    }
    await addHistory(deliveryId, "created", JSON.stringify(data));
    return deliveryId;
  }
}

// Helper function to find delivery by phone (most recent pending/active)
async function findDeliveryByPhone(phone, status = null) {
  let sql = "SELECT * FROM deliveries WHERE phone = ?";
  const params = [phone];

  if (status) {
    if (config.DB_TYPE === "postgres") {
      sql += " AND status = $2";
    } else {
      sql += " AND status = ?";
    }
    params.push(status);
  } else {
    // Get most recent non-closed delivery
    sql += " AND status NOT IN ('delivered', 'failed', 'cancelled')";
  }

  sql += " ORDER BY created_at DESC LIMIT 1";

  if (config.DB_TYPE === "postgres") {
    sql = sql.replace(/\?/g, (match, offset) => {
      const index = sql.substring(0, offset).match(/\?/g)?.length || 0;
      return `$${index + 1}`;
    });
    return await adapter.query(sql, params);
  } else {
    return await adapter.query(sql, params);
  }
}

// Helper function to find delivery by phone for status updates (finds any delivery regardless of status)
async function findDeliveryByPhoneForUpdate(phone) {
  const sql =
    "SELECT * FROM deliveries WHERE phone = ? ORDER BY created_at DESC LIMIT 1";

  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      "SELECT * FROM deliveries WHERE phone = $1 ORDER BY created_at DESC LIMIT 1",
      [phone]
    );
  } else {
    return await adapter.query(sql, [phone]);
  }
}

// Helper function to get all deliveries for today
async function getTodayDeliveries() {
  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      `SELECT * FROM deliveries 
      WHERE created_at::date = CURRENT_DATE
      ORDER BY created_at DESC`
    );
  } else {
    return await adapter.query(
      `SELECT * FROM deliveries 
      WHERE DATE(created_at) = DATE('now')
      ORDER BY created_at DESC`
    );
  }
}

// Helper function to get delivery statistics
async function getDeliveryStats(date = null) {
  let sql;
  let params = [];

  if (config.DB_TYPE === "postgres") {
    if (date) {
      sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END) as pickup,
          SUM(amount_paid) as total_collected,
          SUM(amount_due - amount_paid) as total_remaining
        FROM deliveries
        WHERE created_at::date = $1::date
      `;
      params = [date];
    } else {
      sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END) as pickup,
          SUM(amount_paid) as total_collected,
          SUM(amount_due - amount_paid) as total_remaining
        FROM deliveries
        WHERE created_at::date = CURRENT_DATE
      `;
      params = [];
    }
  } else {
    if (date) {
      sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END) as pickup,
          SUM(amount_paid) as total_collected,
          SUM(amount_due - amount_paid) as total_remaining
        FROM deliveries
        WHERE DATE(created_at) = DATE(?)
      `;
      params = [date];
    } else {
      sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'pickup' THEN 1 ELSE 0 END) as pickup,
          SUM(amount_paid) as total_collected,
          SUM(amount_due - amount_paid) as total_remaining
        FROM deliveries
        WHERE DATE(created_at) = DATE('now')
      `;
      params = [];
    }
  }

  const result = await adapter.query(sql, params);

  // PostgreSQL returns an array, SQLite returns object directly
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }
  return (
    result || {
      total: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      pickup: 0,
      total_collected: 0,
      total_remaining: 0,
    }
  );
}

// Helper function to get delivery by ID
async function getDeliveryById(id) {
  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      "SELECT * FROM deliveries WHERE id = $1 LIMIT 1",
      [id]
    );
  } else {
    return await adapter.query(
      "SELECT * FROM deliveries WHERE id = ? LIMIT 1",
      [id]
    );
  }
}

// Helper function to get delivery history
async function getDeliveryHistory(deliveryId) {
  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      "SELECT * FROM delivery_history WHERE delivery_id = $1 ORDER BY created_at DESC",
      [deliveryId]
    );
  } else {
    return await adapter.query(
      "SELECT * FROM delivery_history WHERE delivery_id = ? ORDER BY created_at DESC",
      [deliveryId]
    );
  }
}

// Helper function to get all deliveries with pagination and filters
async function getAllDeliveries(options = {}) {
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

  // Validate sortBy to prevent SQL injection
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

  // Build WHERE clause (use ? placeholders, convert later if PostgreSQL)
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push(`status = ?`);
    params.push(status);
  }

  if (date) {
    if (config.DB_TYPE === "postgres") {
      conditions.push(`created_at::date = ?::date`);
    } else {
      conditions.push(`DATE(created_at) = DATE(?)`);
    }
    params.push(date);
  }

  if (startDate && endDate) {
    if (config.DB_TYPE === "postgres") {
      conditions.push(
        `created_at::date >= ?::date AND created_at::date <= ?::date`
      );
    } else {
      conditions.push(
        `DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`
      );
    }
    params.push(startDate, endDate);
  }

  if (phone) {
    conditions.push(`phone LIKE ?`);
    params.push(`%${phone}%`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Build SQL with ? placeholders (adapter will convert for PostgreSQL)
  let countSql = `SELECT COUNT(*) as total FROM deliveries ${whereClause}`;
  let dataSql = `SELECT * FROM deliveries ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder}`;

  // Get count params (without limit/offset)
  const countParams = [...params];

  // Add pagination
  const offset = (page - 1) * limit;
  dataSql += ` LIMIT ? OFFSET ?`;
  const dataParams = [...params, limit, offset];

  // Get total count
  const countResult = await adapter.query(countSql, countParams);
  const total = Array.isArray(countResult)
    ? countResult[0]?.total || 0
    : countResult?.total || 0;

  // Get data
  const deliveries = await adapter.query(dataSql, dataParams);

  return {
    deliveries: Array.isArray(deliveries)
      ? deliveries
      : [deliveries].filter(Boolean),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Helper function to search deliveries (simple LIKE search)
async function searchDeliveries(query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = `%${query.trim()}%`;

  if (config.DB_TYPE === "postgres") {
    return await adapter.query(
      `SELECT * FROM deliveries 
       WHERE phone LIKE $1 
       OR items LIKE $1 
       OR customer_name LIKE $1 
       OR quartier LIKE $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [searchTerm]
    );
  } else {
    return await adapter.query(
      `SELECT * FROM deliveries 
       WHERE phone LIKE ? 
       OR items LIKE ? 
       OR customer_name LIKE ? 
       OR quartier LIKE ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );
  }
}

module.exports = {
  db,
  adapter, // Export adapter for advanced usage
  createDelivery,
  updateDelivery,
  findDeliveryByPhone,
  findDeliveryByPhoneForUpdate,
  getDeliveryById,
  getDeliveryHistory,
  getTodayDeliveries,
  getAllDeliveries,
  getDeliveryStats,
  searchDeliveries,
  addHistory,
  close: async () => {
    if (config.DB_TYPE === "postgres") {
      await adapter.close();
    } else {
      adapter.close();
    }
  },
};
