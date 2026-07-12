// Load .env file only if not in Docker container or if explicitly enabled
// In Docker, we rely on environment variables passed at runtime
if (!process.env.DOCKER_CONTAINER && process.env.USE_ENV_FILE !== 'false') {
  require("dotenv").config();
}
module.exports = {
  // PostgreSQL connection string (required)
  DATABASE_URL: process.env.DATABASE_URL,

  // Timezone for date filtering (must match the business timezone — Cameroon = UTC+1)
  TIME_ZONE: process.env.TIME_ZONE || "Africa/Douala",

  SKIP_MIGRATIONS: process.env.SKIP_MIGRATIONS === "true",
  USE_CORE_API: process.env.USE_CORE_API === "true",
};
