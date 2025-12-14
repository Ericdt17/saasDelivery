# Connect to Local Database - Step by Step Guide

## Option 1: Connect to Local PostgreSQL Database

### Prerequisites

1. **PostgreSQL must be installed** on your machine
   - Download from: https://www.postgresql.org/download/
   - Or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres`

2. **Database must exist**
   ```bash
   # Create database if it doesn't exist
   createdb deliverybot
   # OR using psql
   psql -U postgres -c "CREATE DATABASE deliverybot;"
   ```

---

### Method 1: Using psql Command Line (Recommended)

#### Step 1: Open Terminal/PowerShell

On Windows, open PowerShell or Command Prompt.

#### Step 2: Connect using DATABASE_URL

```bash
# If you have DATABASE_URL in your .env file
# First, load it (PowerShell):
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/deliverybot"
psql $env:DATABASE_URL

# OR directly:
psql postgresql://postgres:password@localhost:5432/deliverybot
```

#### Step 3: Connect using individual parameters

```bash
# Default connection (if PostgreSQL is running locally)
psql -h localhost -p 5432 -U postgres -d deliverybot

# You'll be prompted for password
```

#### Step 4: Verify connection

Once connected, you should see:
```
psql (14.x)
Type "help" for help.

deliverybot=#
```

#### Step 5: Useful commands

```sql
-- List all tables
\dt

-- Describe deliveries table structure
\d deliveries

-- View all deliveries
SELECT * FROM deliveries LIMIT 10;

-- Check migration status
SELECT * FROM schema_migrations ORDER BY version DESC;

-- Exit psql
\q
```

---

### Method 2: Using Environment Variables

#### Step 1: Create/Update .env file

In `wwebjs-bot` directory, create or update `.env`:

```env
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres:password@localhost:5432/deliverybot

# OR use individual parameters:
# PG_HOST=localhost
# PG_PORT=5432
# PG_USER=postgres
# PG_PASSWORD=password
# PG_DATABASE=deliverybot
```

**Replace:**
- `postgres` = your PostgreSQL username
- `password` = your PostgreSQL password
- `deliverybot` = your database name

#### Step 2: Test connection using Node.js script

```bash
cd wwebjs-bot
node src/test-postgres.js
```

**Expected output:**
```
✅ PostgreSQL connection successful
✅ Tables exist
✅ Can query deliveries
```

#### Step 3: Or use the general test script

```bash
node src/test-db-connection.js
```

---

### Method 3: Using GUI Tools

#### Option A: pgAdmin (PostgreSQL Official Tool)

1. **Download pgAdmin**: https://www.pgadmin.org/download/
2. **Install and open pgAdmin**
3. **Add Server:**
   - Right-click "Servers" → "Create" → "Server"
   - **General Tab:**
     - Name: `Local Delivery Bot`
   - **Connection Tab:**
     - Host: `localhost`
     - Port: `5432`
     - Database: `deliverybot`
     - Username: `postgres`
     - Password: `your_password`
   - Click "Save"

4. **Browse database:**
   - Expand: Servers → Local Delivery Bot → Databases → deliverybot → Schemas → public → Tables
   - Right-click `deliveries` → "View/Edit Data" → "All Rows"

#### Option B: DBeaver (Universal Database Tool)

1. **Download DBeaver**: https://dbeaver.io/download/
2. **Install and open DBeaver**
3. **New Database Connection:**
   - Click "New Database Connection" icon
   - Select "PostgreSQL"
   - **Main Tab:**
     - Host: `localhost`
     - Port: `5432`
     - Database: `deliverybot`
     - Username: `postgres`
     - Password: `your_password`
   - Click "Test Connection" → "Finish"

4. **Browse tables:**
   - Expand: deliverybot → Schemas → public → Tables
   - Double-click `deliveries` to view data

#### Option C: VS Code Extension

1. **Install Extension**: "PostgreSQL" by Chris Kolkman
2. **Add Connection:**
   - Click PostgreSQL icon in sidebar
   - Click "+" to add connection
   - Enter connection details:
     ```
     Host: localhost
     Port: 5432
     Database: deliverybot
     User: postgres
     Password: your_password
     ```
3. **Browse database** from VS Code sidebar

---

### Method 4: Connect via Application Code

#### Step 1: Set up .env file

```env
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres:password@localhost:5432/deliverybot
```

#### Step 2: Test in Node.js REPL

```bash
cd wwebjs-bot
node

