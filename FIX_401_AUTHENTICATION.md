# Fix 401 Unauthorized - Create/Verify User Account

## ✅ Great Progress!

You've fixed the CORS issue! The 401 error means:
- ✅ CORS is working (no more 403)
- ✅ Nginx is proxying correctly
- ✅ Backend is receiving requests
- ❌ Authentication failed (wrong credentials or user doesn't exist)

---

## Step 1: Create Super Admin Account

On your VPS, run the seed script to create a super admin:

```bash
# Navigate to backend directory
cd /opt/saasDelivery/wwebjs-bot

# Create super admin (default credentials)
node src/scripts/seed-super-admin.js
```

**Default credentials:**
- Email: `admin@livrexpress.com`
- Password: `admin123`

**Or create with custom credentials:**
```bash
node src/scripts/seed-super-admin.js \
  --email admin@livrexpress.com \
  --password admin123 \
  --name "Super Administrator"
```

---

## Step 2: Verify User Was Created

The script will tell you if the user already exists or was created. You should see:

```
✅ Super admin created successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ID: 1
   Name: Super Administrator
   Email: admin@livrexpress.com
   Password: admin123
   Role: super_admin
   Status: Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 3: Test Login via API

Test the login with the correct credentials:

```bash
# Test login
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}'
```

**Expected response (success):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Super Administrator",
      "email": "admin@livrexpress.com",
      "role": "super_admin"
    }
  }
}
```

**If still 401, check:**
- Email is correct (case-sensitive)
- Password is correct
- Account is active (`is_active = true`)

---

## Step 4: Test in Browser

1. Open your frontend: `http://157.173.118.238`
2. Go to login page
3. Enter credentials:
   - Email: `admin@livrexpress.com`
   - Password: `admin123`
4. Click login

**Should work now!** ✅

---

## Troubleshooting

### Issue: "Super admin already exists"

If the script says the user already exists but login fails:

1. **Check if account is active:**
```bash
# Connect to your database and check
# For PostgreSQL:
psql $DATABASE_URL -c "SELECT id, email, role, is_active FROM agencies WHERE email = 'admin@livrexpress.com';"
```

2. **Reset password:**
   - You may need to update the password hash manually, or
   - Delete and recreate the user

### Issue: "Database tables not initialized"

If you see this error:
```
❌ Error: The 'agencies' table does not exist in your database.
```

Run the migration first:
```bash
cd /opt/saasDelivery/wwebjs-bot
npm run migrate:postgres
# or
node src/scripts/migrate-postgresql-schema.js
```

### Issue: Still getting 401 after creating user

1. **Verify user exists:**
```bash
# Check database directly
# Or check backend logs
pm2 logs api --lines 50
```

2. **Check password:**
   - Make sure you're using the exact password you set
   - Passwords are case-sensitive

3. **Check account status:**
   - Make sure `is_active = true` in database

---

## Quick Test Commands

```bash
# 1. Create super admin
cd /opt/saasDelivery/wwebjs-bot
node src/scripts/seed-super-admin.js

# 2. Test login
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}'

# 3. If successful, test with token
TOKEN="your_token_here"
curl http://localhost/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Summary

- ✅ CORS fixed (403 → 401)
- ✅ Nginx working
- ✅ Backend working
- ⚠️ Need to create/verify user account
- ✅ Use seed script to create super admin
- ✅ Test with default credentials: `admin@livrexpress.com` / `admin123`

After creating the user, login should work! 🎉


