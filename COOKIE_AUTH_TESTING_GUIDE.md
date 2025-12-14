# HTTP-Only Cookie Authentication Testing Guide

This guide provides comprehensive testing procedures for the HTTP-only cookie authentication system.

## Quick Start

### Run Automated Tests

```bash
# From project root
cd wwebjs-bot
node src/scripts/test-cookie-auth.js

# Or with custom URL
node src/scripts/test-cookie-auth.js http://localhost:3000

# Production testing
NODE_ENV=production node src/scripts/test-cookie-auth.js https://your-api-url.com
```

### Prerequisites

1. **Backend server running:**
   ```bash
   cd wwebjs-bot
   node src/api/server.js
   ```

2. **Test credentials configured:**
   ```bash
   export TEST_EMAIL=admin@livrexpress.com
   export TEST_PASSWORD=admin123
   ```

---

## Test Coverage

### ✅ Automated Tests (Node.js Script)

The `test-cookie-auth.js` script automatically tests:

1. **Login Flow**
   - Valid credentials → 200 response
   - Token NOT in response body
   - Cookie is set with correct attributes
   - User data returned

2. **Cookie Behavior**
   - Cookie automatically sent on subsequent requests
   - HttpOnly flag prevents JavaScript access
   - Secure flag in production
   - SameSite=None for cross-domain

3. **Protected Routes**
   - Accessible with valid cookie
   - Returns 401 without cookie

4. **Logout Flow**
   - Cookie cleared on logout
   - Protected routes return 401 after logout

5. **Negative Cases**
   - Invalid credentials → 401, no cookie
   - Missing credentials → 400, no cookie
   - Expired/invalid cookie → 401

6. **Page Refresh Simulation**
   - Cookie persists across "refreshes"
   - Auth state restored via /me endpoint

7. **Environment Consistency**
   - Cookie settings match environment
   - Production uses Secure + SameSite=None

---

## Browser-Based Testing

Some tests require a real browser to verify JavaScript cannot access cookies.

### 1. Login Flow Test

**Steps:**
1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Navigate to login page
4. Submit valid credentials
5. Check login request response

**Expected Results:**
- ✅ Status: 200
- ✅ Response body contains `user` object
- ✅ Response body does NOT contain `token` field
- ✅ **Cookies** tab shows `auth_token` cookie
- ✅ Cookie attributes:
  - `HttpOnly` ✓
  - `Secure` ✓ (in production)
  - `SameSite=None` ✓ (in production)

**Verify in DevTools:**
```javascript
// In Console tab - should return empty or not include auth_token
document.cookie
// Expected: auth_token is NOT listed (HttpOnly prevents access)
```

### 2. Cookie Persistence Test

**Steps:**
1. Log in successfully
2. Refresh the page (F5)
3. Check Network tab for `/api/v1/auth/me` request
4. Verify user remains authenticated

**Expected Results:**
- ✅ `/api/v1/auth/me` returns 200
- ✅ User data returned
- ✅ No login prompt shown
- ✅ Cookie still present in **Application** → **Cookies**

### 3. Protected Route Access Test

**Steps:**
1. Log in
2. Navigate to protected route (e.g., `/livraisons`)
3. Check Network tab

**Expected Results:**
- ✅ Protected routes load successfully
- ✅ API requests include `Cookie: auth_token=...` header
- ✅ No 401 errors

### 4. Logout Test

**Steps:**
1. Log in
2. Click logout
3. Check Network tab for `/api/v1/auth/logout` request
4. Check **Application** → **Cookies**
5. Try to access protected route

**Expected Results:**
- ✅ Logout request returns 200
- ✅ `auth_token` cookie is removed/cleared
- ✅ Protected routes redirect to login
- ✅ `/api/v1/auth/me` returns 401

### 5. JavaScript Cookie Access Test

**Steps:**
1. Log in
2. Open Console tab
3. Run: `document.cookie`
4. Try to access cookie via JavaScript

**Expected Results:**
- ✅ `document.cookie` does NOT include `auth_token`
- ✅ Cookie is invisible to JavaScript (HttpOnly protection)
- ✅ XSS attacks cannot steal the token

**Test in Console:**
```javascript
// Should NOT include auth_token
console.log(document.cookie);

// Should return null/undefined
console.log(document.cookie.split(';').find(c => c.includes('auth_token')));
```

### 6. Cross-Domain Cookie Test (Production)

**Steps:**
1. Deploy frontend to Vercel
2. Deploy backend to Render
3. Log in from frontend
4. Check Network tab for cookie headers

**Expected Results:**
- ✅ Cookie set with `SameSite=None`
- ✅ Cookie set with `Secure=true`
- ✅ Cookie sent on cross-domain requests
- ✅ Authentication works across domains

**Verify in DevTools:**
- **Network** → Select request → **Headers** → **Response Headers**
- Look for: `Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=None`

---