# In Node.js REPL:
const { adapter } = require('./src/db');
adapter.query('SELECT NOW()').then(console.log);
```

#### Step 3: Run application

```bash
npm run api
# Application will connect automatically using .env settings
```

---

## Option 2: Connect to Local SQLite Database

If you're using SQLite locally (default for development):

### Method 1: Using SQLite Command Line

```bash
cd wwebjs-bot
sqlite3 data/bot.db

# Useful commands:
.tables          # List all tables
.schema deliveries  # Show table structure
SELECT * FROM deliveries LIMIT 10;  # Query data
.quit            # Exit
```

### Method 2: Using GUI Tools

#### DB Browser for SQLite

1. **Download**: https://sqlitebrowser.org/
2. **Open**: `wwebjs-bot/data/bot.db`
3. **Browse tables** and run queries

#### VS Code Extension

1. **Install**: "SQLite Viewer" extension
2. **Open**: `wwebjs-bot/data/bot.db`
3. **Browse** tables in sidebar

---

## Troubleshooting

### Issue: "psql: command not found"

**Solution:**
- **Windows**: Add PostgreSQL bin directory to PATH
  - Usually: `C:\Program Files\PostgreSQL\14\bin`
  - Or use full path: `"C:\Program Files\PostgreSQL\14\bin\psql.exe"`
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql-client`

### Issue: "password authentication failed"

**Solution:**
1. Check password in `.env` matches PostgreSQL password
2. Reset PostgreSQL password:
   ```bash
   psql -U postgres
   ALTER USER postgres WITH PASSWORD 'newpassword';
   ```

### Issue: "database does not exist"

**Solution:**
```bash
# Create database
createdb deliverybot
# OR
psql -U postgres -c "CREATE DATABASE deliverybot;"
```

### Issue: "connection refused"

**Solution:**
1. **Check PostgreSQL is running:**
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Mac/Linux
   sudo systemctl status postgresql
   ```

2. **Start PostgreSQL:**
   ```bash
   # Windows
   net start postgresql-x64-14
   
   # Mac (Homebrew)
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

3. **Check port 5432 is not blocked** by firewall

### Issue: "role does not exist"

**Solution:**
```bash
# Create user/role
psql -U postgres
CREATE USER postgres WITH PASSWORD 'password';
ALTER USER postgres CREATEDB;
```

---

## Quick Connection Strings

### PostgreSQL Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]
```

### Examples

```bash
# Local default
postgresql://postgres:password@localhost:5432/deliverybot

# With custom user
postgresql://myuser:mypass@localhost:5432/deliverybot

# Different port
postgresql://postgres:password@localhost:5433/deliverybot

# Remote server
postgresql://user:pass@192.168.1.100:5432/deliverybot
```

---

## Verify Connection Works

### Test Query

```sql
-- Connect to database first
psql postgresql://postgres:password@localhost:5432/deliverybot

-- Run test queries
SELECT COUNT(*) FROM deliveries;
SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 5;
\d deliveries  -- Show table structure
```

### Expected Results

- ✅ Connection successful
- ✅ Can see `deliveries` table
- ✅ Can query data
- ✅ Table has all expected columns (including `whatsapp_message_id`)

---

## Next Steps

After connecting successfully:

1. **Check schema**: `\d deliveries`
2. **Verify migrations**: `SELECT * FROM schema_migrations;`
3. **Test insert**: See `QUICK_FIX_CHECKLIST.md`
4. **Run migrations** if needed: `npm run migrate`

---

## Quick Reference

| Method | Command |
|--------|---------|
| **psql (DATABASE_URL)** | `psql $DATABASE_URL` |
| **psql (params)** | `psql -h localhost -U postgres -d deliverybot` |
| **Test script** | `node src/test-postgres.js` |
| **SQLite** | `sqlite3 data/bot.db` |
| **GUI (pgAdmin)** | Install pgAdmin, add server |
| **GUI (DBeaver)** | Install DBeaver, new PostgreSQL connection |

---

**Need help?** Check the error message and refer to the Troubleshooting section above.


