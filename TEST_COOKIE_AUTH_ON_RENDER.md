# Testing Cookie Authentication on Render

## Overview

Yes, all tests work against Render! The test script accepts a URL parameter, so you can test your production backend directly.

## Quick Test Against Render

```bash
# From wwebjs-bot directory
node src/scripts/test-cookie-auth.js https://your-backend.onrender.com

# With production environment flag
NODE_ENV=production node src/scripts/test-cookie-auth.js https://your-backend.onrender.com
```

## Prerequisites

1. **Backend deployed on Render** with the latest code (cookie authentication)
2. **Environment variables set correctly** on Render:
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS` includes your frontend URL
   - `DATABASE_URL` configured
   - `JWT_SECRET` set

3. **Test credentials** available in your Render database

## Running Tests Against Render

### Step 1: Get Your Render Backend URL

From Render Dashboard → Your Backend Service → URL:
- Example: `https://saas-delivery-api.onrender.com`

### Step 2: Run Tests

```bash
cd wwebjs-bot

# Basic test
node src/scripts/test-cookie-auth.js https://saas-delivery-api.onrender.com

# With custom credentials
TEST_EMAIL=admin@livrexpress.com TEST_PASSWORD=yourpassword \
  node src/scripts/test-cookie-auth.js https://saas-delivery-api.onrender.com

# Production mode (enables production cookie checks)
NODE_ENV=production node src/scripts/test-cookie-auth.js https://saas-delivery-api.onrender.com
```

### Step 3: Verify Results

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║     HTTP-Only Cookie Authentication Test Suite              ║
╚════════════════════════════════════════════════════════════╝

📍 Base URL: https://saas-delivery-api.onrender.com
🌍 Environment: production

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Test: 1. Login Flow - Valid Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Status: 200
  ✅ Response has success: true
  ✅ Token is NOT in response body ✅
  ✅ User data received: Admin (admin@livrexpress.com)
  ✅ auth_token cookie is set
  ✅ Cookie is HttpOnly ✅
  ✅ Cookie is Secure in production ✅
  ✅ Cookie SameSite is 'none' (cross-domain) ✅

...

📊 Total Tests: 11
✅ Passed: 11
❌ Failed: 0
📈 Success Rate: 100.0%

🎉 All tests passed!
```

## Important: Cookie Settings for Render

The implementation automatically uses the correct cookie settings for production:

```javascript
// In wwebjs-bot/src/api/routes/auth.js
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,        // true on Render (HTTPS)
  sameSite: isProduction ? "none" : "lax",  // "none" for cross-domain
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};
```

**For Render (Production):**
- ✅ `Secure: true` (HTTPS required)
- ✅ `SameSite: None` (cross-domain: Vercel frontend + Render backend)
- ✅ `HttpOnly: true` (JavaScript cannot access)

## Verification Checklist

After running tests, verify:

- [ ] ✅ Login returns 200
- [ ] ✅ Token NOT in response body
- [ ] ✅ Cookie set with correct attributes
- [ ] ✅ Cookie automatically sent on subsequent requests
- [ ] ✅ Protected routes work with cookie
- [ ] ✅ Logout clears cookie
- [ ] ✅ Invalid credentials return 401
- [ ] ✅ Missing cookie returns 401

## Troubleshooting

### Issue: Tests fail with CORS error

**Solution:**
1. Check `ALLOWED_ORIGINS` in Render environment variables
2. Should include: `https://your-frontend.vercel.app` (or your frontend URL)
3. Redeploy backend after updating

### Issue: Cookie not being set

**Check:**
1. `NODE_ENV=production` is set on Render
2. Backend is using HTTPS (Render provides this automatically)
3. Cookie-parser middleware is installed (already done)

### Issue: Cookie not sent on requests

**Check:**
1. Test script includes cookies in requests (already implemented)
2. CORS allows credentials (already configured)

### Issue: "Token in response" error

**Solution:**
1. Ensure latest code is deployed to Render
2. Check Render logs to verify code is running
3. Redeploy if needed

## Testing Cross-Domain Setup

Since your frontend is on Vercel and backend on Render:

1. **Test from browser** (most accurate):
   - Open frontend URL: `https://your-frontend.vercel.app`
   - Open DevTools → Network tab
   - Log in
   - Verify cookie is set with `SameSite=None; Secure`

2. **Test from command line**:
   ```bash
   # Test against Render
   node src/scripts/test-cookie-auth.js https://your-backend.onrender.com
   ```

## Production Cookie Requirements

For cross-domain (Vercel + Render), cookies MUST have:
- ✅ `Secure=true` (HTTPS only)
- ✅ `SameSite=None` (allows cross-domain)
- ✅ `HttpOnly=true` (XSS protection)

**Note:** `SameSite=None` requires `Secure=true` in modern browsers.

## Quick Verification Script

Create a simple test:

```bash
# test-render.sh
#!/bin/bash
BACKEND_URL="https://your-backend.onrender.com"
echo "Testing: $BACKEND_URL"
node wwebjs-bot/src/scripts/test-cookie-auth.js "$BACKEND_URL"
```

Run:
```bash
chmod +x test-render.sh
./test-render.sh
```

## Next Steps

1. ✅ Run tests against Render
2. ✅ Verify all tests pass
3. ✅ Test in browser (frontend on Vercel)
4. ✅ Verify authentication persists across refreshes
5. ✅ Test logout functionality

## Summary

**Yes, all tests work against Render!** The test script is designed to work with any backend URL (local or remote). Just provide your Render backend URL as an argument.

The cookie authentication implementation is production-ready and correctly configured for cross-domain scenarios (Vercel frontend + Render backend).

