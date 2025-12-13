# ✅ Frontend Deployment Checklist

Quick checklist for deploying the frontend to your Contabo VPS.

## Pre-Deployment

- [ ] VPS SSH access confirmed
- [ ] Nginx installed on VPS (`sudo apt install nginx`)
- [ ] Backend API running on port 3001
- [ ] PM2 managing backend process

## Step 1: Build Frontend

```bash
cd client
echo "VITE_API_BASE_URL=" > .env.production
npm install
npm run build
```

**Verify**: `ls dist/` shows `index.html` and `assets/` folder

## Step 2: Create Directory on VPS

```bash
ssh root@157.173.118.238
sudo mkdir -p /var/www/frontend/dist
sudo chown -R www-data:www-data /var/www/frontend
```

## Step 3: Upload Build Files

**From local machine:**
```bash
scp -r client/dist/* root@157.173.118.238:/var/www/frontend/dist/
```

**Or build on VPS:**
```bash
# On VPS
cd /path/to/saasDelivery/client
npm install
npm run build
sudo cp -r dist/* /var/www/frontend/dist/
```

## Step 4: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/saas-delivery
```

**Paste the Nginx config from `FRONTEND_DEPLOYMENT_GUIDE.md`**

**Key points:**
- Root: `/var/www/frontend/dist`
- Proxy `/api/` to `http://127.0.0.1:3001`
- `try_files $uri $uri/ /index.html;` for React Router

## Step 5: Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/saas-delivery /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Test

- [ ] `curl http://157.173.118.238/api/v1/health` returns JSON
- [ ] `curl http://157.173.118.238/` returns HTML
- [ ] Browser: `http://157.173.118.238` loads frontend
- [ ] Navigate to `/livraisons` and refresh - no 404
- [ ] API calls work (check browser Network tab)

## Step 7: Update Backend CORS (Optional)

```bash
# Edit backend .env
ALLOWED_ORIGINS=http://157.173.118.238

# Restart backend
pm2 restart api
```

## Troubleshooting Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx config
sudo nginx -t

# View Nginx logs
sudo tail -f /var/log/nginx/error.log

# Check backend
pm2 status
pm2 logs api

# Test backend directly
curl http://127.0.0.1:3001/api/v1/health

# Check file permissions
ls -la /var/www/frontend/dist/
```

## Done! 🎉

Your frontend should now be accessible at `http://157.173.118.238`



