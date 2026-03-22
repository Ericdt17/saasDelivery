const { Pool } = require("pg");
const config = require("../config");

function createPostgresPool() {
  const connectionString = config.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL connection");
  }

  // Local dev often uses docker Postgres without SSL enabled.
  // Auto-disable SSL for localhost unless explicitly requested with PG_SSL=true.
  const hostname = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return "";
    }
  })();

  const useSsl =
    process.env.PG_SSL === "true"
      ? true
      : process.env.PG_SSL === "false"
        ? false
        : hostname && !["localhost", "127.0.0.1"].includes(hostname);

  return new Pool({
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Reduced from 10000 to 5000ms (5 seconds)
  });
}

module.exports = {
  createPostgresPool,
};




