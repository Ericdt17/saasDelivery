const { Pool } = require("pg");
const config = require("../config");

function createPostgresPool() {
  const connectionString = config.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL connection");
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

module.exports = {
  createPostgresPool,
};

