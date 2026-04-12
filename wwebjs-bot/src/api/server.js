const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const logger = require("../logger");
const deliveriesRouter = require("./routes/deliveries");
const statsRouter = require("./routes/stats");
const searchRouter = require("./routes/search");
const authRouter = require("./routes/auth");
const agenciesRouter = require("./routes/agencies");
const groupsRouter = require("./routes/groups");
const tariffsRouter = require("./routes/tariffs");
const reportsRouter = require("./routes/reports");
const expeditionsRouter = require("./routes/expeditions");
const reminderContactsRouter = require("./routes/reminder-contacts");
const remindersRouter = require("./routes/reminders");
const vendorsRouter = require("./routes/vendors");
const vendorRouter = require("./routes/vendor");
const waitlistRouter = require("./routes/waitlist");
const errorHandler = require("./middleware/errorHandler");

const app = express();
// Use Render's PORT env var (standard), fallback to API_PORT for local dev
const PORT = process.env.PORT || process.env.API_PORT || 3000;

// Fail fast if ALLOWED_ORIGINS is not configured in production
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  logger.fatal("ALLOWED_ORIGINS is not set in production — refusing to start");
  process.exit(1);
}

// Middleware
// CORS configuration - allow requests from frontend
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    // In development, allow localhost origins
    if (
      !origin ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      callback(null, true);
      return;
    }

    // In production, check against allowed origins from environment variable
    if (process.env.NODE_ENV === "production") {
      const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : [];

      // If ALLOWED_ORIGINS is set, check against it
      if (allowedOrigins.length > 0) {
        // Normalize origin and allowed origins (remove trailing slashes)
        const normalizeUrl = (url) => url.trim().replace(/\/+$/, "");
        const normalizedOrigin = normalizeUrl(origin);
        
        // Exact match only — startsWith is unsafe (allows app.example.com.evil.com)
        const isAllowed = allowedOrigins.some((allowed) => {
          const allowedClean = normalizeUrl(allowed);
          return normalizedOrigin === allowedClean;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, "CORS blocked origin");
          callback(new Error("Not allowed by CORS"));
        }
      } else {
        // Unreachable in production (fail-fast check above ensures ALLOWED_ORIGINS is set)
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      // Development: allow all
      callback(null, true);
    }
  },
  credentials: true, // Allow cookies/credentials
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
};

