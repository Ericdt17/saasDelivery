# Testing Nginx Proxy Configuration

## Your Backend Test Result ✅

You tested the backend directly and got:

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Invalid email or password"
}
```

This is **GOOD** - it means:

- ✅ Backend is running on port 3001
- ✅ API endpoint is accessible
- ✅ Backend is processing requests correctly
- ✅ The 401 response is correct (invalid credentials)

The **403 error in browser** is likely an **Nginx proxy issue**.

---

## Step 1: Test Through Nginx

Test if Nginx is proxying correctly:

```bash
# Test through Nginx (from VPS)
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}'

# Or test from external IP
curl -X POST http://157.173.118.238/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livrexpress.com","password":"admin123"}'
```

**Expected results:**

- ✅ **401 response** = Nginx proxy is working (backend rejected credentials)
- ❌ **403 response** = Nginx is blocking the request (needs config fix)
- ❌ **502 Bad Gateway** = Backend not accessible from Nginx
- ❌ **404 Not Found** = Nginx routing issue

---

## Step 2: Check Nginx Configuration

Verify your Nginx config has the OPTIONS handling:

```bash
sudo cat /etc/nginx/sites-available/saas-delivery | grep -A 20 "location /api/"
```

Look for the OPTIONS handling block. If it's missing, add it.

---

## Step 3: Check Nginx Error Logs

```bash
# View recent errors
sudo tail -50 /var/log/nginx/error.log

# Watch in real-time while testing
sudo tail -f /var/log/nginx/error.log
```

Then in another terminal, try the login from browser and see what errors appear.

---

## Step 4: Verify User Account Exists

The credentials might not exist. Check if the user exists:

```bash
# Connect to your database (PostgreSQL on Render)
# Or check via your backend API

# If you have a script to check users:
cd /opt/saasDelivery/wwebjs-bot
node -e "
const { adapter } = require('./src/db');
(async () => {
  const result = await adapter.query('SELECT id, email, name, role FROM agencies WHERE email = $1', ['admin@livrexpress.com']);
  console.log('User:', result[0] || 'NOT FOUND');
  process.exit(0);
})();
"
```

Or create a super admin if needed:

```bash
cd /opt/saasDelivery/wwebjs-bot
node src/scripts/seed-super-admin.js
```

---

## Step 5: Test OPTIONS Request (CORS Preflight)

The browser sends an OPTIONS request first. Test it:

```bash
# Test OPTIONS request
curl -X OPTIONS http://localhost/api/v1/auth/login \
  -H "Origin: http://157.173.118.238" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Should return 204 with CORS headers
```

If this returns 403, that's the problem - Nginx needs OPTIONS handling.

---

## Quick Fix: Update Nginx Config

If testing shows 403 through Nginx, update your config:

```bash
sudo nano /etc/nginx/sites-available/saas-delivery
```

Make sure the `/api/` location block looks like this:

```nginx
location /api/ {
    # Handle CORS preflight (OPTIONS requests) - ADD THIS
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With, Accept, Origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    proxy_pass http://backend_api;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    proxy_buffering off;
    proxy_request_buffering off;
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: Test in Browser Again

After fixing Nginx:

1. Clear browser cache (Ctrl+Shift+Delete)
2. Open DevTools → Network tab
3. Try login again
4. Check:
   - OPTIONS request should return 204
   - POST request should return 401 (if wrong credentials) or 200 (if correct)

---

## Most Likely Issue

Since backend works directly but browser shows 403, it's **definitely Nginx blocking OPTIONS requests**.

Add the OPTIONS handling block shown above and reload Nginx.

