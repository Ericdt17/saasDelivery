# Fix CORS 403 Error - Backend Configuration

## Problem Identified ✅

The OPTIONS request is reaching your backend (see `X-Powered-By: Express` in response), but the backend CORS is blocking it:

```json
{"success":false,"error":"CORS error","message":"Origin not allowed by CORS policy"}
```

## Root Cause

Your `ALLOWED_ORIGINS` environment variable is likely set to `*`, but the CORS logic in `server.js` doesn't handle `*` correctly. It expects either:
1. Empty/unset (allows all)
2. Comma-separated list of actual origins

## Solution

### Option 1: Set ALLOWED_ORIGINS to include your frontend origin

```bash
# On your VPS, find where your backend env vars are stored
# Check PM2 ecosystem or .env file
pm2 env api | grep ALLOWED_ORIGINS

# Or check your .env file location
# Common locations:
# - ~/.env
# - /opt/saasDelivery/wwebjs-bot/.env
# - PM2 ecosystem file

# Update ALLOWED_ORIGINS to include your IP/domain
ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238

# If you have a domain, add it too:
# ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238,http://yourdomain.com,https://yourdomain.com
```

### Option 2: Remove ALLOWED_ORIGINS (allows all origins)

```bash
# Remove or comment out ALLOWED_ORIGINS
# This will allow all origins (less secure, but works)
```

### Option 3: Fix the CORS logic to handle `*`

The backend CORS code needs to handle `ALLOWED_ORIGINS=*` properly.

---

## Step-by-Step Fix

### Step 1: Check Current ALLOWED_ORIGINS Value

```bash
# Check PM2 environment
pm2 env api | grep ALLOWED_ORIGINS

# Or check .env file
cat ~/.env | grep ALLOWED_ORIGINS
# or
cat /opt/saasDelivery/wwebjs-bot/.env | grep ALLOWED_ORIGINS
```

### Step 2: Update ALLOWED_ORIGINS

**If using PM2 ecosystem file:**
```bash
# Find ecosystem file
pm2 show api | grep "exec cwd"

# Edit the ecosystem file or .env file
nano /path/to/ecosystem.config.js
# or
nano ~/.env
```

**Set to:**
```bash
ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238
```

**Or if you want to allow all (less secure):**
```bash
# Remove the line or set to empty
# ALLOWED_ORIGINS=
```

### Step 3: Restart Backend

```bash
# Restart PM2 process
pm2 restart api

# Or reload environment
pm2 reload api
```

### Step 4: Test Again

```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost/api/v1/auth/login \
  -H "Origin: http://157.173.118.238" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Should now return 204 with CORS headers, not 403
```

### Step 5: Test in Browser

1. Clear browser cache
2. Open DevTools → Network tab
3. Try login
4. Should work now!

---

## Alternative: Fix CORS Code to Handle `*`

If you want `ALLOWED_ORIGINS=*` to work, update the CORS logic in `server.js`:

```javascript
// In wwebjs-bot/src/api/server.js, around line 30
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

// Add this check for wildcard
if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
  callback(new Error('Not allowed by CORS'));
}
```

But **Option 1** (setting actual origins) is more secure and recommended.

---

## Quick Fix Command

```bash
# Set ALLOWED_ORIGINS (adjust path to your .env file)
echo "ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238" >> ~/.env

# Or if using PM2 ecosystem, update it there
# Then restart
pm2 restart api

# Test
curl -X OPTIONS http://localhost/api/v1/auth/login \
  -H "Origin: http://157.173.118.238" \
  -v
```

---

## Summary

- ✅ Nginx is working correctly (proxying requests)
- ✅ Backend is receiving requests
- ❌ Backend CORS is blocking `http://157.173.118.238`
- ✅ Fix: Update `ALLOWED_ORIGINS` to include your frontend origin

