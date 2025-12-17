const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const deliveriesRouter = require("./routes/deliveries");
const statsRouter = require("./routes/stats");
const searchRouter = require("./routes/search");
const authRouter = require("./routes/auth");
const agenciesRouter = require("./routes/agencies");
const groupsRouter = require("./routes/groups");
const errorHandler = require("./middleware/errorHandler");

const app = express();
// Use Render's PORT env var (standard), fallback to API_PORT for local dev
const PORT = process.env.PORT || process.env.API_PORT || 3000;

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
        
        // Check exact match or if origin starts with any allowed origin
        const isAllowed = allowedOrigins.some((allowed) => {
          const allowedClean = normalizeUrl(allowed);
          return normalizedOrigin === allowedClean || normalizedOrigin.startsWith(allowedClean);
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          console.warn(
            `[CORS] Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(", ")}`
          );
          callback(new Error("Not allowed by CORS"));
        }
      } else {
        // If ALLOWED_ORIGINS not set, allow all (less secure but works)
        console.warn("[CORS] ALLOWED_ORIGINS not set, allowing all origins");
        callback(null, true);
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
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/agencies", agenciesRouter);
app.use("/api/v1/groups", groupsRouter);
app.use("/api/v1/deliveries", deliveriesRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/search", searchRouter);

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "delivery-bot-api",
    version: "1.0.0",
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
      if (dbType === "postgres") {
        const result = await adapter.query(
          "SELECT version, applied_at FROM schema_migrations ORDER BY version"
        );
        appliedMigrations = result.map((row) => ({
          version: row.version,
          applied_at: row.applied_at,
        }));
      } else if (dbType === "sqlite") {
        const result = await adapter.query(
          "SELECT version, applied_at FROM schema_migrations ORDER BY version"
        );
        appliedMigrations = result.map((row) => ({
          version: row.version,
          applied_at: row.applied_at,
        }));
      }
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
    console.error("Schema status check error:", error);
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
  app.listen(PORT, () => {
    console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST   /api/v1/auth/login`);
    console.log(`   POST   /api/v1/auth/logout`);
    console.log(`   GET    /api/v1/auth/me`);
    console.log(`   GET    /api/v1/agencies (super admin)`);
    console.log(`   POST   /api/v1/agencies (super admin)`);
    console.log(`   GET    /api/v1/groups`);
    console.log(`   GET    /api/v1/deliveries`);
    console.log(`   GET    /api/v1/deliveries/:id`);
    console.log(`   POST   /api/v1/deliveries`);
    console.log(`   POST   /api/v1/deliveries/bulk`);
    console.log(`   PUT    /api/v1/deliveries/:id`);
    console.log(`   GET    /api/v1/deliveries/:id/history`);
    console.log(`   GET    /api/v1/stats/daily`);
    console.log(`   GET    /api/v1/search?q=...`);
    console.log(`   GET    /api/v1/health\n`);
  });
}

module.exports = app;
