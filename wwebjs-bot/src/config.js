require("dotenv").config();
const path = require("path");

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";
const resolvedDbType = hasDatabaseUrl || isProduction ? "postgres" : "sqlite";

module.exports = {
  // Database configuration
  DB_TYPE: resolvedDbType,
  TIME_ZONE: process.env.TIME_ZONE || "UTC",

  // SQLite database path - defaults to data/local.db in project root
  DB_PATH:
    process.env.DB_PATH || path.join(__dirname, "..", "data", "local.db"),

  // PostgreSQL connection string (Render production)
  DATABASE_URL: process.env.DATABASE_URL || null,

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
