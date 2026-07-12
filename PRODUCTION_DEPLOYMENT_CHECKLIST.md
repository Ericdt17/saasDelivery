# ✅ Production Deployment Quick Checklist

Quick reference checklist for deploying to production (API on VPS).

---

## ⚠️ Next deploy — important changes (Jul 2026)

This release removes the WhatsApp bot from this repo and renames the backend folder.

### What changed in the repo

| Before | After |
|--------|-------|
| `wwebjs-bot/` | `server/` |
| Bot + API (`src/index.js`) | **API only** (`src/api/server.js`) |
| PM2: `whatsapp-bot` + `api-server` | PM2: **`api-server` only** |
| CD watches `wwebjs-bot/**` | CD watches `server/**` |

**Key files updated:**
- `server/package.json` — `start`/`dev` now run `src/api/server.js`; WhatsApp deps removed
- `server/ecosystem.config.js` — API-only PM2 config
- `server/.envexample` — bot/AI/core-API vars removed
- `.github/workflows/cd.yml` — deploy path `/opt/saasDelivery/server` → `cd server`
- `.github/workflows/ci.yml` — paths `server/**`
- `README.md`, `CLAUDE.md`, `server/README.md`

**Removed (bot lives in a separate repo now):**
- `src/index.js`, handlers, parser, reminders worker, WhatsApp scripts
- `whatsapp-web.js`, `openai`, `qrcode` dependencies

### VPS layout after deploy

```
/opt/saasDelivery/server/          ← monorepo root (renamed from wwebjs-bot)
├── client/
├── server/                        ← backend (renamed from wwebjs-bot/)
│   ├── src/api/server.js
│   ├── .env
│   └── ecosystem.config.js
└── ...
```

### Before you deploy — checklist

- [ ] **Push to `main`** — local changes (rename + bot cleanup) must be on `main` for CD to pick them up
- [ ] **VPS repo root** is `/opt/saasDelivery/server` (you already renamed this ✅)
- [ ] **Inner folder** will become `server/` after `git pull` (currently still `wwebjs-bot/` until deploy)
- [ ] **PM2 stale path** — current `exec cwd` may still show `/opt/saasDelivery/wwebjs-bot/wwebjs-bot`; fixed automatically on next deploy restart
- [ ] **Remove old PM2 process** if it exists: `pm2 delete whatsapp-bot` (bot no longer in this repo)
- [ ] **Review `.env`** in `server/.env` — remove unused bot vars (`CLIENT_ID`, `GROUP_ID`, `OPENAI_*`, `CORE_*`, `REPORT_*`) if present; keep `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `API_PORT`
- [ ] **Reminders** — scheduling API remains; WhatsApp send worker removed (sending handled by external bot service)
- [ ] **Healthchecks.io** — if you monitor `whatsapp-bot` PM2, remove or repoint that check (see Production Deployment guide)

### After deploy — verify

```bash
# Correct paths
ls /opt/saasDelivery/server/server/src/api/server.js

# PM2 points to new cwd
pm2 describe api-server | grep "exec cwd"
# Expected: /opt/saasDelivery/server/server

# Only API running (no whatsapp-bot)
pm2 list

# API healthy
curl -s http://localhost:3001/api/v1/health
```

### If CD fails on first deploy after rename

```bash
cd /opt/saasDelivery/server
git fetch origin main && git reset --hard origin/main

# If inner folder didn't rename via git:
mv wwebjs-bot server

cd server
npm install --omit=dev
npm run migrate
pm2 delete whatsapp-bot 2>/dev/null || true
pm2 delete api-server 2>/dev/null || true
pm2 start src/api/server.js --name api-server
pm2 save
```

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
git clone <your-repo-url> server
cd server
cd server && npm install
cd ../client && npm install && cd ..
```

### Step 3: Configure Environment (3 min)

```bash
cd /opt/saasDelivery/server/server
cp .envexample .env
nano .env
```

**Required:**
```env
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/db
API_PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
ALLOWED_ORIGINS=https://your-frontend-domain.com
AUTH_HEADER_FALLBACK=true   # Required for mobile vendor app (Bearer token auth)
```

Optional: `BOT_ALERT_WEBHOOK_URL` for Discord/Slack API error alerts.

### Step 4: Run Migrations (1 min)

```bash
cd /opt/saasDelivery/server/server
npm run migrate
```

### Step 5: Start API (2 min)

