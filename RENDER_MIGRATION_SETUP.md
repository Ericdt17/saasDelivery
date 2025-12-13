# Step 3: Configure Render for Docker Migrations

## Your Service Info
- **Service Name**: saasDelivery
- **Service Type**: Web Service (API)

## What We're Doing
We're configuring Render to:
1. Build Docker migration image
2. Run migrations BEFORE starting the API
3. Create `schema_migrations` table on dev database
4. Apply all pending migrations automatically

---

## Instructions for Render Dashboard

### Step 1: Go to Your Service
1. Log into Render dashboard: https://dashboard.render.com
2. Find your service: **saasDelivery**
3. Click on it to open settings

### Step 2: Update Build Command
1. Go to **Settings** tab
2. Find **Build Command** field
3. Replace it with this:

```bash
docker build -f docker/Dockerfile.migration -t migrations . && npm install
```

### Step 3: Update Start Command
1. Find **Start Command** field
2. Replace it with this:

```bash
docker run --rm -e DATABASE_URL=$DATABASE_URL -e NODE_ENV=$NODE_ENV migrations && npm run api
```

**OR** (if the above doesn't work, use this simpler version):

```bash
npm run migrate && npm run api
```

### Step 4: Verify Environment Variables
Make sure these are set in **Environment** tab:
- `DATABASE_URL` - Your PostgreSQL connection string (should already be set)
- `NODE_ENV` - Should be `development` or `production`

### Step 5: Save and Deploy
1. Click **Save Changes**
2. Render will automatically redeploy
3. Watch the logs to see migrations run

---

## What to Expect

When Render deploys, you should see in logs:
```
🔍 Detected database type: PostgreSQL
📋 Ensuring schema_migrations table exists...
✅ Found 0 applied migration(s)
📦 Found 2 migration file(s)
🔄 Applying 2 pending migration(s)...
✅ Migration applied successfully: 20250101000000_initial_schema.sql
✅ Migration applied successfully: 20250101120000_add_example_column.sql
✅ All migrations applied successfully!
```

Then your API will start normally.

---

## Troubleshooting

### If migrations fail:
- Check logs for error messages
- Verify `DATABASE_URL` is correct
- Make sure database is accessible from Render

### If API doesn't start:
- Check if migrations completed successfully
- Verify start command is correct
- Check API logs for errors

---

## Next Step
After you configure Render and it deploys successfully, let me know:
- "Step 3 complete" - if migrations ran successfully
- "Step 3 failed" - with error message

Then we'll move to Step 4: Configure Main/Production environment.

