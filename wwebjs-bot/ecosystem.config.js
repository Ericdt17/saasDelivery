/**
 * PM2 Ecosystem Configuration
 * Runs migrations before starting the API server
 */

module.exports = {
  apps: [
    {
      name: "saas-delivery-api",
      // Use startup script that runs migrations first
      script: "src/scripts/start-with-migrations.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // Restart policy
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      // Logging
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Environment variables loaded from .env.prod
      env_file: ".env.prod",
    },
  ],
};
