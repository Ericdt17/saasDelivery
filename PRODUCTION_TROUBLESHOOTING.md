# 🔧 Production Troubleshooting Guide

If functionalities work locally but not in production, follow this checklist:

## 🔍 Quick Diagnostic Steps

### 1. Check Frontend API Configuration

**Problem**: Frontend can't reach backend API

**Check**:

- Open browser DevTools (F12) → Console tab
- Look for errors like:
  - `Network error: Unable to connect to server`
  - `CORS policy: No 'Access-Control-Allow-Origin' header`
  - `Failed to fetch`

**Fix**:

1. Verify `VITE_API_BASE_URL` is set in production environment
   - For Render: Check Static Site → Environment tab
   - Should be: `https://your-backend-api.onrender.com` (no trailing slash)
2. Rebuild frontend after setting env var:
   ```bash
   npm run build
   ```

### 2. Check Backend CORS Configuration

**Problem**: Backend rejects frontend requests

**Check**:

- Browser Console shows CORS errors
- Network tab shows OPTIONS requests failing

**Fix**:

1. Go to Backend Service → Environment tab
2. Set `ALLOWED_ORIGINS` to your frontend URL:
   ```
   ALLOWED_ORIGINS=https://your-frontend.onrender.com
   ```
3. If you have multiple origins, separate with commas:
   ```
   ALLOWED_ORIGINS=https://frontend1.onrender.com,https://frontend2.onrender.com
   ```
4. Redeploy backend service

### 3. Check Database Connection

**Problem**: API returns 500 errors or database errors

**Check**:

- Backend logs show database connection errors
- API endpoints return errors

**Fix**:

1. Verify `DATABASE_URL` is set correctly
   - Should be the **Internal Database URL** from Render
   - Format: `postgresql://user:password@hostname:5432/database`
2. Verify `DB_TYPE=postgres` is set
3. Check database is running and accessible
4. Check if database tables exist (run migrations if needed)

### 4. Check Environment Variables

**Backend Required Variables**:

```
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=<internal-database-url>
ALLOWED_ORIGINS=<frontend-url>
TIME_ZONE=UTC
PORT=<auto-set-by-render>
```

**Frontend Required Variables**:

```
VITE_API_BASE_URL=<backend-api-url>
```

### 5. Check API Endpoints

**Test Backend Health**:

```bash
curl https://your-backend-api.onrender.com/api/v1/health
```

**Expected Response**:

```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "delivery-bot-api",
  "version": "1.0.0"
}
```

### 6. Check Browser Console

**Common Errors**:

1. **Network Error (Status 0)**
   - Backend not accessible
   - Check backend URL is correct
   - Check backend is running

2. **CORS Error (Status 0 or 403)**
   - `ALLOWED_ORIGINS` not set correctly
   - Frontend URL not in allowed origins

3. **401 Unauthorized**
   - Authentication token missing or invalid
   - Check login functionality

4. **500 Internal Server Error**
   - Backend error
   - Check backend logs
   - Check database connection

5. **404 Not Found**
   - API endpoint doesn't exist
   - Check API route configuration

## 🛠️ Step-by-Step Fix

### Step 1: Verify Backend is Running

1. Go to Render Dashboard → Your Backend Service
2. Check "Logs" tab for errors
3. Verify service status is "Live"
4. Test health endpoint:
   ```bash
   curl https://your-backend.onrender.com/api/v1/health
   ```

### Step 2: Verify Frontend Environment Variable

1. Go to Render Dashboard → Your Frontend Static Site
2. Check "Environment" tab
3. Verify `VITE_API_BASE_URL` is set to your backend URL
4. **Important**: Rebuild frontend after changing env vars

### Step 3: Verify Backend CORS

1. Go to Render Dashboard → Your Backend Service
2. Check "Environment" tab
3. Verify `ALLOWED_ORIGINS` includes your frontend URL
4. Format: `https://your-frontend.onrender.com` (no trailing slash)
5. Redeploy backend

### Step 4: Verify Database Connection

1. Go to Render Dashboard → Your Database
2. Check "Info" tab for connection details
3. Verify `DATABASE_URL` in backend matches Internal Database URL
4. Check backend logs for database connection errors

### Step 5: Test in Browser

1. Open your production frontend URL
2. Open DevTools (F12) → Console tab
3. Look for errors
4. Check Network tab for failed requests
5. Try logging in

## 🔍 Debugging Tools

### Add Diagnostic Endpoint (Temporary)

Add this to your backend to check configuration:

```javascript
// In server.js, add before error handler:
app.get("/api/v1/debug", (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    dbType: process.env.DB_TYPE,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
    port: process.env.PORT,
    // Don't expose sensitive data in production!
  });
});
```

### Check Frontend API Config

In browser console:

```javascript
console.log("API Base URL:", import.meta.env.VITE_API_BASE_URL);
```

## 📋 Common Issues Checklist

- [ ] Backend service is running and accessible
- [ ] Frontend `VITE_API_BASE_URL` is set correctly
- [ ] Backend `ALLOWED_ORIGINS` includes frontend URL
- [ ] Database connection is working
- [ ] All environment variables are set
- [ ] Frontend was rebuilt after setting env vars
- [ ] Backend was redeployed after setting env vars
- [ ] No CORS errors in browser console
- [ ] No network errors in browser console
- [ ] API health endpoint returns 200

## 🚨 Still Not Working?

1. **Check Backend Logs**:
   - Render Dashboard → Backend Service → Logs
   - Look for errors, stack traces

2. **Check Frontend Build Logs**:
   - Render Dashboard → Frontend Static Site → Logs
   - Verify build completed successfully

3. **Test API Directly**:

   ```bash
   # Test health
   curl https://your-backend.onrender.com/api/v1/health

   # Test login (replace with actual credentials)
   curl -X POST https://your-backend.onrender.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password"}'
   ```

4. **Compare Local vs Production**:
   - Check if local uses different ports/URLs
   - Verify production URLs match configuration

## 📝 Environment Variable Reference

### Backend (Render Web Service)

```
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@hostname:5432/database
ALLOWED_ORIGINS=https://your-frontend.onrender.com
TIME_ZONE=UTC
```

### Frontend (Render Static Site)

```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

**Important Notes**:

- `VITE_API_BASE_URL` must NOT have trailing slash
- `ALLOWED_ORIGINS` must match exact frontend URL (including https://)
- Frontend must be rebuilt after changing `VITE_API_BASE_URL`
- Backend must be redeployed after changing `ALLOWED_ORIGINS`


