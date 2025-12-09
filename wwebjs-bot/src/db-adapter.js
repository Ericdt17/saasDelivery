/**
 * Database Adapter - Supports both SQLite and PostgreSQL
 * Provides a unified interface for database operations
 */

const config = require("./config");

let dbAdapter = null;

// Initialize the appropriate database adapter
function initDatabase() {
  if (dbAdapter) {
    return dbAdapter;
  }

  if (config.DB_TYPE === "postgres") {
    const PostgresAdapter = require("./db-adapters/postgres-adapter");
    dbAdapter = new PostgresAdapter();
  } else {
    const SqliteAdapter = require("./db-adapters/sqlite-adapter");
    dbAdapter = new SqliteAdapter();
  }

  return dbAdapter;
}

module.exports = {
  initDatabase,
  getAdapter: () => {
    if (!dbAdapter) {
      return initDatabase();
    }
    return dbAdapter;
  },
};

