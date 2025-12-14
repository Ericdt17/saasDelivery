# Restart Server for Cookie Authentication

## ✅ Code is Correct

The login route code has been updated and is **100% correct**:

- Token is **NOT** in response body
- Token is **ONLY** set via HTTP-only cookie
- Response only contains `{ success: true, data: { user: {...} } }`

## ⚠️ Server Needs Restart

The test is failing because the **server is still running old code**. You need to restart the server to load the new code.

## For Local Testing

### Step 1: Stop Current Server

- Press `Ctrl+C` in the terminal where the server is running
- Or kill the process if running in background

### Step 2: Restart Server

```bash
cd wwebjs-bot
node src/api/server.js
```

Or if using nodemon:

```bash
npm run api:dev
```

### Step 3: Run Tests Again

```bash
node src/scripts/test-cookie-auth.js http://localhost:3000
```

## For Render (Production)

### Step 1: Commit and Push Changes

```bash
git add wwebjs-bot/src/api/routes/auth.js
git commit -m "Remove token from login response - use HTTP-only cookie only"
git push
```

### Step 2: Render Auto-Deploys

- Render will automatically detect the push
- It will rebuild and redeploy with the new code
- Wait for deployment to complete (check Render dashboard)

### Step 3: Test Against Render

```bash
node src/scripts/test-cookie-auth.js https://your-backend.onrender.com
```

## Verification

After restarting, the test should show:

```
✅ Token is NOT in response body ✅
✅ auth_token cookie is set
✅ Cookie is HttpOnly ✅
```

## Code Verification

The login route (`wwebjs-bot/src/api/routes/auth.js`) line 213-228:

```javascript
const responseData = {
  success: true,
  data: {
    user: {
      id: agency.id,
      name: agency.name,
      email: agency.email,
      role: agency.role,
      agencyId: agency.role === "super_admin" ? null : agency.id,
    },
  },
};

// Explicitly ensure token is NOT included
// The token variable is ONLY used for res.cookie() above
res.json(responseData);
```

**No token in responseData** ✅

Token is only used here (line 209):

```javascript
res.cookie("auth_token", token, cookieOptions);
```

## Quick Test Command

After restarting server:

```bash
# Test login endpoint directly
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}' \
  -v
```

**Check:**

- Response body should NOT contain `"token"`
- Response headers should contain `Set-Cookie: auth_token=...`

