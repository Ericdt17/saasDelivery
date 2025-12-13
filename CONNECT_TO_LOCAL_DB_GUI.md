# How to Connect to Local SQLite Database with GUI Tools

## Your Database Location

Based on your `.env` file, your database path is:

```
C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\local.db
```

**Note**: If `local.db` doesn't exist, the default is:

```
C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\bot.db
```

## Recommended GUI Tools for SQLite

### Option 1: DB Browser for SQLite (Recommended - Free & Easy)

**Download**: https://sqlitebrowser.org/

**Steps to Connect:**

1. Download and install DB Browser for SQLite
2. Open DB Browser for SQLite
3. Click **"Open Database"** button
4. Navigate to: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\`
5. Select `local.db` (or `bot.db` if local.db doesn't exist)
6. Click **Open**

**Features:**

- ✅ View all tables
- ✅ Browse data
- ✅ Edit data
- ✅ Run SQL queries
- ✅ Export data
- ✅ Free and open source

---

### Option 2: SQLiteStudio (Free & Powerful)

**Download**: https://sqlitestudio.pl/

**Steps to Connect:**

1. Download and install SQLiteStudio
2. Open SQLiteStudio
3. Click **"Add Database"** (database icon with +)
4. Click **"Add a file database"**
5. Navigate to: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\`
6. Select `local.db` (or `bot.db`)
7. Click **OK**

**Features:**

- ✅ More advanced features
- ✅ Better for complex queries
- ✅ Free and open source

---

### Option 3: DBeaver (Free - Supports Multiple Databases)

**Download**: https://dbeaver.io/download/

**Steps to Connect:**

1. Download and install DBeaver Community Edition
2. Open DBeaver
3. Click **"New Database Connection"** (plug icon)
4. Select **SQLite** from the list
5. Click **Next**
6. In **Path** field, click **Browse** button
7. Navigate to: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\`
8. Select `local.db` (or `bot.db`)
9. Click **Test Connection** → **Finish**

**Features:**

- ✅ Works with SQLite, PostgreSQL, MySQL, etc.
- ✅ Great if you use multiple database types
- ✅ Free community edition

---

### Option 4: VS Code Extension (If you use VS Code)

**Extension**: SQLite Viewer or SQLite

**Steps:**

1. Open VS Code
2. Install extension: **"SQLite Viewer"** or **"SQLite"**
3. Open the database file: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\local.db`
4. Right-click → **"Open Database"**

**Features:**

- ✅ Works directly in VS Code
- ✅ No separate application needed
- ✅ Good for quick viewing

---

## Quick Start Guide (DB Browser for SQLite)

### Step 1: Install

1. Go to https://sqlitebrowser.org/
2. Download **DB Browser for SQLite**
3. Install it

### Step 2: Open Your Database

1. Open DB Browser for SQLite
2. Click **"Open Database"**
3. Navigate to: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\`
4. Select `local.db` (or `bot.db`)
5. Click **Open**

### Step 3: Browse Your Data

1. Click on **"Browse Data"** tab
2. Select a table from the dropdown (e.g., `deliveries`, `agencies`, `groups`)
3. View and edit data in the table

### Step 4: Run SQL Queries

1. Click on **"Execute SQL"** tab
2. Type your SQL query:
   ```sql
   SELECT * FROM deliveries LIMIT 10;
   ```
3. Click **"Execute SQL"** (play button)

---

## Common Database Tables

Your database should have these tables:

- **`agencies`** - Agency/User accounts
- **`deliveries`** - Delivery records
- **`groups`** - WhatsApp groups
- **`delivery_history`** - History of delivery updates

### View All Tables:

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

### View Table Structure:

```sql
PRAGMA table_info(deliveries);
```

---

## Important Notes

### ⚠️ Database Locking

- **Close the bot/API server** before opening the database in a GUI tool
- SQLite locks the database file when in use
- If you get a "database is locked" error, stop the server first

### 🔒 Read-Only Mode

- Some GUI tools can open databases in read-only mode
- This allows viewing while the server is running
- Check your GUI tool's settings for this option

### 💾 Backup Before Editing

- Always backup your database before making changes
- Copy the `.db` file to a safe location
- Or use the GUI tool's export feature

---

## Troubleshooting

### Issue: "Database is locked"

**Solution**: Stop the bot/API server, then open the database

### Issue: "File not found"

**Solution**:

1. Check the exact path: `C:\Users\hp\Desktop\saasDelivery\wwebjs-bot\data\`
2. Look for `local.db` or `bot.db`
3. Make sure the file exists

### Issue: "Cannot open database"

**Solution**:

1. Check file permissions
2. Make sure the file isn't corrupted
3. Try opening with a different tool

---

## Quick Commands to Find Your Database

### PowerShell:

```powershell
cd C:\Users\hp\Desktop\saasDelivery\wwebjs-bot
Get-ChildItem data\*.db
```

### Command Prompt:

```cmd
cd C:\Users\hp\Desktop\saasDelivery\wwebjs-bot
dir data\*.db
```

---

## Recommended: DB Browser for SQLite

**Why I recommend it:**

- ✅ Simple and user-friendly
- ✅ Free and open source
- ✅ Perfect for viewing and editing SQLite databases
- ✅ No complex setup required
- ✅ Works great on Windows

**Download**: https://sqlitebrowser.org/

---

## Example: Viewing Deliveries

Once connected, try these queries:

```sql
-- View all deliveries
SELECT * FROM deliveries;

-- Count deliveries by status
SELECT status, COUNT(*) as count
FROM deliveries
GROUP BY status;

-- View recent deliveries
SELECT * FROM deliveries
ORDER BY created_at DESC
LIMIT 10;

-- View agencies
SELECT * FROM agencies;
```

---

## Need Help?

If you have issues connecting:

1. Check the database file exists at the path
2. Make sure the bot/API server is stopped
3. Try a different GUI tool
4. Check file permissions
