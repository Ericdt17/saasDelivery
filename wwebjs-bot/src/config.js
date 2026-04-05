// Load .env file only if not in Docker container or if explicitly enabled
// In Docker, we rely on environment variables passed at runtime
if (!process.env.DOCKER_CONTAINER && process.env.USE_ENV_FILE !== 'false') {
  require("dotenv").config();
}
module.exports = {
  // PostgreSQL connection string (required)
  DATABASE_URL: process.env.DATABASE_URL,
  
  // WhatsApp Group ID to listen to (optional - if not set, listens to all groups)
  GROUP_ID: process.env.GROUP_ID || null,
  
  // Daily report configuration
  REPORT_TIME: process.env.REPORT_TIME || "20:00", // Time to send daily report (HH:MM format)
  REPORT_ENABLED: process.env.REPORT_ENABLED !== "false", // Enable/disable automatic reports
  REPORT_SEND_TO_GROUP: process.env.REPORT_SEND_TO_GROUP === "true", // Send report to WhatsApp group
  REPORT_RECIPIENT: process.env.REPORT_RECIPIENT || null, // WhatsApp number to send report to (if not group)
  
  // Message sending configuration
  SEND_CONFIRMATIONS: process.env.SEND_CONFIRMATIONS || "false", // Send confirmation messages to group when delivery created/updated

  // Reply in thread when message looks like a delivery (phone + amount + quartier signals) but strict format fails
  FORMAT_REMINDER_ENABLED: process.env.FORMAT_REMINDER_ENABLED === "true",
  FORMAT_REMINDER_COOLDOWN_MS: (() => {
    const n = parseInt(process.env.FORMAT_REMINDER_COOLDOWN_MS || "90000", 10);
    return Number.isFinite(n) && n >= 0 ? n : 90000;
  })(),

  // Timezone for date filtering (must match the business timezone — Cameroon = UTC+1)
  TIME_ZONE: process.env.TIME_ZONE || "Africa/Douala",
};