## Manual Testing Checklist

### Login Flow
- [ ] Valid credentials → Success
- [ ] Invalid credentials → 401 error
- [ ] Missing email → 400 error
- [ ] Missing password → 400 error
- [ ] Response does NOT contain token
- [ ] Cookie is set in browser

### Cookie Attributes
- [ ] Cookie marked HttpOnly
- [ ] Cookie marked Secure (production)
- [ ] Cookie SameSite=None (production)
- [ ] Cookie not accessible via `document.cookie`

### Authentication Persistence
- [ ] User stays logged in after page refresh
- [ ] User stays logged in after browser restart
- [ ] `/api/v1/auth/me` returns user data on page load

### Protected Routes
- [ ] Authenticated user can access protected routes
- [ ] Unauthenticated user redirected to login
- [ ] API requests include cookie automatically
- [ ] No manual token handling required

### Logout
- [ ] Logout clears cookie
- [ ] User redirected to login
- [ ] Protected routes inaccessible after logout
- [ ] Page refresh does NOT restore session

### Security
- [ ] Token not in localStorage
- [ ] Token not in sessionStorage
- [ ] Token not in response body
- [ ] Cookie not accessible to JavaScript
- [ ] Invalid cookie → 401
- [ ] Expired cookie → 401

---

## Troubleshooting

### Issue: Cookie Not Set

**Check:**
1. Backend CORS allows credentials: `credentials: true`
2. Frontend includes credentials: `credentials: 'include'`
3. SameSite settings match environment
4. Secure flag matches protocol (HTTPS in production)

**Solution:**
```javascript
// Backend CORS (already configured)
credentials: true

// Frontend fetch (already configured)
credentials: 'include'
```

### Issue: Cookie Not Sent on Requests

**Check:**
1. Cookie domain matches request domain
2. Cookie path is `/`
3. SameSite allows cross-domain (production)
4. Frontend includes `credentials: 'include'`

### Issue: 401 After Login

**Check:**
1. Cookie is actually set (check DevTools)
2. Cookie attributes are correct
3. Backend middleware reads from cookies
4. CORS allows credentials

**Debug:**
```javascript
// In browser console - check cookie exists
// (Note: HttpOnly cookies won't show in document.cookie)
// Check Application → Cookies in DevTools instead
```

### Issue: Cookie Cleared on Refresh

**Check:**
1. Cookie maxAge is set correctly
2. Cookie expires is not in the past
3. Browser allows cookies
4. No browser extensions blocking cookies

---

## Expected Test Results

### Successful Test Run

```
╔════════════════════════════════════════════════════════════╗
║     HTTP-Only Cookie Authentication Test Suite              ║
╚════════════════════════════════════════════════════════════╝

📍 Base URL: http://localhost:3000
🌍 Environment: development
📧 Test Email: admin@livrexpress.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Test: 1. Login Flow - Valid Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Status: 200
  ✅ Response has success: true
  ✅ Token is NOT in response body ✅
  ✅ User data received: Admin (admin@livrexpress.com)
  ✅ auth_token cookie is set
  ✅ Cookie is HttpOnly ✅
  ✅ Cookie SameSite: lax (development mode)

...

╔════════════════════════════════════════════════════════════╗
║                    Test Summary                              ║
╚════════════════════════════════════════════════════════════╝

📊 Total Tests: 11
✅ Passed: 11
❌ Failed: 0
📈 Success Rate: 100.0%

🎉 All tests passed!
✅ HTTP-only cookie authentication is working correctly
```

---

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Test Cookie Authentication
  run: |
    cd wwebjs-bot
    npm install
    node src/api/server.js &
    sleep 5
    node src/scripts/test-cookie-auth.js
```

---

## Additional Notes

1. **Development vs Production:**
   - Development: `Secure=false`, `SameSite=lax`
   - Production: `Secure=true`, `SameSite=None`

2. **Cross-Domain Setup:**
   - Frontend (Vercel) and Backend (Render) are different domains
   - Requires `SameSite=None` and `Secure=true`
   - CORS must allow credentials

3. **Browser Compatibility:**
   - Modern browsers support HttpOnly cookies
   - SameSite=None requires Secure in modern browsers
   - Test in Chrome, Firefox, Safari, Edge

4. **Security Benefits:**
   - XSS attacks cannot steal tokens
   - Tokens not exposed in localStorage
   - Automatic cookie management by browser
   - Persists across page refreshes securely

---

## Related Files

- Test Script: `wwebjs-bot/src/scripts/test-cookie-auth.js`
- Auth Routes: `wwebjs-bot/src/api/routes/auth.js`
- Auth Middleware: `wwebjs-bot/src/api/middleware/auth.js`
- JWT Utils: `wwebjs-bot/src/utils/jwt.js`
- Frontend Auth Service: `client/src/services/auth.ts`
- Frontend API Service: `client/src/services/api.ts`


