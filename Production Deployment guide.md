# 🚀 Production Deployment Guide

Complete step-by-step guide to deploy your SaaS Delivery app to production:

- **Bot**: WhatsApp bot on VPS (PM2)
- **API**: Backend API on VPS (localhost:3001, PM2)
- **Frontend**: React app on Vercel
- **Database**: PostgreSQL on VPS (Docker)
- **Monitoring**: API HTTP checks (Step 7b), bot PM2 dead-man’s switch (Step 7c), where alerts go (Step 7d), coverage table (Step 7e), optional session webhooks (Step 7f)

---

## 📋 Prerequisites

- ✅ VPS with Ubuntu (your VPS: `157.173.118.238`)
- ✅ Docker installed on VPS
- ✅ SSH access to VPS
- ✅ Domain: `api.livsight.com` → VPS, `app.livsight.com` → Vercel

---

## 🎯 Architecture Overview

```
Internet
   │
   ├─→ app.livsight.com (Vercel)
   │     └─→ React Frontend
   │           └─→ API calls to api.livsight.com
   │
   └─→ api.livsight.com → VPS (157.173.118.238)
         │
         ├─→ Nginx (Port 80/443)
         │     └─→ /api/* → Proxy to localhost:3001
         │
         ├─→ WhatsApp Bot (PM2: whatsapp-bot)
         │     └─→ Calls API at localhost:3001
         │
         ├─→ Backend API (PM2: api-server, Port 3001)
         │     └─→ Connects to localhost:5432
         │
         └─→ PostgreSQL 16 (Docker container: postgres)
               └─→ Volume: postgres_data
                   Port: 127.0.0.1:5432 (localhost only)
```

**Benefits:**
- ✅ Zero transatlantic latency (DB and API on same server)
- ✅ No cloud DB costs
- ✅ Fast API responses (~1ms DB round-trip)
- ✅ Data stays in Europe (Contabo Germany)

---

## Step 1: Prepare VPS

### 1.1 SSH into VPS

```bash
ssh root@157.173.118.238
```

### 1.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Required Software

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh

# Install PostgreSQL client (for pg_dump/psql)
sudo apt install -y postgresql-client

# Verify installations
node --version
npm --version
pm2 --version
nginx -v
docker --version
```

---

## Step 2: Start PostgreSQL with Docker

```bash
docker run -d \
  --name postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=saas_delivery_user \
  -e POSTGRES_PASSWORD=YOUR_DB_PASSWORD \
  -e POSTGRES_DB=saas_delivery_db \
  -p 127.0.0.1:5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16
```

> Port is bound to `127.0.0.1` only — Postgres is NOT exposed to the internet.

Verify it's running:
```bash
docker ps | grep postgres
```

---

## Step 3: Clone Repository

```bash
sudo mkdir -p /opt/saasDelivery
cd /opt/saasDelivery

git clone <your-repo-url> wwebjs-bot
cd wwebjs-bot/wwebjs-bot

npm install --omit=dev
```

---

## Step 4: Configure Environment Variables

```bash
nano /opt/saasDelivery/wwebjs-bot/wwebjs-bot/.env
```

```env
# Node Environment
NODE_ENV=production

# Database (local Docker PostgreSQL)
DB_TYPE=postgres
DATABASE_URL=postgresql://saas_delivery_user:YOUR_DB_PASSWORD@localhost:5432/saas_delivery_db
PG_SSL=false

# API Server
API_PORT=3001

# WhatsApp Bot
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_QR_PATH=./qr
CLIENT_ID=delivery-bot-prod

# JWT Secret (generate: openssl rand -base64 32)
JWT_SECRET=YOUR_JWT_SECRET

# Timezone (important for daily stats)
TIME_ZONE=Africa/Douala

# Logging
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://app.livsight.com

# Auth
AUTH_HEADER_FALLBACK=true
```

> **Important**: If your DB password contains `#`, URL-encode it as `%23` in the DATABASE_URL.
> Example: `Sharp23#21#ss` → `Sharp23%2321%23ss`

---

## Step 5: Run Database Migrations

```bash
cd /opt/saasDelivery/wwebjs-bot/wwebjs-bot
npm run migrate
```

You should see: `Database schema is up to date`

---

## Step 6: Start Services with PM2

```bash
cd /opt/saasDelivery/wwebjs-bot/wwebjs-bot

# Start API server
pm2 start src/api/server.js --name api-server

# Start WhatsApp bot
pm2 start src/index.js --name whatsapp-bot

# Save process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs
```

