# 🧪 Migration System Testing Guide

Complete step-by-step guide to test the migration system.

## Prerequisites

1. Node.js installed
2. Dependencies installed: `npm install`
3. (Optional) PostgreSQL for production testing

## Step 1: Run the Test Suite

Start with the automated test suite to verify all components work:

```bash
cd wwebjs-bot
npm run test:migrations
```

**Expected Output:**

```
======================================================================
Migration System Test Suite
======================================================================

▶ Testing: Schema Introspection
  ✅ Schema extraction works correctly
  ℹ️  Found 5 columns, 1 indexes
  ✅ Schema hash generation works

▶ Testing: Schema Comparison
  ✅ Schema comparison detects changes
  ✅ Schema diff correctly identifies new column

...

======================================================================
Test Results Summary
======================================================================
✅ All 8 tests passed!
======================================================================
```

**If tests fail:**

- Run with verbose mode: `npm run test:migrations:verbose`
- Check for error messages
- Ensure dependencies are installed (`npm install`)

---

## Step 2: Check Current Setup

Verify your current database configuration:

```bash
# Check if SQLite database exists
ls -la data/local.db

# Or on Windows:
dir data\local.db

# Check current migrations
ls -la src/migrations/*.sql
```

**Expected:**

- SQLite database should exist (or will be created)
- May or may not have migration files yet (that's OK)

---

## Step 3: Test Migration Generation (Development)

### 3.1: Check Current Schema

First, see what the current schema looks like:

```bash
# This will show current state
npm run migrate:dev -- --verbose
```

**If no migrations exist yet:**

- You'll see "No schema changes detected" or it will generate the initial migration

### 3.2: Make a Schema Change

Now let's test by making a change to the SQLite schema. You can do this in two ways:

**Option A: Use SQLite directly**

```bash
# Install sqlite3 CLI if needed (or use better-sqlite3 programmatically)
# Or use a SQLite GUI tool like DB Browser for SQLite
```

**Option B: Create a test script**

Create `test-schema-change.js` in the root:

```javascript
const Database = require("better-sqlite3");
const path = require("path");
const config = require("./src/config");

const db = new Database(config.DB_PATH);
db.pragma("journal_mode = WAL");

// Add a test column
try {
  db.exec(`ALTER TABLE deliveries ADD COLUMN test_field TEXT`);
  console.log("✅ Added test_field column to deliveries table");
} catch (error) {
  console.log("ℹ️  Column may already exist:", error.message);
}

db.close();
```

Run it:

```bash
node test-schema-change.js
```

### 3.3: Generate Migration

After making the schema change, generate the migration:

```bash
npm run migrate:dev
```

**Expected Output:**

```
🔍 Analyzing SQLite schema...
📊 Current schema hash: abc12345...
📋 Found 4 table(s)
🔧 Generating migration SQL...
✔ PostgreSQL migration updated based on SQLite schema changes.
   File: 20250108143000_add_test_field_to_deliveries.sql
   Changes: 1 statement(s)
```

**Check the generated file:**

```bash
cat src/migrations/20250108143000_*.sql
# Or on Windows:
type src\migrations\20250108143000_*.sql
```

**Expected content:**

```sql
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS test_field TEXT;
```

### 3.4: Check Migration Status

```bash
npm run migrate:status
```

**Note:** This requires DATABASE_URL. If you don't have PostgreSQL set up, skip this step.

---

## Step 4: Test Multiple Schema Changes

Let's test the system with multiple changes:

### 4.1: Add Another Column

Add another test column:

```javascript
// In test-schema-change.js or directly via SQLite
const db = new Database(config.DB_PATH);
db.exec(`ALTER TABLE deliveries ADD COLUMN another_test INTEGER DEFAULT 0`);
db.close();
```

### 4.2: Generate Migration Again

```bash
npm run migrate:dev
```

**Expected:** New migration file created with both changes (or just the new one if already tracked)

### 4.3: Verify State Tracking

Check the state file:

```bash
cat src/migrations/state.json
```

**Expected:** Should contain:

- `lastSchemaHash` - Current schema hash
- `lastSchema` - Full schema structure
- `migrations` - Array of migration files

---

## Step 5: Test No-Change Detection

The system should detect when there are no changes:

```bash
npm run migrate:dev
```

**Expected Output:**

```
✔ No schema changes detected. Use --force to generate migration anyway.
```

**Force generation (if needed):**

```bash
npm run migrate:dev -- --force
```

---

## Step 6: Test Auto-Generation Hook

Test that migrations are generated automatically:

### 6.1: Reset State (Simulate First Run)

```bash
# Backup current state
cp src/migrations/state.json src/migrations/state.json.backup

# Clear last schema hash to simulate new state
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('src/migrations/state.json'));
state.lastSchemaHash = null;
fs.writeFileSync('src/migrations/state.json', JSON.stringify(state, null, 2));
"
```

### 6.2: Trigger Schema Initialization

Restart your development server or reinitialize the database:

```bash
# This should trigger auto-generation
npm run api:dev
```

**Watch for:** Automatic migration generation message in the console

---

## Step 7: Test with PostgreSQL (Optional)

If you have PostgreSQL set up:

### 7.1: Set DATABASE_URL

```bash
# Set environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/database"

# Or on Windows:
set DATABASE_URL=postgresql://user:password@localhost:5432/database

# Or add to .env file
echo DATABASE_URL=postgresql://user:password@localhost:5432/database >> .env
```

### 7.2: Check Migration Status

```bash
npm run migrate:status
```

**Expected Output:**

```
📊 Checking migration status...

📋 Migration Status:
   Total migrations: 2
   Applied: 0
   Pending: 2

⏳ Pending migrations:
   - 20250108143000_add_test_field_to_deliveries.sql
   - 20250108150000_add_another_test.sql
```

### 7.3: Dry Run (See What Would Be Applied)

```bash
npm run migrate:prod -- --dry-run
```

**Expected Output:**

```
🔍 DRY RUN - Checking pending migrations...

🔍 DRY RUN - Would apply the following migrations:
   - 20250108143000_add_test_field_to_deliveries.sql
   - 20250108150000_add_another_test.sql
```

### 7.4: Apply Migrations

```bash
npm run migrate:prod
```

**Expected Output:**

```
🔧 Applying migrations to PostgreSQL...

📦 Found 2 pending migration(s)
🔄 Applying migration: 20250108143000_add_test_field_to_deliveries.sql
✅ Applied: 20250108143000_add_test_field_to_deliveries.sql
🔄 Applying migration: 20250108150000_add_another_test.sql
✅ Applied: 20250108150000_add_another_test.sql

✅ Successfully applied 2 migration(s)
```

### 7.5: Verify Application

Check the PostgreSQL database to confirm changes:

```sql
-- Connect to PostgreSQL
psql postgresql://user:password@localhost:5432/database

-- Check if columns exist
\d deliveries

-- Or
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deliveries'
AND column_name LIKE 'test%';
```

---

## Step 8: Test Production Startup

Test that migrations run automatically on production startup:

### 8.1: Set Production Environment

```bash
export NODE_ENV=production
export DATABASE_URL="postgresql://user:password@localhost:5432/database"
```

### 8.2: Start Server

```bash
npm run api
```

**Watch for:**

```
🔧 Running database migrations...
📦 Found 2 pending migration(s)
🔄 Applying migration: ...
✅ Applied: ...
✅ Successfully applied 2 migration(s)

🚀 API Server running on http://localhost:3000
```

**Important:** Server should NOT start if migrations fail!

---

## Step 9: Test Environment Guards

### 9.1: Test Production Guard (Should Fail)

```bash
# Try to use without DATABASE_URL
export NODE_ENV=production
unset DATABASE_URL  # Or on Windows: set DATABASE_URL=

# Try to start (should fail)
npm run api
```

**Expected:** Error message about DATABASE_URL being required

### 9.2: Test SQLite Guard (Should Work in Dev)

```bash
# Development mode (default)
unset NODE_ENV  # Or on Windows: set NODE_ENV=

# Should work fine with SQLite
npm run api:dev
```

**Expected:** Uses SQLite, no errors

---

## Step 10: Clean Up Test Data

After testing, clean up:

```bash
# Remove test columns from SQLite
node -e "
const Database = require('better-sqlite3');
const config = require('./src/config');
const db = new Database(config.DB_PATH);
try { db.exec('ALTER TABLE deliveries DROP COLUMN test_field'); } catch(e) {}
try { db.exec('ALTER TABLE deliveries DROP COLUMN another_test'); } catch(e) {}
db.close();
"

# Remove test migration files (optional)
rm src/migrations/20250108143000_*.sql
rm src/migrations/20250108150000_*.sql

# Restore state backup (if you made one)
# cp src/migrations/state.json.backup src/migrations/state.json
```

---

## Quick Test Checklist

Use this checklist to verify everything works:

- [ ] Test suite passes (`npm run test:migrations`)
- [ ] Can generate migration from schema change
- [ ] Migration file created in `src/migrations/`
- [ ] State file updated correctly
- [ ] No-change detection works
- [ ] Auto-generation works on schema init
- [ ] (Optional) Can check status with PostgreSQL
- [ ] (Optional) Can apply migrations to PostgreSQL
- [ ] (Optional) Migrations run on production startup
- [ ] Environment guards work correctly

---

## Common Issues & Solutions

### Issue: "No schema changes detected" but I made changes

**Solution:**

```bash
npm run migrate:dev -- --force
```

### Issue: Can't find SQLite database

**Solution:**

- Check `data/local.db` exists
- Or set `DB_PATH` in `.env`

### Issue: Migration status requires DATABASE_URL

**Solution:**

- This is expected - status check needs PostgreSQL connection
- Skip this step if you don't have PostgreSQL set up
- Or set `DATABASE_URL` in `.env`

### Issue: Tests fail

**Solution:**

```bash
# Check dependencies
npm install

# Run with verbose output
npm run test:migrations:verbose

# Check Node.js version (should be 14+)
node --version
```

---

## Success Criteria

You'll know the system is working if:

1. ✅ Test suite passes all tests
2. ✅ Can generate migrations from schema changes
3. ✅ Migration files are created correctly
4. ✅ State tracking works
5. ✅ Auto-generation triggers on schema init
6. ✅ (Optional) Can apply migrations to PostgreSQL
7. ✅ Environment guards prevent cross-environment usage

---

## Next Steps

Once testing is complete:

1. **Review generated migrations** - Check SQL is correct
2. **Commit migration files** - Add to version control
3. **Test in staging** - Apply migrations to staging PostgreSQL
4. **Deploy to production** - Migrations will run automatically

---

## Need Help?

- Check `src/migrations/README.md` for detailed documentation
- Check `MIGRATION_SYSTEM_COMPLETE.md` for system overview
- Review test suite output for specific component failures
- Check error messages - they should be descriptive
