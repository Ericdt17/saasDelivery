# 🚀 Frontend Deployment Guide - SaaS WhatsApp Delivery App

Complete guide for deploying the React/Vite frontend with your Contabo VPS backend.

---

## 📋 Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Option A: Nginx on VPS (Recommended)](#option-a-nginx-on-vps-recommended)
3. [Option B: Vercel/Netlify Deployment](#option-b-vercelnetlify-deployment)
4. [Step-by-Step Deployment Plan](#step-by-step-deployment-plan)
5. [Testing & Verification](#testing--verification)
6. [Troubleshooting](#troubleshooting)

---

## 1. Architecture Decision

### Current Setup
- **Backend**: Node.js API on Contabo VPS (port 3001)
- **Public API**: `http://157.173.118.238`
- **Nginx**: Reverse proxy for backend
- **Database**: PostgreSQL on Render
- **CORS**: Currently `ALLOWED_ORIGINS=*`

### Recommendation: **Nginx on VPS** ✅

**Why serve frontend with Nginx on the same VPS?**

✅ **Advantages:**
- **No CORS issues** - Same origin for frontend and API
- **Better performance** - No cross-origin latency
- **Cost-effective** - No additional hosting costs
- **Simpler architecture** - Single server to manage
- **Easier SSL** - Single certificate for domain
- **Better security** - API not exposed to public IP directly

❌ **Vercel/Netlify Alternative:**
- Requires CORS configuration
- Additional hosting service to manage
- Cross-origin requests add latency
- More complex security setup

**Conclusion**: Since your backend is already on a VPS, serve the frontend with Nginx on the same server.

---

## Option A: Nginx on VPS (Recommended)

### Architecture Overview

```
Internet
   │
   ├─→ Nginx (Port 80/443)
   │     │
   │     ├─→ /api/* → Proxy to http://127.0.0.1:3001/api/*
   │     │
   │     └─→ /* → Serve static files from /var/www/frontend/dist
   │
   └─→ Node.js API (Port 3001, localhost only)
```

### Directory Structure

```
/var/www/
  └── frontend/
      └── dist/          # Built frontend files
          ├── index.html
          ├── assets/
          └── ...
```

### Step 1: Build the Frontend

On your **local machine** or **VPS**:

```bash
# Navigate to frontend directory
cd client

# Install dependencies (if not already done)
npm install

# Create production environment file
cat > .env.production << EOF
VITE_API_BASE_URL=
EOF

# Build for production
npm run build
```

**Important**: Set `VITE_API_BASE_URL=` (empty) so the frontend uses relative URLs (`/api/*`), which Nginx will proxy.

### Step 2: Upload Build to VPS

**Option A: Using SCP (from local machine)**

```bash
# From your local machine
scp -r client/dist/* root@157.173.118.238:/var/www/frontend/dist/
```

**Option B: Build directly on VPS**

```bash
# SSH into VPS
ssh root@157.173.118.238

# Clone/navigate to your repo
cd /path/to/saasDelivery
cd client

# Install dependencies and build
npm install
npm run build

# Create directory and move files
sudo mkdir -p /var/www/frontend
sudo cp -r dist/* /var/www/frontend/dist/
```

### Step 3: Configure Nginx

Create or edit the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/saas-delivery
```

**Complete Nginx Configuration:**

```nginx
# Upstream for backend API (optional, but recommended)
upstream backend_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name 157.173.118.238;  # Replace with your domain if you have one

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 157.173.118.238;  # Replace with your domain

    # SSL Configuration (if you have SSL certificate)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers HIGH:!aNULL:!MD5;

    # Root directory for static files
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

**Key Configuration Points:**

1. **API Proxy** (`location /api/`): Proxies all `/api/*` requests to `http://127.0.0.1:3001`
2. **React Router** (`try_files`): Serves `index.html` for all routes (handles client-side routing)
3. **Static Assets**: Cached for 1 year
4. **Security Headers**: Added for protection

### Step 4: Enable Site and Reload Nginx

```bash
# Create symlink (if using sites-available/sites-enabled pattern)
sudo ln -s /etc/nginx/sites-available/saas-delivery /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### Step 5: Update Backend CORS (Optional but Recommended)

Since frontend and API are now on the same origin, you can tighten CORS:

```bash
# On VPS, edit your backend environment file
# (Location depends on your PM2 setup)
nano ~/.env  # or wherever your env vars are

# Update ALLOWED_ORIGINS to your domain/IP
ALLOWED_ORIGINS=http://157.173.118.238,https://157.173.118.238

# Restart backend with PM2
pm2 restart api
```

**Note**: If using same origin (frontend and API on same domain), CORS is less critical, but keep it configured for security.

### Step 6: Set Proper Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/frontend

# Set permissions
sudo chmod -R 755 /var/www/frontend
```

---

## Option B: Vercel/Netlify Deployment

If you prefer to deploy frontend separately:

### Vercel Deployment

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set **Root Directory** to `client`

2. **Build Settings**
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment Variables**
   ```
   VITE_API_BASE_URL=http://157.173.118.238
   ```

4. **Deploy**

### Update Backend CORS

After Vercel deployment, update backend:

```bash
# On VPS
# Edit environment variables
ALLOWED_ORIGINS=https://your-app.vercel.app,http://157.173.118.238

# Restart backend
pm2 restart api
```

### Security Considerations

Since backend is on a public IP:

1. **Rate Limiting**: Add rate limiting to your Express API
2. **API Keys**: Consider requiring API keys for public endpoints
3. **Firewall**: Restrict access to port 3001 (only allow Nginx)
4. **HTTPS**: Use HTTPS for API calls (set up SSL on VPS)

---

## Step-by-Step Deployment Plan

### Prerequisites Checklist

- [ ] VPS access (SSH)
- [ ] Nginx installed on VPS
- [ ] Node.js and npm installed on VPS (for building, if building on server)
- [ ] Domain name (optional, but recommended)

### Deployment Steps

#### Phase 1: Prepare Frontend Build

```bash
# On local machine or VPS
cd client

# Create production env file
echo "VITE_API_BASE_URL=" > .env.production

# Build
npm run build

# Verify build output
ls -la dist/
```

#### Phase 2: Upload to VPS

```bash
# From local machine
scp -r client/dist/* root@157.173.118.238:/var/www/frontend/dist/

# Or build directly on VPS (see Step 2 above)
```

#### Phase 3: Configure Nginx

```bash
# SSH into VPS
ssh root@157.173.118.238

# Create Nginx config
sudo nano /etc/nginx/sites-available/saas-delivery
# (Paste the Nginx config from Step 3 above)

# Enable site
sudo ln -s /etc/nginx/sites-available/saas-delivery /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

#### Phase 4: Update Backend (Optional)

```bash
# Update CORS if needed
# Edit your backend .env file
ALLOWED_ORIGINS=http://157.173.118.238

# Restart backend
pm2 restart api
```

#### Phase 5: Test

```bash
# Test API proxy
curl http://157.173.118.238/api/v1/health

# Test frontend
curl http://157.173.118.238/
```

---

## Testing & Verification

### 1. Test API Proxy

```bash
# Should return health check
curl http://157.173.118.238/api/v1/health

# Expected response:
# {"status":"ok","timestamp":"...","service":"delivery-bot-api","version":"1.0.0"}
```

### 2. Test Frontend Loading

```bash
# Should return index.html
curl http://157.173.118.238/

# Should see HTML content
```

### 3. Test React Router (Refresh Handling)

1. Open browser: `http://157.173.118.238`
2. Navigate to a route (e.g., `/livraisons`)
3. **Refresh the page** - Should not show 404
4. Verify API calls work (check browser Network tab)

### 4. Test API Calls from Frontend

1. Open browser DevTools → Network tab
2. Navigate to a page that makes API calls
3. Verify requests go to `/api/v1/...` (relative URLs)
4. Check responses are successful

### 5. Verify CORS (if using separate hosting)

```bash
# Test CORS headers
curl -H "Origin: http://157.173.118.238" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://157.173.118.238/api/v1/health -v
```

---

## Troubleshooting

### Issue 1: 404 on Refresh

**Problem**: Refreshing a React Router route shows 404

**Solution**: Ensure Nginx has `try_files $uri $uri/ /index.html;` in the root location block.

### Issue 2: API Calls Fail

**Problem**: Frontend can't reach API

**Solutions**:
1. Check Nginx proxy configuration
2. Verify backend is running: `pm2 list`
3. Test backend directly: `curl http://127.0.0.1:3001/api/v1/health`
4. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Issue 3: CORS Errors

**Problem**: Browser shows CORS errors

**Solutions**:
1. If using same origin (Nginx), CORS shouldn't be an issue
2. If using Vercel, update `ALLOWED_ORIGINS` in backend
3. Check backend CORS config in `wwebjs-bot/src/api/server.js`

### Issue 4: Static Files Not Loading

**Problem**: CSS/JS files return 404

**Solutions**:
1. Verify files exist: `ls -la /var/www/frontend/dist/assets/`
2. Check permissions: `sudo chown -R www-data:www-data /var/www/frontend`
3. Check Nginx root path matches actual location

### Issue 5: Nginx Configuration Errors

**Problem**: `nginx -t` fails

**Solutions**:
1. Check syntax: `sudo nginx -t`
2. Review error messages carefully
3. Common issues:
   - Missing semicolons
   - Incorrect paths
   - Duplicate server blocks

### Issue 6: Backend Not Accessible

**Problem**: API proxy returns 502 Bad Gateway

**Solutions**:
1. Check backend is running: `pm2 list`
2. Test backend directly: `curl http://127.0.0.1:3001/api/v1/health`
3. Check backend logs: `pm2 logs api`
4. Verify port 3001 is correct in Nginx config

---

## Security Best Practices

### 1. SSL/HTTPS Setup (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
```

### 2. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Backend port 3001 should NOT be exposed publicly
# Only accessible via localhost (Nginx proxy)
```

### 3. Update Backend Security

- Remove `ALLOWED_ORIGINS=*` and set specific origins
- Add rate limiting to API
- Consider API authentication for sensitive endpoints

---

## Maintenance & Updates

### Updating Frontend

```bash
# 1. Build new version
cd client
npm run build

# 2. Upload to VPS
scp -r dist/* root@157.173.118.238:/var/www/frontend/dist/

# 3. Clear browser cache (or add cache busting to build)
```

### Monitoring

```bash
# Check Nginx status
sudo systemctl status nginx

# Check backend status
pm2 status

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
pm2 logs api
```

---

## Quick Reference

### File Locations

- **Frontend build**: `/var/www/frontend/dist/`
- **Nginx config**: `/etc/nginx/sites-available/saas-delivery`
- **Nginx logs**: `/var/log/nginx/`
- **Backend logs**: `pm2 logs api`

### Important Commands

```bash
# Nginx
sudo nginx -t                    # Test config
sudo systemctl reload nginx      # Reload config
sudo systemctl restart nginx     # Restart Nginx

# Backend
pm2 restart api                  # Restart API
pm2 logs api                     # View logs
pm2 status                       # Check status

# Permissions
sudo chown -R www-data:www-data /var/www/frontend
sudo chmod -R 755 /var/www/frontend
```

---

## Summary

✅ **Recommended Setup**: Serve frontend with Nginx on the same VPS
✅ **Benefits**: No CORS issues, better performance, simpler architecture
✅ **Next Steps**: Build frontend, upload to VPS, configure Nginx, test

Your frontend will be accessible at `http://157.173.118.238` (or your domain if configured).

API calls will automatically proxy from `/api/*` to your backend on port 3001.


