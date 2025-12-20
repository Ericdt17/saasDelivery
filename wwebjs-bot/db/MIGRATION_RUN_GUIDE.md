# Complete Migration Run Guide

Step-by-step instructions for running migrations locally and in production.

## Table of Contents

1. [Local Development (SQLite)](#local-development-sqlite)
2. [Production (PostgreSQL)](#production-postgresql)
3. [Testing Migrations](#testing-migrations)
4. [Troubleshooting](#troubleshooting)
5. [Best Practices](#best-practices)

---

## Local Development (SQLite)

### Prerequisites

1. Node.js installed
2. Dependencies installed: `npm install`
3. SQLite database (created automatically if doesn't exist)

### Step 1: Verify Setup

Check your `.env` file in `wwebjs-bot/` directory:

```env
# Should be set for local development
DB_TYPE=sqlite
DB_PATH=./data/bot.db
NODE_ENV=development
```

**Or leave these unset** - defaults will use SQLite.

### Step 2: Check Current Database State

```bash
# Navigate to project root
cd wwebjs-bot

# Check if database exists
# On Windows:
dir data\bot.db

# On Linux/Mac:
ls -la data/bot.db
```

If the database doesn't exist, it will be created automatically when you run migrations.

### Step 3: Check Existing Migrations

```bash
# List migration files
# On Windows:
dir db\migrations\*.sql

# On Linux/Mac:
ls -la db/migrations/*.sql
```

You should see your migration files like:

- `20250101000000_initial_schema.sql`
- `20250101120000_add_example_column.sql`

### Step 4: Run Migrations

```bash
npm run migrate
```

**Expected Output:**

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

### Step 5: Verify Migrations Applied

Run migrations again to verify idempotency:

```bash
npm run migrate
```

**Expected Output:**

```
🔍 Detected database type: SQLite
📋 Ensuring schema_migrations table exists...
✅ Found 2 applied migration(s)
📦 Found 2 migration file(s)
✅ Database schema is up to date
```

### Step 6: Check Database Schema

You can verify tables were created:

```bash
# Using SQLite CLI (if installed)
sqlite3 data/bot.db ".tables"

# Or check schema_migrations table
sqlite3 data/bot.db "SELECT * FROM schema_migrations;"
```

**Expected output:**

```
agencies
deliveries
delivery_history
groups
schema_migrations
```

---

## Production (PostgreSQL)

### Prerequisites

1. PostgreSQL database running
2. `DATABASE_URL` environment variable set
3. Access credentials to PostgreSQL database

### Step 1: Set Production Environment

Set your `DATABASE_URL` environment variable:

**Option A: Environment Variable (Recommended)**

```bash
# On Linux/Mac
export DATABASE_URL="postgresql://user:password@host:5432/database"

# On Windows (PowerShell)
$env:DATABASE_URL="postgresql://user:password@host:5432/database"

# On Windows (Command Prompt)
set DATABASE_URL=postgresql://user:password@host:5432/database
```

**Option B: .env File**

Create or update `.env` file in `wwebjs-bot/`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NODE_ENV=production
```

**Option C: Render/Cloud Platform**

If using Render or similar platform:

- Add `DATABASE_URL` in environment variables settings
- Platform automatically injects it

### Step 2: Verify Database Connection

Test that you can connect to PostgreSQL:

```bash
# Test connection (if you have psql installed)
psql $DATABASE_URL -c "SELECT version();"

# Or test via Node.js
node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT NOW()').then(r => console.log('✅ Connected:', r.rows[0])).catch(e => console.error('❌ Error:', e.message))"
```

### Step 3: Navigate to Project Directory

```bash
cd wwebjs-bot
```

### Step 4: Run Migrations

```bash
npm run migrate
```

**Expected Output:**

```
🔍 Detected database type: PostgreSQL
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

### Step 5: Verify in PostgreSQL

Connect to your PostgreSQL database and verify:

```sql
-- Connect to database
psql $DATABASE_URL

-- Check schema_migrations table
SELECT * FROM schema_migrations ORDER BY applied_at;

-- Check tables were created
\dt

-- Check specific table structure
\d deliveries
```

**Expected output:**

```
 version           | applied_at
-------------------+------------------------
 20250101000000    | 2025-01-01 12:00:00
 20250101120000    | 2025-01-01 13:00:00
```

### Step 6: Verify Idempotency

Run migrations again to ensure they're idempotent:

```bash
npm run migrate
```

**Expected Output:**

```
🔍 Detected database type: PostgreSQL
📋 Ensuring schema_migrations table exists...
✅ Found 2 applied migration(s)
📦 Found 2 migration file(s)
✅ Database schema is up to date
```

---

## Testing Migrations

### Test Script

Run the test script to verify everything works:

```bash
npm run test:migrate
```

**Expected Output:**

```
🧪 Testing Migration System

==================================================

1️⃣ Testing migration execution...
🔍 Detected database type: SQLite
📋 Ensuring schema_migrations table exists...
✅ Found 2 applied migration(s)
📦 Found 2 migration file(s)
✅ Database schema is up to date

2️⃣ Testing idempotency (running again)...
🔍 Detected database type: SQLite
📋 Ensuring schema_migrations table exists...
✅ Found 2 applied migration(s)
📦 Found 2 migration file(s)
✅ Database schema is up to date

✅ All tests passed!
==================================================

Migration system is working correctly! 🎉
```

---

## Step-by-Step: Creating a New Migration

### Step 1: Create Migration File

```bash
# Navigate to migrations directory
cd wwebjs-bot/db/migrations

# Create new migration file with timestamp
# Format: YYYYMMDDHHMMSS_description.sql
# Example: 20250112143000_add_phone_index.sql
```

**Generate timestamp:**

- **Manual**: Use current date/time: `20250112143000`
- **Online tool**: Search "timestamp generator"
- **Command line**:

  ```bash
  # Linux/Mac
  date +%Y%m%d%H%M%S

  # Windows PowerShell
  Get-Date -Format "yyyyMMddHHmmss"
  ```

### Step 2: Write SQL

Edit your migration file:

```sql
-- 20250112143000_add_phone_index.sql
CREATE INDEX IF NOT EXISTS idx_deliveries_phone_unique ON deliveries(phone);
```

### Step 3: Test Locally First

```bash
cd wwebjs-bot
npm run migrate
```

**Verify:**

- Migration runs without errors
- Database schema is updated correctly
- Idempotency works (run twice, second time says "up to date")

### Step 4: Commit to Git

```bash
git add db/migrations/20250112143000_add_phone_index.sql
git commit -m "Add phone index to deliveries table"
```

### Step 5: Deploy to Production

```bash
# On production server
cd wwebjs-bot
npm run migrate
```

---

## Complete Workflow Examples

### Example 1: Adding a New Column

**1. Create migration file:**

```bash
# Generate timestamp: 20250112150000
# Create file: db/migrations/20250112150000_add_status_column.sql
```

**2. Write SQL:**

```sql
-- db/migrations/20250112150000_add_status_column.sql
ALTER TABLE deliveries ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
```

**3. Test locally:**

```bash
npm run migrate
```

**4. Verify:**

```bash
# Check if column was added (SQLite)
sqlite3 data/bot.db "PRAGMA table_info(deliveries);"

# Should show 'status' column
```

**5. Commit and deploy:**

```bash
git add db/migrations/20250112150000_add_status_column.sql
git commit -m "Add status column to deliveries"
git push

# On production
npm run migrate
```

### Example 2: Creating a New Table

**1. Create migration file:**

```bash
# File: db/migrations/20250112160000_create_notifications_table.sql
```

**2. Write SQL:**

```sql
-- db/migrations/20250112160000_create_notifications_table.sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
```

**3. Test and deploy (same steps as above)**

---

## Integration with Application Startup

### Option 1: Manual Migration (Recommended for Production)

Run migrations manually before deploying:

```bash
# On production server
cd /path/to/app
npm run migrate
npm start
```

### Option 2: Automatic Migration on Startup

Add to your `server.js` or `index.js`:

```javascript
const { runMigrations } = require("./db/migrate");

async function startServer() {
  try {
    console.log("🔄 Running database migrations...");
    await runMigrations();
    console.log("✅ Migrations complete");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }

  // Start your server
  const app = require("./src/api/server");
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
  });
}

startServer();
```

### Option 3: Docker/Container Deployment

In your `Dockerfile` or startup script:

```dockerfile
# Dockerfile
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Run migrations before starting
RUN npm run migrate

CMD ["npm", "start"]
```

Or use an entrypoint script:

```bash
#!/bin/bash
# entrypoint.sh
set -e

echo "Running migrations..."
npm run migrate

echo "Starting application..."
npm start
```

---

## Troubleshooting

### Issue: "Cannot find module '../src/config'"

**Cause:** Running from wrong directory

**Solution:**

```bash
# Make sure you're in wwebjs-bot directory
cd wwebjs-bot
npm run migrate
```

### Issue: "DATABASE_URL is required for PostgreSQL"

**Cause:** `DATABASE_URL` not set when trying to use PostgreSQL

**Solution:**

```bash
# Set DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Or add to .env file
echo "DATABASE_URL=postgresql://..." >> .env
```

### Issue: "Migration failed: relation already exists"

**Cause:** Table/column already exists in database

**Solution:**

- Use `IF NOT EXISTS` in your SQL:
  ```sql
  CREATE TABLE IF NOT EXISTS users (...);
  ```
- Or handle the error gracefully (the migration runner does this)

### Issue: "No migration files found"

**Cause:** No `.sql` files in `db/migrations/`

**Solution:**

```bash
# Check if directory exists
ls db/migrations/

# Check if files match naming pattern (YYYYMMDDHHMMSS_description.sql)
# Files must start with 14 digits
```

### Issue: "Failed to apply migration: syntax error"

**Cause:** SQL syntax error in migration file

**Solution:**

1. Check SQL syntax
2. Test SQL manually first:

   ```bash
   # SQLite
   sqlite3 data/bot.db < db/migrations/your_file.sql

   # PostgreSQL
   psql $DATABASE_URL < db/migrations/your_file.sql
   ```

3. Fix syntax and re-run

### Issue: Migration shows as applied but changes aren't there

**Cause:** Migration was marked as applied but SQL failed

**Solution:**

1. Check `schema_migrations` table:
   ```sql
   SELECT * FROM schema_migrations;
   ```
2. If migration is marked but changes missing:
   - Manually fix the database
   - Or remove from `schema_migrations` and re-run:
     ```sql
     DELETE FROM schema_migrations WHERE version = '20250101000000';
     ```

### Issue: Migrations run in wrong order

**Cause:** Timestamp format incorrect

**Solution:**

- Ensure filenames use format: `YYYYMMDDHHMMSS_description.sql`
- Use 14 digits for timestamp (no dashes or spaces)
- Example: `20250112143000_not_2025-01-12-14-30-00`

---

## Best Practices

### 1. Always Test Locally First

```bash
# Test with SQLite (local development)
npm run migrate

# Verify changes
sqlite3 data/bot.db ".schema"
```

### 2. Use Descriptive Migration Names

✅ **Good:**

- `20250112120000_add_user_email_index.sql`
- `20250112130000_create_notifications_table.sql`

❌ **Bad:**

- `20250112120000_update.sql`
- `20250112130000_changes.sql`

### 3. One Logical Change Per Migration

✅ **Good:**

- Migration 1: Add column
- Migration 2: Add index

❌ **Bad:**

- Migration 1: Add column, create table, add index, modify constraints

### 4. Use IF NOT EXISTS

Make migrations idempotent:

```sql
CREATE TABLE IF NOT EXISTS users (...);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 5. Test Idempotency

Always run migrations twice to verify:

```bash
npm run migrate
npm run migrate  # Should show "Database schema is up to date"
```

### 6. Review SQL Before Committing

- Check syntax
- Verify logic
- Test on SQLite first
- Review for potential data issues

### 7. Never Edit Applied Migrations

If you need to fix a migration:

- ✅ Create a new migration to fix it
- ❌ Don't edit the existing migration file

### 8. Backup Production Database

Before running migrations on production:

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Then run migrations
npm run migrate
```

### 9. Run Migrations Before Code Deployment

Best practice workflow:

```bash
# 1. Deploy code
git pull

# 2. Run migrations
npm run migrate

# 3. Start/restart application
npm start
```

### 10. Monitor Migration Execution

Check logs for:

- ✅ "Migration applied successfully"
- ✅ "Database schema is up to date"
- ❌ Any error messages

---

## Quick Reference

### Commands

```bash
# Run migrations
npm run migrate

# Test migrations
npm run test:migrate

# Check migration files
ls db/migrations/*.sql

# Check applied migrations (SQLite)
sqlite3 data/bot.db "SELECT * FROM schema_migrations;"

# Check applied migrations (PostgreSQL)
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"
```

### File Locations

- **Migration files**: `wwebjs-bot/db/migrations/`
- **Migration runner**: `wwebjs-bot/db/migrate.js`
- **Config**: `wwebjs-bot/src/config.js`
- **SQLite database**: `wwebjs-bot/data/bot.db` (local)

### Environment Variables

**Local (SQLite - default):**

```env
# Optional - defaults to SQLite
DB_TYPE=sqlite
DB_PATH=./data/bot.db
```

**Production (PostgreSQL - required):**

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NODE_ENV=production
```

---

## Summary Checklist

### Local Development

- [ ] Navigate to `wwebjs-bot/` directory
- [ ] Verify `.env` has SQLite config (or use defaults)
- [ ] Run `npm run migrate`
- [ ] Verify output shows "All migrations applied successfully"
- [ ] Run again to verify idempotency ("Database schema is up to date")

### Production Deployment

- [ ] Set `DATABASE_URL` environment variable
- [ ] Verify PostgreSQL connection works
- [ ] Navigate to project directory
- [ ] (Optional) Backup database
- [ ] Run `npm run migrate`
- [ ] Verify output shows successful application
- [ ] Check `schema_migrations` table in PostgreSQL
- [ ] Verify database schema changes

### Creating New Migration

- [ ] Generate timestamp (14 digits: YYYYMMDDHHMMSS)
- [ ] Create file: `db/migrations/YYYYMMDDHHMMSS_description.sql`
- [ ] Write SQL (use IF NOT EXISTS for idempotency)
- [ ] Test locally: `npm run migrate`
- [ ] Verify changes in database
- [ ] Commit to Git
- [ ] Deploy and run on production

---

**Need help?** Check the error message - it's designed to be clear and actionable. Review the Troubleshooting section above for common issues.


