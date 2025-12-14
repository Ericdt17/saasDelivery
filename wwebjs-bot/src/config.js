// Load .env file only if not in Docker container or if explicitly enabled
// In Docker, we rely on environment variables passed at runtime
if (!process.env.DOCKER_CONTAINER && process.env.USE_ENV_FILE !== 'false') {
  require("dotenv").config();
}
const path = require("path");

module.exports = {
  // Database configuration
  // DB_TYPE: 'sqlite' or 'postgres'
  DB_TYPE: process.env.DB_TYPE || "sqlite",
  
  // SQLite database path - defaults to data/bot.db in project root
  DB_PATH: process.env.DB_PATH || path.join(__dirname, "..", "data", "bot.db"),
  
  // PostgreSQL connection string
  // Format: postgresql://user:password@host:port/database
  // Example: postgresql://postgres:password@localhost:5432/deliverybot
  DATABASE_URL: process.env.DATABASE_URL || null,
  
  // Alternative PostgreSQL config (if not using DATABASE_URL)
  PG_HOST: process.env.PG_HOST || "localhost",
  PG_PORT: process.env.PG_PORT || 5432,
  PG_USER: process.env.PG_USER || "postgres",
  PG_PASSWORD: process.env.PG_PASSWORD || "",
  PG_DATABASE: process.env.PG_DATABASE || "deliverybot",
  
  // WhatsApp Group ID to listen to (optional - if not set, listens to all groups)
  GROUP_ID: process.env.GROUP_ID || null,
  
  // Daily report configuration
  REPORT_TIME: process.env.REPORT_TIME || "20:00", // Time to send daily report (HH:MM format)
  REPORT_ENABLED: process.env.REPORT_ENABLED !== "false", // Enable/disable automatic reports
  REPORT_SEND_TO_GROUP: process.env.REPORT_SEND_TO_GROUP === "true", // Send report to WhatsApp group
  REPORT_RECIPIENT: process.env.REPORT_RECIPIENT || null, // WhatsApp number to send report to (if not group)
  
  // Message sending configuration
  SEND_CONFIRMATIONS: process.env.SEND_CONFIRMATIONS || "false", // Send confirmation messages to group when delivery created/updated
};