```bash
mkdir -p logs
pm2 start src/api/server.js --name api-server
# Or: pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

### Step 6: Build Frontend (2 min)

```bash
cd /opt/saasDelivery/server/client
echo "VITE_API_BASE_URL=" > .env.production  # Empty = relative URLs
npm run build
```

### Step 7: Deploy Frontend (1 min)

```bash
sudo mkdir -p /var/www/frontend/dist
sudo cp -r dist/* /var/www/frontend/dist/
sudo chown -R www-data:www-data /var/www/frontend
```

### Step 8: Configure Nginx (3 min)

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
# Should show: api-server (online) — no whatsapp-bot

# Check API
curl http://localhost:3001/api/v1/health
curl http://localhost/api/v1/health

# Check frontend
curl -I http://localhost/

# Check logs
pm2 logs api-server
```

---

## 🤖 CI/CD Pipeline

Deployments are fully automated via GitHub Actions.

### Triggers
| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** | Push touching `client/**` or `server/**` | Lint, test, build |
| **CD** | Push to `main` touching `server/**` | SSH deploy API to VPS |
| **CD** | Manual (`workflow_dispatch`) | Deploy on demand |

### CD Deploy Steps (automatic on VPS)
```
cd /opt/saasDelivery/server
git fetch + reset --hard
cd server
npm install → migrate → pm2 restart api-server → pm2 save
```

### Manual Deploy Trigger
Go to **GitHub → Actions → CD → Run workflow → Run workflow**

### GitHub Secrets Required
| Secret | Value |
|--------|-------|
| `VPS_HOST` | `157.173.118.238` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Private key (Ed25519) from `/root/.ssh/github_actions` on VPS |
| `GH_USERNAME` / `GH_TOKEN` | For git pull on VPS |

### SSH Key Setup (if key is lost/rotated)
```bash
# On VPS: generate new key
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N "" -C "github-actions-cd"

# Add public key to authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Copy private key content → update VPS_SSH_KEY secret in GitHub
cat ~/.ssh/github_actions
```

### If CD Breaks
```bash
# Manual deploy fallback (run on VPS)
cd /opt/saasDelivery/server
git fetch origin main && git reset --hard origin/main
cd server
npm install --omit=dev
npm run migrate
pm2 restart api-server || pm2 start src/api/server.js --name api-server
pm2 save
```

---

## 🔄 Update Commands

### Update API (manual)
```bash
cd /opt/saasDelivery/server
git fetch origin main && git reset --hard origin/main
cd server && npm install --omit=dev && npm run migrate && pm2 restart api-server
```

### Update Frontend
```bash
cd /opt/saasDelivery/server/client
git pull && npm install && npm run build
sudo cp -r dist/* /var/www/frontend/dist/
sudo systemctl reload nginx
```

---

## 📋 Full Checklist

- [ ] VPS: Node.js, PM2, Nginx installed
- [ ] Repository cloned to `/opt/saasDelivery/server`
- [ ] Backend at `/opt/saasDelivery/server/server`
- [ ] Dependencies installed (server + client)
- [ ] `.env` created in `server/server/` with production values
- [ ] Database migrations run (`npm run migrate`)
- [ ] `api-server` started with PM2 (no `whatsapp-bot`)
- [ ] Frontend `.env.production` created (empty for relative URLs)
- [ ] Frontend built (`npm run build`)
- [ ] Frontend deployed to `/var/www/frontend/dist`
- [ ] Nginx config created (proxy to localhost:3001)
- [ ] Nginx enabled and reloaded
- [ ] All services tested and working
- [ ] PM2 startup configured (`pm2 startup` + `pm2 save`)
- [ ] GitHub secrets set: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GH_USERNAME`, `GH_TOKEN`
- [ ] SSH key public added to `/root/.ssh/authorized_keys` on VPS
- [ ] CD pipeline tested (push to `server/**` or manual trigger)
- [ ] Old `whatsapp-bot` PM2 process removed (if present)
- [ ] `.env` cleaned of bot-only variables

---

## 🎯 Architecture

```
VPS:
├─ API Server (PM2: api-server, port 3001) ──→ PostgreSQL
└─ Frontend (Nginx) ──→ API (localhost:3001 via proxy)

WhatsApp bot: separate repo / service (not deployed from this repo)
```

**Benefits:**
- ✅ Low latency
- ✅ No CORS
- ✅ Lower cost
- ✅ Simpler (API-only deploy)

---

**Total Time**: ~20 minutes

**See Production Deployment guide.md for detailed instructions**
