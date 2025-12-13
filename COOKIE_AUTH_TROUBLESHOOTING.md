# Cookie Authentication Troubleshooting Guide

## Issues Reported
1. ❌ No data displayed on super admin dashboard (API calls failing)
2. ❌ User logged out after page refresh

## Root Causes

### Issue 1: Cookies Not Being Sent
**Symptoms:**
- API calls return 401 Unauthorized
- No data loads on dashboard
- Network tab shows requests without `Cookie` header

**Possible Causes:**
1. **Vite Proxy Not Forwarding Cookies** (if using proxy)
2. **CORS Configuration** (if using direct connection)
3. **Cookie Domain/Path Mismatch**

### Issue 2: Auth Check Failing on Refresh
**Symptoms:**
- User logged out after page refresh
- `/api/v1/auth/me` returns 401

**Possible Causes:**
1. Cookie not persisted (expired or cleared)
2. Cookie not sent with request
3. Backend not reading cookie correctly

## Solutions

### Solution 1: Verify Vite Proxy Configuration

**Check your `.env.local` file:**
```bash
# Option A: Use Vite Proxy (Recommended for local dev)
VITE_API_BASE_URL=

# Option B: Direct Connection (Requires CORS)
VITE_API_BASE_URL=http://localhost:3000
```

**If using Option A (Proxy):**
1. Restart Vite dev server after changes
2. Cookies should work automatically (same-origin)
3. Check browser DevTools → Application → Cookies
   - Should see `auth_token` cookie for `localhost:8080`

**If using Option B (Direct Connection):**
1. Ensure backend CORS allows `http://localhost:8080`
2. Ensure `credentials: true` in CORS config (already done)
3. Cookies must have correct `SameSite` attribute

### Solution 2: Check Browser Cookies

**In Browser DevTools:**
1. Open DevTools (F12)
2. Go to **Application** tab → **Cookies**
3. Check for `auth_token` cookie:
   - **Domain**: Should be `localhost` or `localhost:8080`
   - **Path**: Should be `/`
   - **HttpOnly**: ✅ (you won't see this, but it's set)
   - **Secure**: ❌ (for localhost HTTP)
   - **SameSite**: `Lax` (for localhost)

**If cookie is missing:**
- Login again
- Check Network tab → Login request → Response headers
- Look for `Set-Cookie: auth_token=...`

### Solution 3: Verify API Requests Include Cookies

**In Browser DevTools:**
1. Open **Network** tab
2. Make a request (e.g., refresh dashboard)
3. Click on the request → **Headers** tab
4. Check **Request Headers**:
   - Should see: `Cookie: auth_token=...`

**If Cookie header is missing:**
- Check `credentials: 'include'` is set (already done in `api.ts`)
- Check CORS allows credentials (already done in `server.js`)
- If using proxy, restart Vite dev server

### Solution 4: Check Backend Logs

**Look for these logs:**
```
[Auth Middleware] Decoded token: { userId: ..., agencyId: ..., email: ..., role: ... }
```

**If you see:**
- `Authentication required` → Cookie not sent
- `Invalid or expired token` → Cookie invalid/expired
- No log at all → Request not reaching middleware

### Solution 5: Test Cookie Authentication

**Run the test script:**
```bash
cd wwebjs-bot
node src/scripts/test-protected-routes.js http://localhost:3000
```

**Expected:**
- ✅ All tests pass
- ✅ Cookie received after login
- ✅ All protected routes work

## Quick Fixes

### Fix 1: Restart Both Servers

```bash
# Terminal 1: Backend
cd wwebjs-bot
node src/api/server.js

# Terminal 2: Frontend
cd client
npm run dev
```

### Fix 2: Clear Browser Cookies and Re-login

1. Open DevTools → Application → Cookies
2. Delete all cookies for `localhost`
3. Refresh page
4. Login again
5. Check cookie is set

### Fix 3: Use Vite Proxy (Recommended)

**Create/Update `client/.env.local`:**
```bash
VITE_API_BASE_URL=
```

**Restart Vite dev server:**
```bash
cd client
npm run dev
```

This ensures:
- ✅ Same-origin requests (no CORS issues)
- ✅ Cookies work automatically
- ✅ No cookie domain/path issues

### Fix 4: Check Environment Variables

**Backend `.env` (wwebjs-bot/.env):**
```bash
JWT_SECRET=your-secret-here
NODE_ENV=development
```

**Frontend `.env.local` (client/.env.local):**
```bash
# For proxy (recommended)
VITE_API_BASE_URL=

# OR for direct connection
VITE_API_BASE_URL=http://localhost:3000
```

## Debugging Steps

### Step 1: Check Login Flow
1. Open DevTools → Network tab
2. Login
3. Check login request:
   - ✅ Status: 200
   - ✅ Response headers: `Set-Cookie: auth_token=...`
4. Check Application → Cookies:
   - ✅ `auth_token` cookie exists

### Step 2: Check Auth Check on Refresh
1. Refresh page (F5)
2. Check Network tab for `/api/v1/auth/me`:
   - ✅ Request headers: `Cookie: auth_token=...`
   - ✅ Status: 200 (not 401)
   - ✅ Response: User data

### Step 3: Check Protected Routes
1. Navigate to dashboard
2. Check Network tab for API calls:
   - ✅ `/api/v1/stats/daily` → 200
   - ✅ `/api/v1/deliveries` → 200
   - ✅ Request headers include `Cookie: auth_token=...`

### Step 4: Check Backend Logs
1. Look for `[Auth Middleware] Decoded token:` logs
2. If missing → Cookie not being read
3. If present → Auth is working

## Common Issues

### Issue: Cookie Set But Not Sent
**Cause:** Cookie domain/path mismatch
**Fix:** 
- Use Vite proxy (same-origin)
- Or ensure cookie domain is correct

### Issue: CORS Error
**Cause:** Backend CORS not allowing frontend origin
**Fix:**
- Use Vite proxy (avoids CORS)
- Or add frontend origin to `ALLOWED_ORIGINS`

### Issue: 401 on All Requests
**Cause:** Cookie expired or invalid
**Fix:**
- Clear cookies and re-login
- Check `JWT_SECRET` is set correctly

### Issue: Works After Login, Fails on Refresh
**Cause:** Cookie not persisted or not sent
**Fix:**
- Check cookie `maxAge` (should be 24 hours)
- Check `credentials: 'include'` in fetch
- Use Vite proxy for same-origin

## Verification Checklist

- [ ] Backend server running on port 3000
- [ ] Frontend server running on port 8080
- [ ] `JWT_SECRET` set in backend `.env`
- [ ] `VITE_API_BASE_URL` configured in frontend `.env.local`
- [ ] Cookie `auth_token` exists in browser (after login)
- [ ] API requests include `Cookie` header
- [ ] Backend logs show `[Auth Middleware] Decoded token:`
- [ ] `/api/v1/auth/me` returns 200 (not 401)
- [ ] Protected routes return 200 (not 401)

## Still Not Working?

1. **Check browser console** for errors
2. **Check backend logs** for authentication errors
3. **Run test script**: `node src/scripts/test-protected-routes.js`
4. **Verify cookie attributes** in DevTools
5. **Try incognito mode** (rules out extension issues)

