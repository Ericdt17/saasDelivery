const { Pool } = require("pg");
const config = require("../config");
const logger = require("../logger");

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

  const pool = new Pool({
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 10,
    // Release idle connections after 10s — shorter than Neon's server-side
    // idle timeout so the pool discards them before the server kills them.
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    // TCP keepalive prevents Neon/cloud DBs from terminating idle connections
    // mid-pool, which causes "Connection terminated unexpectedly" errors.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  // Without this handler, an error on an idle pool client (e.g. server-side
  // connection reset) becomes an uncaughtException and crashes the process.
  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected error on idle PostgreSQL client — connection will be replaced automatically");
  });

  return pool;
}

module.exports = {
  createPostgresPool,
};