app.use(helmet({
  // crossOriginResourcePolicy is set to same-site by default which blocks
  // cross-origin PDF downloads — relax to cross-origin for the reports route.
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors(corsOptions)); // Enable CORS with configuration
app.use(cookieParser()); // Parse cookies

// Enhanced JSON parser with better error handling
// Allow empty request bodies (e.g., for logout endpoint)
app.use(
  express.json({
    limit: "10mb",
    strict: true,
    verify: (req, res, buf) => {
      // Allow empty bodies - some endpoints (like logout) don't require a body
      const bodyString = buf.toString().trim();
      if (bodyString.length === 0) {
        return; // Empty body is valid, skip JSON parsing
      }

      try {
        JSON.parse(bodyString);
      } catch (e) {
        // Only send error if headers haven't been sent yet
        if (!res.headersSent) {
          res.status(400).json({
            success: false,
            error: "Invalid JSON format",
            message: e.message,
            hint: "Make sure you only paste the JSON object, no extra text before or after",
          });
        }
        throw new Error("Invalid JSON");
      }
    },
  })
);

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use(pinoHttp({ logger }));

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/agencies", agenciesRouter);
app.use("/api/v1/groups", groupsRouter);
app.use("/api/v1/tariffs", tariffsRouter);
app.use("/api/v1/deliveries", deliveriesRouter);
app.use("/api/v1/expeditions", expeditionsRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/reminder-contacts", reminderContactsRouter);
app.use("/api/v1/reminders", remindersRouter);
app.use("/api/v1/vendors", vendorsRouter);
app.use("/api/v1/vendor", vendorRouter);
app.use("/api/v1/waitlist", waitlistRouter);

// Health check endpoint
app.get("/api/v1/health", async (req, res) => {
  const { adapter } = require("../db");
  let dbOk = false;
  let dbError = null;
  try {
    await adapter.query("SELECT 1");
    dbOk = true;
  } catch (err) {
    dbError = err.message;
  }

  const status = dbOk ? "ok" : "degraded";
  res.status(dbOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    service: "delivery-bot-api",
    version: "1.0.0",
    db: dbOk ? "ok" : "error",
    ...(dbError && { db_error: dbError }),
  });
});

// Schema validation endpoint
app.get("/api/v1/schema/status", async (req, res) => {
  try {
    const { adapter } = require("../db");
    const fs = require("fs");
    const path = require("path");

    // Get database type
    const dbType = adapter?.type || "unknown";

    // Get applied migrations from database
    let appliedMigrations = [];
    try {
      const result = await adapter.query(
        "SELECT version, applied_at FROM schema_migrations ORDER BY version"
      );
      appliedMigrations = result.map((row) => ({
        version: row.version,
        applied_at: row.applied_at,
      }));
    } catch (error) {
      // schema_migrations table might not exist
      if (
        error.message.includes("no such table") ||
        error.message.includes("does not exist")
      ) {
        // Table doesn't exist - migrations never run
        return res.json({
          success: true,
          database_type: dbType,
          migrations_table_exists: false,
          applied_migrations: [],
          pending_migrations: [],
          status: "no_migrations_table",
          message:
            "Migrations table does not exist. Run migrations to create it.",
        });
      }
      throw error;
    }

    // Get all migration files
    const migrationsDir = path.join(__dirname, "../../db/migrations");
    let migrationFiles = [];
    if (fs.existsSync(migrationsDir)) {
      migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .filter((file) => /^\d{14}_/.test(file))
        .sort()
        .map((file) => {
          const version = file.substring(0, 14);
          return {
            filename: file,
            version: version,
          };
        });
    }

    // Find pending migrations
    const appliedVersions = appliedMigrations.map((m) => m.version);
    const pendingMigrations = migrationFiles.filter(
      (file) => !appliedVersions.includes(file.version)
    );

    // Determine status
    let status = "up_to_date";
    if (pendingMigrations.length > 0) {
      status = "pending_migrations";
    } else if (appliedMigrations.length === 0 && migrationFiles.length > 0) {
      status = "no_migrations_applied";
    }

    res.json({
      success: true,
      database_type: dbType,
      migrations_table_exists: true,
      applied_migrations: appliedMigrations,
      total_migration_files: migrationFiles.length,
      pending_migrations: pendingMigrations.map((m) => m.filename),
      status: status,
      message:
        pendingMigrations.length > 0
          ? `${pendingMigrations.length} migration(s) pending`
          : "Schema is up to date",
    });
  } catch (error) {
    logger.error({ err: error }, "Schema status check error");
    res.status(500).json({
      success: false,
      error: "Schema status check failed",
      message: error.message,
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Delivery Bot API",
    version: "1.0.0",
    endpoints: {
      deliveries: "/api/v1/deliveries",
      stats: "/api/v1/stats",
      search: "/api/v1/search",
      health: "/api/v1/health",
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException — process will exit');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandledRejection — process will exit');
    process.exit(1);
  });

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'API server started');
  });

  async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown signal received — draining connections');

    server.close(async () => {
      try {
        const { adapter } = require('../db');
        await adapter.close();
        logger.info('Postgres pool closed — exiting cleanly');
      } catch (err) {
        logger.error({ err }, 'Error closing Postgres pool');
      } finally {
        process.exit(0);
      }
    });

    // Force-exit if drain exceeds 25 s (Render sends SIGKILL at 30 s)
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 25_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

module.exports = app;
