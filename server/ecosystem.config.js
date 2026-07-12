/**
 * PM2 Ecosystem Configuration
 * Runs the LivSight REST API server
 */

module.exports = {
  apps: [
    {
      name: "api-server",
      script: "src/api/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env_file: ".env",
    },
  ],
};
