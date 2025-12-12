# Database Migrations

Simple SQL-based migration system for managing database schema changes.

> 📖 **New to migrations?** Start with the [Complete Migration Run Guide](../MIGRATION_RUN_GUIDE.md) for step-by-step instructions on running migrations locally and in production.

## Overview

This migration system:

- ✅ Works with both **SQLite** (development) and **PostgreSQL** (production)
- ✅ Executes SQL files in chronological order
- ✅ Tracks applied migrations in `schema_migrations` table
- ✅ Idempotent - safe to run multiple times
- ✅ Production-ready with clear error handling

## Quick Start

### Run Migrations

```bash
npm run migrate
```

This will:

1. Detect your database type (SQLite or PostgreSQL)
2. Create `schema_migrations` table if needed
3. Apply all pending migrations
4. Log clear status messages

## Migration File Format

Migrations must be named using this pattern:

```
YYYYMMDDHHMMSS_description.sql
```

**Example:**

```
20250101120000_add_user_table.sql
20250101130000_add_email_index.sql
```

The timestamp ensures migrations run in the correct order.

## Creating a Migration

1. Create a new `.sql` file in `db/migrations/`
2. Use timestamp format: `YYYYMMDDHHMMSS` (14 digits)
3. Add descriptive name after timestamp
4. Write your SQL statements

**Example:**

```sql
-- 20250101120000_add_test_column.sql
ALTER TABLE deliveries ADD COLUMN test_field TEXT;
```

## Best Practices

### 1. Use IF NOT EXISTS

Make migrations idempotent:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 2. One Change Per Migration

Keep migrations focused:

- ✅ Good: One table, one column, one index
- ❌ Bad: Multiple unrelated changes

### 3. Test Locally First

Always test on SQLite before production:

```bash
# Test with SQLite (default)
npm run migrate

# Test with PostgreSQL (set DATABASE_URL)
DATABASE_URL=postgresql://... npm run migrate
```

### 4. Review Before Committing

Always review SQL before committing to version control.

### 5. Never Edit Applied Migrations

If you need to change a migration:

- ✅ Create a new migration to fix it
- ❌ Don't edit existing migration files

## How It Works

### Database Detection

The system automatically detects your database type:

- **SQLite**: Used when `DATABASE_URL` is not set
- **PostgreSQL**: Used when `DATABASE_URL` is set or `NODE_ENV=production`

### Migration Tracking

Applied migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The `version` is the 14-digit timestamp from the filename.

### Execution Flow

1. **Detect database type** (SQLite or PostgreSQL)
2. **Create connection** to database
3. **Ensure `schema_migrations` table exists**
4. **Get list of applied migrations**
5. **Scan `db/migrations/` for SQL files**
6. **Filter to pending migrations** (not in `schema_migrations`)
7. **Execute each pending migration** in chronological order
8. **Mark as applied** after successful execution

## SQL Compatibility

### PostgreSQL vs SQLite

Migrations should use **PostgreSQL-compatible SQL** with these considerations:

| Feature            | PostgreSQL | SQLite | Notes                     |
| ------------------ | ---------- | ------ | ------------------------- |
| `SERIAL`           | ✅         | ❌     | Use for primary keys      |
| `VARCHAR(n)`       | ✅         | ✅     | Works in both             |
| `TEXT`             | ✅         | ✅     | Works in both             |
| `BOOLEAN`          | ✅         | ❌     | SQLite uses INTEGER (0/1) |
| `TIMESTAMP`        | ✅         | ❌     | SQLite uses DATETIME      |
| `IF NOT EXISTS`    | ✅         | ✅     | Works in both             |
| `DO $$ ... END $$` | ✅         | ❌     | PostgreSQL-only blocks    |

### Best Practices for Compatibility

1. **Use PostgreSQL syntax** - SQLite is more forgiving
2. **Test with SQLite first** - Catches most issues
3. **Avoid database-specific features** - Or wrap in conditional blocks

## Error Handling

If a migration fails:

- ❌ Migration is **not** marked as applied
- ❌ Process stops immediately
- ✅ Previous migrations remain applied
- ✅ Fix the error and run again

Common errors:

- Syntax errors in SQL
- Missing dependencies (table/column doesn't exist)
- Constraint violations

## Production Deployment

### Automatic Migration on Startup

You can integrate migrations into your startup process:

```javascript
// In your server.js or index.js
const { runMigrations } = require("./db/migrate");

async function startServer() {
  // Run migrations first
  await runMigrations();

  // Then start server
  app.listen(PORT, () => {
    console.log("Server started");
  });
}
```

### Manual Migration

Or run migrations manually before deploying:

```bash
# On production server
DATABASE_URL=postgresql://... npm run migrate
```

## Troubleshooting

### "No migration files found"

**Cause:** No `.sql` files in `db/migrations/`

**Solution:** Create migration files with correct naming format

### "Migration already exists"

**Cause:** Migration file name conflicts (same timestamp)

**Solution:** Use unique timestamps for each migration

### "Failed to apply migration"

**Cause:** SQL syntax error or constraint violation

**Solution:**

1. Check SQL syntax
2. Verify dependencies exist
3. Test on SQLite first
4. Fix and re-run

### "Cannot find module"

**Cause:** Running from wrong directory

**Solution:** Always run from project root: `npm run migrate`

## Examples

### Example 1: Create Table

```sql
-- 20250101120000_create_users_table.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Example 2: Add Column

```sql
-- 20250101130000_add_phone_to_users.sql
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
```

### Example 3: Add Index

```sql
-- 20250101140000_add_name_index.sql
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
```

### Example 4: Modify Column

```sql
-- 20250101150000_update_users_email.sql
-- PostgreSQL: Change email column type
ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(320);

-- SQLite: Requires recreating table (more complex)
```

## File Structure

```
wwebjs-bot/
├── db/
│   ├── migrate.js              # Migration runner script
│   └── migrations/
│       ├── README.md           # This file
│       ├── .gitkeep            # Ensures folder is tracked
│       ├── 20250101000000_initial_schema.sql
│       ├── 20250101120000_add_example_column.sql
│       └── ...                 # Your migration files
└── package.json                # Contains "migrate" script
```

## Success Messages

When migrations run successfully, you'll see:

```
🔍 Detected database type: SQLite
📋 Ensuring schema_migrations table exists...
✅ Found 0 applied migration(s)
📦 Found 2 migration file(s)

🔄 Applying 2 pending migration(s)...

Applying migration: 20250101000000_initial_schema.sql
✅ Migration applied successfully: 20250101000000_initial_schema.sql

Applying migration: 20250101120000_add_example_column.sql
✅ Migration applied successfully: 20250101120000_add_example_column.sql

✅ All migrations applied successfully!
```

On subsequent runs:

```
✅ Database schema is up to date
```

---

**Need help?** Check the error message - it's designed to be clear and actionable.
