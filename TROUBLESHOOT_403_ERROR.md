# 🔍 Troubleshooting 403 Forbidden Error on /api/v1/auth/login

## Quick Diagnosis

A **403 Forbidden** on `/api/v1/auth/login` is most likely an **Nginx configuration issue**, not CORS or credentials.

### Common Causes:

1. **Nginx not proxying correctly** - Request blocked before reaching backend
2. **Missing OPTIONS handling** - CORS preflight failing
3. **Incorrect proxy_pass path** - Trailing slash issues
4. **File permissions** - Nginx can't access backend (less likely for API)

---

## Step 1: Test Backend Directly

First, verify the backend is working:

```bash
# SSH into your VPS
ssh root@157.173.118.238

# Test backend directly (bypassing Nginx)
curl -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Should return 400 (validation) or 401 (invalid credentials), NOT 403
```

**If this works**, the issue is Nginx configuration.
**If this fails**, the issue is with the backend.

---

## Step 2: Check Nginx Error Logs

```bash
# View recent Nginx errors
sudo tail -50 /var/log/nginx/error.log

# Watch errors in real-time
sudo tail -f /var/log/nginx/error.log
```

Look for:

- `403 Forbidden` messages
- `upstream` connection errors
- `proxy_pass` errors

---

## Step 3: Verify Nginx Configuration

Check your current Nginx config:

```bash
sudo cat /etc/nginx/sites-available/saas-delivery
```

**Common Issues:**

### Issue 1: Missing OPTIONS Method Handling

Nginx might be blocking the CORS preflight (OPTIONS) request. Add this to your `/api/` location block:

```nginx
location /api/ {
    # Handle CORS preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    proxy_pass http://backend_api;
    proxy_http_version 1.1;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Buffer settings
    proxy_buffering off;
    proxy_request_buffering off;
}
```

### Issue 2: Trailing Slash in proxy_pass

**WRONG:**

```nginx
proxy_pass http://backend_api/;  # Trailing slash removes /api/ prefix
```

**CORRECT:**

```nginx
proxy_pass http://backend_api;  # No trailing slash
```

### Issue 3: Upstream Not Defined

Make sure you have the upstream block:

```nginx
upstream backend_api {
    server 127.0.0.1:3001;
    keepalive 64;
}
```

---

## Step 4: Test Nginx Proxy

```bash
# Test from VPS
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test from external (your local machine)
curl -X POST http://157.173.118.238/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

Compare the responses.

---

## Step 5: Check Backend CORS Configuration

Even though you're using same origin, check backend CORS:

```bash
# Check backend environment
pm2 env api | grep ALLOWED_ORIGINS

# Or check your .env file
cat ~/.env | grep ALLOWED_ORIGINS
```

If `ALLOWED_ORIGINS=*`, that should work, but try setting it explicitly:

```bash
ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238
```

---

## Step 6: Complete Fixed Nginx Configuration

Here's the corrected Nginx config with proper CORS handling:

```nginx
upstream backend_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name 157.173.118.238;

    root /var/www/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy - Forward all /api/* requests to backend
    location /api/ {
        # Handle CORS preflight (OPTIONS requests)
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

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # CORS headers (pass through from backend)
        proxy_pass_header Access-Control-Allow-Origin;
        proxy_pass_header Access-Control-Allow-Methods;
        proxy_pass_header Access-Control-Allow-Headers;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

---

## Step 7: Apply Fixes

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/saas-delivery

# Paste the fixed configuration above

# Test configuration
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx
```

---

## Step 8: Test Again

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Open browser DevTools** → Network tab
3. **Try login again**
4. **Check the request:**
   - Look for OPTIONS request (preflight)
   - Check if POST request goes through
   - Check response headers

---

## Step 9: Check Browser Console

Open browser DevTools → Console and look for:

- CORS errors
- Network errors
- Specific error messages

---

## Step 10: Verify Backend is Running

```bash
# Check PM2 status
pm2 status

# Check if API is listening on port 3001
sudo netstat -tlnp | grep 3001
# or
sudo ss -tlnp | grep 3001

# Check backend logs
pm2 logs api --lines 50
```

---

## Quick Fix Commands

```bash
# 1. Test backend directly
curl -X POST http://127.0.0.1:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'

# 2. Test through Nginx
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'

# 3. Check Nginx config
sudo nginx -t

# 4. View Nginx errors
sudo tail -f /var/log/nginx/error.log

# 5. Restart services
sudo systemctl reload nginx
pm2 restart api
```

---

## Most Likely Solution

The issue is probably **missing OPTIONS handling** in Nginx. Add the CORS preflight handling shown in Step 6 above.

---

## Still Not Working?

1. Share the output of: `sudo tail -50 /var/log/nginx/error.log`
2. Share your current Nginx config: `sudo cat /etc/nginx/sites-available/saas-delivery`
3. Share backend logs: `pm2 logs api --lines 50`


