# Migration System Usage Guide

Quick reference for using the migration system.

## Commands

```bash
# Run migrations
npm run migrate
```

## Migration Files Location

```
db/migrations/
```

## File Naming

Format: `YYYYMMDDHHMMSS_description.sql`

Examples:
- `20250101120000_create_users_table.sql`
- `20250101130000_add_email_column.sql`
- `20250101140000_add_index.sql`

## Workflow

### 1. Create Migration File

```bash
# Create new file in db/migrations/
# Example: 20250112120000_add_new_feature.sql
```

### 2. Write SQL

```sql
-- PostgreSQL-compatible SQL
ALTER TABLE deliveries ADD COLUMN new_field TEXT;
```

### 3. Test Locally

```bash
npm run migrate
```

### 4. Commit to Git

```bash
git add db/migrations/20250112120000_add_new_feature.sql
git commit -m "Add new_field to deliveries table"
```

### 5. Deploy

Migrations run automatically or manually in production.

## Testing with Different Databases

### SQLite (Development - Default)

```bash
# Uses SQLite from config.DB_PATH
npm run migrate
```

### PostgreSQL (Production)

```bash
# Set DATABASE_URL environment variable
DATABASE_URL=postgresql://user:password@host:5432/database npm run migrate
```

Or in `.env` file:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Then:
```bash
npm run migrate
```

## Integration with Application

### Option 1: Manual Migration

Run migrations manually before starting server:
```bash
npm run migrate
npm start
```

### Option 2: Automatic on Startup

Add to your `server.js` or `index.js`:

```javascript
const { runMigrations } = require('./db/migrate');

async function start() {
  try {
    console.log('Running database migrations...');
    await runMigrations();
    console.log('Migrations complete');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  // Start your server
  app.listen(PORT, () => {
    console.log('Server started');
  });
}

start();
```

## Checking Migration Status

The system automatically shows:
- Number of applied migrations
- Number of pending migrations
- Which migrations are being applied

## Common Tasks

### Add a New Column

```sql
-- db/migrations/20250112120000_add_status_column.sql
ALTER TABLE deliveries ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
```

### Create a New Table

```sql
-- db/migrations/20250112130000_create_notifications_table.sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Add an Index

```sql
-- db/migrations/20250112140000_add_email_index.sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Add Foreign Key

```sql
-- db/migrations/20250112150000_add_foreign_key.sql
ALTER TABLE deliveries 
ADD CONSTRAINT fk_deliveries_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

## Tips

1. **Always test locally first** - Use SQLite to catch errors
2. **Use descriptive names** - Make it clear what the migration does
3. **Keep migrations small** - One logical change per file
4. **Use IF NOT EXISTS** - Makes migrations idempotent
5. **Review SQL** - Always check before committing

## Troubleshooting

### Migration Fails

1. Check SQL syntax
2. Verify dependencies (tables/columns exist)
3. Test on SQLite first
4. Check error message for details

### "Already Exists" Errors

Use `IF NOT EXISTS`:
```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
```

### Need to Rollback

**Note:** This system doesn't support automatic rollbacks. To undo:
1. Create a new migration that reverses the change
2. Or manually fix the database
3. Or restore from backup

---

For more details, see `db/migrations/README.md`











