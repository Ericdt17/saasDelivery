# ✅ Production Deployment Quick Checklist

Quick reference checklist for deploying to production (API on VPS).

---

## 🚀 Quick Start (20 minutes)

### Step 1: VPS Setup (5 min)

```bash
ssh root@157.173.118.238

# Install Node.js, PM2, Nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
```

### Step 2: Clone Repository (2 min)

```bash
sudo mkdir -p /opt/saasDelivery
cd /opt/saasDelivery
git clone <your-repo-url> wwebjs-bot
cd wwebjs-bot
npm install
cd client && npm install && cd ..
```

### Step 3: Configure Environment (3 min)

```bash
cd /opt/saasDelivery/wwebjs-bot
nano .env.prod
```

**Add:**
```env
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/db
API_PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
```

### Step 4: Update PM2 Config (2 min)

```bash
nano ecosystem.config.js
```

**Update to run both bot and API** (see PRODUCTION_DEPLOYMENT_GUIDE.md)

### Step 5: Run Migrations (1 min)

```bash
npm run migrate
```

### Step 6: Start Services (2 min)

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

**Scan QR code** when it appears.

### Step 7: Build Frontend (2 min)

```bash
cd client
echo "VITE_API_BASE_URL=" > .env.production  # Empty = relative URLs
npm run build
```

### Step 8: Deploy Frontend (1 min)

```bash
sudo mkdir -p /var/www/frontend/dist
sudo cp -r dist/* /var/www/frontend/dist/
sudo chown -R www-data:www-data /var/www/frontend
```

### Step 9: Configure Nginx (3 min)

```bash
sudo nano /etc/nginx/sites-available/saas-delivery
```

**Paste config from nginx-production.conf** (proxy to localhost:3001)

```bash
sudo ln -s /etc/nginx/sites-available/saas-delivery /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ Verification

```bash
# Check services
pm2 list
# Should show: whatsapp-bot (online), api-server (online)

# Check API
curl http://localhost:3001/api/v1/health
curl http://localhost/api/v1/health

# Check frontend
curl -I http://localhost/

# Check logs
pm2 logs
```

---

## 🔄 Update Commands

### Update Bot & API
```bash
cd /opt/saasDelivery/wwebjs-bot
git pull && npm install && pm2 restart all
```

### Update Frontend
```bash
cd /opt/saasDelivery/wwebjs-bot/client
git pull && npm install && npm run build
sudo cp -r dist/* /var/www/frontend/dist/
sudo systemctl reload nginx
```

---

## 📋 Full Checklist

- [ ] VPS: Node.js, PM2, Nginx installed
- [ ] Repository cloned to `/opt/saasDelivery/wwebjs-bot`
- [ ] Dependencies installed (bot + frontend)
- [ ] `.env.prod` created with Render database URL
- [ ] `ecosystem.config.js` updated (bot + API)
- [ ] Database migrations run (`npm run migrate`)
- [ ] Both services started with PM2
- [ ] WhatsApp QR code scanned
- [ ] Frontend `.env.production` created (empty for relative URLs)
- [ ] Frontend built (`npm run build`)
- [ ] Frontend deployed to `/var/www/frontend/dist`
- [ ] Nginx config created (proxy to localhost:3001)
- [ ] Nginx enabled and reloaded
- [ ] All services tested and working
- [ ] PM2 startup configured

---

## 🎯 Architecture

```
VPS:
├─ WhatsApp Bot (PM2) ──→ API (localhost:3001)
├─ API Server (PM2, port 3001) ──→ Render PostgreSQL
└─ Frontend (Nginx) ──→ API (localhost:3001 via proxy)
```

**Benefits:**
- ✅ Low latency
- ✅ No CORS
- ✅ Lower cost
- ✅ Simpler

---

**Total Time**: ~20 minutes

**See PRODUCTION_DEPLOYMENT_GUIDE.md for detailed instructions**
