# 🚀 Quick Render Deployment Checklist

Follow these steps in order:

## 1️⃣ Create PostgreSQL Database

**Render Dashboard** → **New +** → **PostgreSQL**
- Name: `saas-delivery-db`
- Database: `deliverybot`
- Plan: Starter ($7/month)
- **Copy the Internal Database URL** (you'll need this in step 2)

**Note**: Your local SQLite database (`data/bot.db`) will remain separate for testing. Only Render will use PostgreSQL.

---

## 2️⃣ Deploy Backend API

**Render Dashboard** → **New +** → **Web Service**

### Basic Settings:
- **Repository**: Connect your GitHub repo
- **Name**: `saas-delivery-api`
- **Region**: Same as database
- **Branch**: `main`
- **Root Directory**: `wwebjs-bot`

### Build & Start:
- **Build Command**: `npm install`
- **Start Command**: `npm run api`
- **Instance Type**: Starter ($7/month) or Free

### Environment Variables:
Add these in the Environment tab:
```
NODE_ENV=production
DB_TYPE=postgres
DATABASE_URL=<paste_internal_database_url_from_step_1>
ALLOWED_ORIGINS=https://saas-delivery-frontend.onrender.com
TIME_ZONE=UTC
```

**Note**: Render automatically sets `PORT`, so you don't need to include it.

**⚠️ Important**: Replace `<paste_internal_database_url_from_step_1>` with the actual URL from Step 1

Click **Create Web Service**

---

## 3️⃣ Deploy Frontend

**Render Dashboard** → **New +** → **Static Site**

### Basic Settings:
- **Repository**: Same GitHub repo
- **Name**: `saas-delivery-frontend`
- **Branch**: `main`
- **Root Directory**: `client`

### Build Settings:
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### Environment Variables:
```
VITE_API_BASE_URL=https://saas-delivery-api.onrender.com
```

**⚠️ Important**: Replace `saas-delivery-api` with your actual backend service name

Click **Create Static Site**

---

## 4️⃣ Update CORS (After Frontend is Deployed)

1. Go to **Backend Service** → **Environment**
2. Update `ALLOWED_ORIGINS` with your actual frontend URL:
   ```
   ALLOWED_ORIGINS=https://saas-delivery-frontend.onrender.com
   ```
3. **Save** (service will auto-redeploy)

---

## 5️⃣ Verify Everything Works

### Test Backend:
```bash
curl https://your-backend-url.onrender.com/api/v1/health
```

Should return:
```json
{"status":"ok",...}
```

### Test Frontend:
Visit: `https://your-frontend-url.onrender.com`

---

## 🎯 Your URLs Will Be:
- Backend: `https://saas-delivery-api.onrender.com`
- Frontend: `https://saas-delivery-frontend.onrender.com`

---

## ❓ Need Help?

See `RENDER_DEPLOYMENT_GUIDE.md` for detailed instructions and troubleshooting.

