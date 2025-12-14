# Production Delivery Registration Debugging Guide

## Problem
Deliveries are not being registered in production environment.

## Root Cause Analysis

The issue likely stems from one or more of the following:

1. **Missing Database Column**: The `whatsapp_message_id` column may be missing from the `deliveries` table
2. **Database Connection Issues**: PostgreSQL connection may be failing silently
3. **Schema Mismatch**: Database schema may not match the expected structure
4. **Error Handling**: Errors may be caught but not logged properly
5. **Migration Status**: Migrations may not have been run in production

---

## Step-by-Step Debugging Process

### Step 1: Check Database Connection

**On Production Server:**

```bash
# SSH into your production server or use Render shell
# Test PostgreSQL connection
psql $DATABASE_URL

# Or if using individual connection params:
psql -h $PG_HOST -U $PG_USER -d $PG_DATABASE
```

**Expected:** Should connect successfully

**If connection fails:**
- Check `DATABASE_URL` environment variable
- Verify database credentials
- Check network/firewall rules

---

### Step 2: Verify Database Schema

**Check if deliveries table exists:**

```sql
-- Connect to database
\c deliverybot  -- or your database name

-- List all tables
\dt

-- Check deliveries table structure
\d deliveries
```

**Expected columns in `deliveries` table:**
- `id` (SERIAL PRIMARY KEY)
- `phone` (VARCHAR(20))
- `customer_name` (VARCHAR(255))
- `items` (TEXT)
- `amount_due` (DECIMAL(10, 2))
- `amount_paid` (DECIMAL(10, 2))
- `status` (VARCHAR(20))
- `quartier` (VARCHAR(255))
- `notes` (TEXT)
- `carrier` (VARCHAR(255))
- `group_id` (INTEGER)
- `agency_id` (INTEGER)
- **`whatsapp_message_id` (VARCHAR(255))** ⚠️ **CRITICAL - Often missing**
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### Step 3: Check for Missing Column

**Check if `whatsapp_message_id` column exists:**

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deliveries' 
AND column_name = 'whatsapp_message_id';
```

**If column is missing**, add it:

```sql
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id 
ON deliveries(whatsapp_message_id);
```

---

### Step 4: Check Migration Status

**Check if migrations have been run:**

```sql
-- Check if schema_migrations table exists
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 10;
```

**If table doesn't exist**, migrations haven't been run. Run them:

```bash
# On production server
cd wwebjs-bot
npm run migrate
```

---

### Step 5: Check Application Logs

**On Render Dashboard:**
1. Go to your service → Logs
2. Look for errors related to:
   - Database connection
   - INSERT failures
   - Column not found errors

**Common error patterns:**

```
❌ PostgreSQL Query Error: column "whatsapp_message_id" does not exist
❌ Failed to initialize PostgreSQL database
❌ Unexpected PostgreSQL pool error
```

**Check for successful delivery creation logs:**

```
✅ LIVRAISON #123 ENREGISTRÉE AVEC SUCCÈS!
```

---

### Step 6: Test Database Insert Manually

**Test if INSERT works:**

```sql
-- Test insert (should succeed)
INSERT INTO deliveries 
(phone, customer_name, items, amount_due, status, whatsapp_message_id)
VALUES 
('+1234567890', 'Test Customer', 'Test Item', 1000.00, 'pending', 'test_msg_id')
RETURNING id;

-- Check if it was inserted
SELECT * FROM deliveries WHERE phone = '+1234567890' ORDER BY created_at DESC LIMIT 1;

-- Clean up test
DELETE FROM deliveries WHERE phone = '+1234567890';
```

**If INSERT fails**, note the exact error message.

---

### Step 7: Check Environment Variables

**Verify production environment variables:**

```bash
# On Render, check Environment tab
# Required variables:
DATABASE_URL=postgresql://...
NODE_ENV=production
DB_TYPE=postgres
```

**Verify DATABASE_URL format:**
```
postgresql://username:password@host:port/database
```

---

### Step 8: Test API Endpoint

**Test delivery creation via API:**

```bash
# Replace with your production API URL
curl -X POST https://your-api.onrender.com/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phone": "+1234567890",
    "customer_name": "Test Customer",
    "items": "Test Item",
    "amount_due": 1000,
    "status": "pending"
  }'
```

**Check response:**
- Success: `{"success": true, "data": {...}}`
- Error: Check error message for details

---

### Step 9: Check WhatsApp Bot Logs

**If deliveries come from WhatsApp:**

Look for these log patterns:

```
✅ LIVRAISON #123 ENREGISTRÉE AVEC SUCCÈS!
❌ Erreur lors de la sauvegarde: [error message]
```

**Common issues:**
- Database connection timeout
- Missing column errors
- Foreign key constraint violations

---

## Quick Fixes

### Fix 1: Add Missing Column

```sql
-- Connect to production database
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id 
ON deliveries(whatsapp_message_id);
```

### Fix 2: Run Migrations

```bash
# On production server
cd wwebjs-bot
npm run migrate
```

### Fix 3: Update Postgres Adapter (if needed)

The `postgres-adapter.js` file may need to include `whatsapp_message_id` in its `initTables()` function. Check if the column is added in the adapter's initialization.

### Fix 4: Restart Application

After making schema changes:

```bash
# On Render: Use "Manual Deploy" → "Clear build cache & deploy"
# Or restart the service
```

---

## Verification Steps

After applying fixes:

1. **Check schema:**
```sql
\d deliveries
```

2. **Test insert:**
```sql
INSERT INTO deliveries (phone, customer_name, items, amount_due, whatsapp_message_id)
VALUES ('+9999999999', 'Test', 'Test', 100, 'test123')
RETURNING id;
```

3. **Check application logs** for successful delivery creation

4. **Test via WhatsApp** or API to create a real delivery

---

## Common Error Messages & Solutions

### Error: "column whatsapp_message_id does not exist"
**Solution:** Run Fix 1 above

### Error: "relation deliveries does not exist"
**Solution:** Run migrations: `npm run migrate`

### Error: "connection refused" or "timeout"
**Solution:** 
- Check DATABASE_URL
- Verify database is running
- Check firewall/network rules

### Error: "permission denied"
**Solution:**
- Check database user permissions
- Verify user can CREATE/INSERT/UPDATE tables

### Error: "foreign key constraint violation"
**Solution:**
- Check if `agency_id` or `group_id` values exist in their respective tables
- Use NULL if references don't exist

---

## Prevention

1. **Always run migrations** before deploying to production
2. **Test schema changes** in staging first
3. **Monitor logs** regularly for database errors
4. **Use migration system** instead of manual schema changes
5. **Add database health checks** to your application

---

## Need More Help?

If issues persist:

1. **Collect logs:**
   - Application logs (last 100 lines)
   - Database error logs
   - Migration output

2. **Check database:**
   - Table structure (`\d deliveries`)
   - Recent inserts (`SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 10`)
   - Migration status (`SELECT * FROM schema_migrations`)

3. **Test locally** with production DATABASE_URL (be careful!)

---

## Emergency Rollback

If deliveries are critical and system is down:

1. **Temporarily disable WhatsApp bot** (if causing issues)
2. **Use API directly** with proper error handling
3. **Manually insert critical deliveries** via SQL (last resort)
4. **Fix schema issues** before re-enabling automated system


