# 🔍 Verify Netlify Configuration

## Step 1: Check Netlify Environment Variables

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site: `effulgent-rabanadas-9e741f`
3. Go to **Site settings** → **Environment variables**
4. Verify `VITE_API_BASE_URL` is set to:
   ```
   https://saasdelivery.onrender.com
   ```
   ⚠️ **Important**: 
   - Must start with `https://`
   - Must NOT have trailing slash
   - Must match your actual Render backend URL

## Step 2: Verify in Browser Console

Open your production site: `https://effulgent-rabanadas-9e741f.netlify.app`

Open browser DevTools (F12) → Console tab, then run:

```javascript
// Check API Base URL
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// Check if token exists
console.log('Token exists:', !!localStorage.getItem('auth_token'));

// Check token value (first 20 chars)
const token = localStorage.getItem('auth_token');
console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'No token');

// Test API connection
fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://saasdelivery.onrender.com'}/api/v1/health`)
  .then(r => r.json())
  .then(data => console.log('✅ Backend is reachable:', data))
  .catch(err => console.error('❌ Backend unreachable:', err));
```

## Step 3: Expected Results

### ✅ Correct Configuration:
```
API Base URL: https://saasdelivery.onrender.com
Token exists: true (after login)
Backend is reachable: { status: 'ok', ... }
```

### ❌ Wrong Configuration:
```
API Base URL: undefined
// OR
API Base URL: http://localhost:3000
// OR
Backend unreachable: [CORS error or network error]
```

## Step 4: Fix Issues

### If `VITE_API_BASE_URL` is wrong or missing:

1. **Update in Netlify:**
   - Site settings → Environment variables
   - Edit `VITE_API_BASE_URL` → Set to `https://saasdelivery.onrender.com`
   - Click **Save**

2. **Redeploy:**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - Wait for deployment to complete

### If token is missing:

1. Go to `/login` page
2. Log in with your credentials
3. Token will be saved for production backend

## Step 5: Verify After Fix

After redeploying, clear browser cache and test again:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Run the console checks again
3. Try logging in and accessing protected routes

---

## Quick Checklist

- [ ] `VITE_API_BASE_URL` is set in Netlify env vars
- [ ] Value is `https://saasdelivery.onrender.com` (no trailing slash)
- [ ] Site has been redeployed after setting env var
- [ ] Browser console shows correct API URL
- [ ] Backend health check succeeds
- [ ] User is logged in on production site (not using local token)