Verify:
```bash
pm2 list
curl http://localhost:3001/api/v1/health
```

---

## Step 7: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/saas-delivery
```

```nginx
upstream local_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.livsight.com;

    location /api/ {
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

        proxy_pass http://local_api;
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

    location ~ /\. {
        deny all;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/saas-delivery /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 7b: API uptime monitoring (free)

Use an external monitor so you get alerted if the API is down (Nginx, PM2, or the Node process failed). **UptimeRobot** has a usable free tier (HTTP checks, email alerts).

### 7b.1 — Confirm health from your machine

After HTTPS works for the API (or use `http://` only if you have not enabled TLS yet):

```bash
curl -sS https://api.livsight.com/api/v1/health
```

You should see JSON with `"status":"ok"` (and `timestamp`, `service`, `version`).

### 7b.2 — Create a monitor in UptimeRobot

1. Sign up at [UptimeRobot](https://uptimerobot.com) (free account).
2. **Add New Monitor** → type **HTTP(s)**.
3. **URL:** `https://api.livsight.com/api/v1/health`
4. **Friendly name:** e.g. `Livsight API health`.
5. **Interval:** use the free-tier interval (e.g. 5 minutes).
6. **Optional — Keyword:** enable and set keyword to `ok` (or `"status":"ok"`) so you are alerted if the server returns 200 but the body is wrong.
7. Add an **alert contact** (email; add Slack/Telegram later if you use their integrations).

Save the monitor. When it is **Up**, you are done for the API layer.

### 7b.3 — Optional: deeper check (API + database)

Your API also exposes `GET /api/v1/schema/status`, which hits PostgreSQL. A second monitor can alert when the DB path is broken.

- **Trade-off:** the response includes migration metadata. If you prefer not to expose that to the public internet, skip this monitor and rely on `/api/v1/health` plus DB checks from the server (e.g. `docker exec … psql …` in troubleshooting).

If you use it: same steps as above, URL `https://api.livsight.com/api/v1/schema/status`, keyword e.g. `"success":true` or `"status":"up_to_date"` depending on what you want to enforce.

**Where the API alert goes:** you choose when you add an **alert contact** in UptimeRobot (or your tool). See **Step 7d — How you receive alerts** below.

---

## Step 7c: WhatsApp bot process alerts (free, no bot code)

The bot does **not** expose HTTP, so HTTP uptime tools cannot hit it directly. Use **[Healthchecks.io](https://healthchecks.io)** (free tier) as a **dead-man’s switch**: cron on the VPS runs often and **pings Healthchecks only if** PM2 reports `whatsapp-bot` as **online**. If the process stops or crashes, pings stop → Healthchecks notifies you (see Step 7d).

**Detects:** PM2 process missing, `stopped` / `errored`, or not `online`.  
**Does not detect:** WhatsApp session stuck while Node still runs (e.g. logged out in browser) — that needs log-based rules or optional in-bot webhooks (Step 7e).

### 7c.1 — Install `jq` on the VPS

```bash
sudo apt install -y jq
```

### 7c.2 — Create a check in Healthchecks.io

1. Sign up at [Healthchecks.io](https://healthchecks.io) (free).
2. **Add Check** → name e.g. `whatsapp-bot PM2`.
3. **Period:** **5 minutes** (must match cron).
4. **Grace time:** **10 minutes** (reduces false alarms if cron drifts slightly).
5. Copy the **ping URL** (e.g. `https://hc-ping.com/<uuid>`).

### 7c.3 — Ping script on the VPS

```bash
sudo nano /usr/local/bin/livsight-bot-ping.sh
```

Paste (replace the URL with your real ping URL from Healthchecks):

```bash
#!/usr/bin/env bash
set -euo pipefail
HC_PING_URL="https://hc-ping.com/REPLACE_WITH_YOUR_UUID"
STATUS="$(pm2 jlist | jq -r '.[] | select(.name=="whatsapp-bot") | .pm2_env.status' 2>/dev/null || true)"
if [ "$STATUS" = "online" ]; then
  curl -fsS -m 10 "$HC_PING_URL" -o /dev/null
fi
```

```bash
sudo chmod +x /usr/local/bin/livsight-bot-ping.sh
```

The PM2 name must match `pm2 list` (this guide uses **`whatsapp-bot`**). If yours differs, change `"whatsapp-bot"` in the `jq` filter.

### 7c.4 — Cron (run as the same user that owns PM2, often `root`)

```bash
sudo crontab -e
```

Add:

```cron
*/5 * * * * /usr/local/bin/livsight-bot-ping.sh >> /var/log/livsight-bot-ping.log 2>&1
```

### 7c.5 — Verify

```bash
sudo /usr/local/bin/livsight-bot-ping.sh
```

In Healthchecks, the check should show success. After the bot is running (Step 8), you can test alerting with `pm2 stop whatsapp-bot`, wait past **grace time**, confirm you receive a notification, then `pm2 start whatsapp-bot`.

---

## Step 7d: How you receive alerts

Nothing sends you a message until you connect a **destination** in each service. Use one **primary** channel (e.g. email or a private Slack/Discord channel) so real-time alerts are easy to see.

### API monitor (UptimeRobot, Better Stack, etc.)

| Step | What to do |
|------|------------|
| 1 | Open your monitor → **Alert contacts** / **Notifications** (wording varies by product). |
| 2 | Add **email** (simplest). |
| 3 | Optionally add **Slack**, **Microsoft Teams**, **Telegram**, or a **webhook** if the product supports it. |

When the URL fails (or keyword check fails), the provider sends to every contact you attached to that monitor.

### Bot process monitor (Healthchecks.io)

| Step | What to do |
|------|------------|
| 1 | In Healthchecks, open your check (or account **Integrations**). |
| 2 | Add **Email** — you get mail when the check goes **down** (missed pings) and usually when it recovers. |
| 3 | Optional: **Slack**, **Discord**, **Telegram**, **PagerDuty**, or a custom **Webhook** for automation. |

Healthchecks alerts when pings stop arriving within the configured **grace** window — not when WhatsApp disconnects briefly while the process stays up.

### Centralize API + Healthchecks + bot session alerts in Discord

You do **not** need more bot code. Add **Discord** (or a **Discord webhook URL**) inside **each** external tool so everything lands in **one channel** (e.g. `#bot-alerts`).

| Source | Where to configure |
|--------|-------------------|
| **Healthchecks** (PM2 / cron) | Project **Integrations** → **Discord** (OAuth flow) **or** **Webhook** if available — pick the same server/channel. |
| **UptimeRobot** (API URL) | **Alert contacts** → add **Discord** integration, or a contact type that accepts a **webhook URL**. |
| **Better Stack** | Monitor → **Notifications** / **Integrations** → **Discord** or **Slack** / webhook as offered. |
| **Bot session** (`BOT_ALERT_WEBHOOK_URL`) | Already uses a Discord **Incoming Webhook** URL (Step 7f) — use the **same channel**. |

**Practical setup:** create **one** Discord channel for ops. In that channel you can add **multiple Incoming Webhooks** (Server Settings → Integrations → Webhooks) — e.g. name them `healthchecks`, `uptimerobot`, `bot-session` — and paste each tool’s URL where that tool asks for a webhook. That keeps **one place** to read alerts even when products don’t share the same integration type.

If a product only supports **email**, you can still forward to Discord via a bot or third-party bridge, but native **Discord** / **webhook** is simpler when available.

### PM2 alone

**PM2 does not push alerts** to your phone or email by itself. Use **Healthchecks + cron** (Step 7c), or ship logs to a tool with alert rules, or add **in-app notifications** (webhooks) in the bot code.

### Deeper WhatsApp session alerts (webhook)

Implemented in **`wwebjs-bot`** (`src/lib/botAlerts.js`): optional **Discord** or **Slack** incoming webhook when the session misbehaves. Configure **`BOT_ALERT_WEBHOOK_URL`** on the VPS (see **Step 7f**). This is **in addition to** Healthchecks (Step 7c), not a replacement.

---

## Step 7e: Real-time bot monitoring — what you can cover (reference)

For a **real-time** WhatsApp bot, layer monitoring as follows.

| Tier | What | Covered by this guide? |
|------|------|-------------------------|
| **A — Must-have** | API reachable; PM2 `whatsapp-bot` `online` | **Yes** — Step 7b + 7c + 7d |
| **A** | Auth/session broken (`auth_failure`) | **Yes** — Step 7f webhook (instant) |
| **A** | Crash loop (PM2 restarts spiking) | **Optional** — watch `pm2 describe whatsapp-bot` or logs |
| **B** | `client.getState()` not `CONNECTED` while process up | **Yes** — Step 7f periodic check (throttled) |
| **B** | QR shown but not scanned for a long time | **Yes** — Step 7f (throttled) |
| **C** | Every `disconnected` event | **No** — Step 7f alerts only if **still** disconnected after a delay |

**Summary:** Steps **7b–7d** cover **API** and **process** liveness. **Step 7f** adds **session-oriented** alerts via webhook when you set `BOT_ALERT_WEBHOOK_URL`.

---

## Step 7f: Deeper bot alerts (Discord / Slack webhook)

The bot posts to an **incoming webhook** when important things go wrong (no extra services beyond Discord or Slack).

### 7f.1 — Create a webhook

**Discord:** Server settings → Integrations → Webhooks → New Webhook → copy **Webhook URL**.  
**Slack:** Incoming Webhooks app → choose channel → copy **Webhook URL**.

Keep the URL **secret** (same as passwords). Do not commit it to git.

### 7f.2 — Add to `.env` on the VPS

Edit the bot’s `.env` (same file PM2 loads, e.g. under your `wwebjs-bot` deploy path):

```bash
# Required for deeper alerts (omit to disable — Healthchecks-only is fine)
BOT_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
# Optional: discord (default) or slack
# BOT_ALERT_WEBHOOK_TYPE=slack
```

**Slack:** set `BOT_ALERT_WEBHOOK_TYPE=slack` if the URL is `https://hooks.slack.com/...` (or rely on auto-detect from the hostname).

### 7f.3 — Optional tuning (milliseconds)

All optional; defaults are sensible for production.

| Variable | Default | Meaning |
|----------|---------|---------|
| `BOT_ALERT_DISCONNECT_MS` | `300000` (5 min) | After `disconnected`, alert if still down this long (timer cleared on `ready`). |
| `BOT_ALERT_STATE_GRACE_MS` | `180000` (3 min) | No “not CONNECTED” alerts until this long after process start (Puppeteer warm-up). |
| `BOT_ALERT_STATE_INTERVAL_MS` | `120000` (2 min) | How often to poll `getState()`. |
| `BOT_ALERT_NOT_CONNECTED_MS` | `600000` (10 min) | Alert if state ≠ `CONNECTED` continuously this long (skipped while QR is showing). |
| `BOT_ALERT_QR_STALE_MS` | `1200000` (20 min) | Alert if QR still not scanned after this long. |
| `BOT_ALERT_ERROR_COOLDOWN_MS` | `900000` (15 min) | Min gap between throttled `client` **error** webhook alerts. |
| `BOT_ALERT_DELIVERY_DB_COOLDOWN_MS` | `300000` (5 min) | Min gap between **delivery DB save failure** alerts (WhatsApp → `createDelivery`). |
| `BOT_ALERT_REMINDERS_TICK_COOLDOWN_MS` | `600000` (10 min) | Min gap between **reminders worker tick** (DB poll) failure alerts. |
| `BOT_ALERT_REMINDERS_SEND_COOLDOWN_MS` | `600000` (10 min) | Min gap between **reminder send / invalid target** batch alerts (per poll cycle). |

### 7f.4 — Deploy

```bash
cd /path/to/wwebjs-bot
git pull   # or your deploy flow
# add BOT_ALERT_* to .env
pm2 restart whatsapp-bot
```

On startup, logs show either `[botAlerts] Webhook alerts enabled` or `BOT_ALERT_WEBHOOK_URL not set — deeper alerts disabled`.

### 7f.5 — What triggers an alert

| Event | Behavior |
|--------|-----------|
| `auth_failure` | Immediate webhook. |
| `disconnected` | Webhook only if still disconnected after `BOT_ALERT_DISCONNECT_MS` (cleared when `ready` / CONNECTED path runs). |
| State poll | If not `CONNECTED` for `BOT_ALERT_NOT_CONNECTED_MS` (and not waiting on QR). |
| QR | If QR flow active longer than `BOT_ALERT_QR_STALE_MS`. |
| `client` `error` | Throttled (see `BOT_ALERT_ERROR_COOLDOWN_MS`). |
| Delivery **DB save** error | WhatsApp parsed delivery but `createDelivery` threw — throttled (`BOT_ALERT_DELIVERY_DB_COOLDOWN_MS`). |
| Reminders **tick** error | `pollQueuedReminderTargets` / outer tick failed — throttled (`BOT_ALERT_REMINDERS_TICK_COOLDOWN_MS`). |
| Reminders **send** failures | In one poll cycle: `sendMessage` failed or invalid target phone — one summary alert, throttled (`BOT_ALERT_REMINDERS_SEND_COOLDOWN_MS`). |

---

## Step 8: Scan WhatsApp QR Code

```bash
pm2 logs whatsapp-bot --lines 50
```

Scan the QR code with WhatsApp to connect the bot.

---

## 🔄 CI/CD (GitHub Actions)

Deploys automatically on push to `main` (backend only, triggered by changes in `wwebjs-bot/**`):

1. SSHes into VPS
2. `git pull` latest code
3. `npm install --omit=dev`
4. `npm run migrate` (against local Docker Postgres)
5. `pm2 restart api-server && pm2 restart whatsapp-bot`

Frontend is deployed automatically by Vercel on push to `main`.

**No manual steps needed after initial setup.**

---

## 🗄️ Database Management

### Backup
```bash
docker exec postgres pg_dump -U saas_delivery_user saas_delivery_db > /tmp/backup_$(date +%Y%m%d).sql
```

### Restore from backup
```bash
docker exec -i postgres psql -U saas_delivery_user -d saas_delivery_db < /tmp/backup.sql
```

### Connect to DB shell
```bash
docker exec -it postgres psql -U saas_delivery_user -d saas_delivery_db
```

### Check Docker container status
```bash
docker ps | grep postgres
docker logs postgres --tail 20
```

---

## 🔧 Troubleshooting

### API not starting
```bash
pm2 logs api-server --lines 50
# Check .env has correct DATABASE_URL
cat /opt/saasDelivery/wwebjs-bot/wwebjs-bot/.env | grep DATABASE_URL
```

### Database connection error
```bash
# Check Docker container is running
docker ps | grep postgres

# Check connection
docker exec -it postgres psql -U saas_delivery_user -d saas_delivery_db -c "SELECT 1;"
```

### Dashboard showing zeros
```bash
# Verify timezone is set correctly
grep TIME_ZONE /opt/saasDelivery/wwebjs-bot/wwebjs-bot/.env
# Should be: TIME_ZONE=Africa/Douala
```

### Services not starting on boot
```bash
pm2 startup
# Run the command it outputs, then:
pm2 save
# Also ensure Docker is set to auto-start:
sudo systemctl enable docker
```

---

## 📝 Maintenance Commands

### Restart services
```bash
pm2 restart api-server
pm2 restart whatsapp-bot
```

### View logs
```bash
pm2 logs api-server --lines 50
pm2 logs whatsapp-bot --lines 50
```

### Monitor
```bash
pm2 monit
```

### Run migrations manually
```bash
cd /opt/saasDelivery/wwebjs-bot/wwebjs-bot && npm run migrate
```

---

## ✅ Deployment Checklist

- [ ] Docker installed on VPS
- [ ] PostgreSQL Docker container running (`docker ps`)
- [ ] Repository cloned to `/opt/saasDelivery/wwebjs-bot`
- [ ] Dependencies installed (`npm install --omit=dev`)
- [ ] `.env` configured with local `DATABASE_URL`, `PG_SSL=false`, `TIME_ZONE=Africa/Douala`
- [ ] Migrations run (`npm run migrate`)
- [ ] PM2 processes started (api-server, whatsapp-bot)
- [ ] PM2 startup configured (`pm2 startup && pm2 save`)
- [ ] Nginx configured and enabled
- [ ] Free API uptime monitor on `https://api.livsight.com/api/v1/health` (e.g. UptimeRobot) + **alert contact** configured (Step 7b, 7d)
- [ ] Bot process monitor: Healthchecks.io + `/usr/local/bin/livsight-bot-ping.sh` + cron (Step 7c) + **integration** e.g. email (Step 7d)
- [ ] Optional: `BOT_ALERT_WEBHOOK_URL` in bot `.env` for session alerts (Step 7f), then `pm2 restart whatsapp-bot`
- [ ] QR code scanned (WhatsApp connected)
- [ ] CI/CD GitHub secrets set (VPS_HOST, VPS_USER, VPS_SSH_KEY, GH_USERNAME, GH_TOKEN)

---

## 🎉 You're Done!

- **Bot**: Running on VPS with PM2
- **API**: Running on VPS (localhost:3001) with PM2
- **Frontend**: Deployed on Vercel (`app.livsight.com`)
- **Database**: PostgreSQL 16 in Docker on VPS (`localhost:5432`)

**API URL:** `https://api.livsight.com`
**App URL:** `https://app.livsight.com`
