# ✅ Dev Branch Deployment Quick Checklist

Quick step-by-step checklist for deploying dev branch.

---

## 🎯 Render (Backend) - Dev Branch

### Step 1: Database
- [ ] Go to Render Dashboard → New + → PostgreSQL
- [ ] Name: `saas-delivery-db-dev`
- [ ] Copy **Internal Database URL**

### Step 2: Backend Service
- [ ] Render Dashboard → New + → Web Service
- [ ] Connect GitHub repo
- [ ] **Branch: `dev`** ⚠️ (Change from main)
- [ ] Root Directory: `wwebjs-bot`
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm run api`

### Step 3: Environment Variables (Backend)
- [ ] `NODE_ENV=development` ⚠️ (use `development` for dev branch, not `production`)
- [ ] `DB_TYPE=postgres`
- [ ] `DATABASE_URL=<paste-internal-db-url>`
- [ ] `ALLOWED_ORIGINS=https://your-frontend.vercel.app` (update after frontend deploy)
- [ ] `TIME_ZONE=UTC`

### Step 4: Verify Backend
- [ ] Copy backend URL: `https://your-backend-dev.onrender.com`
- [ ] Test: `curl https://your-backend-dev.onrender.com/api/v1/health`
- [ ] Should return `{"status":"ok",...}`

---

## 🎯 Vercel (Frontend) - Dev Branch

### Step 1: Create Project
- [ ] Go to Vercel Dashboard → Add New → Project
- [ ] Import GitHub repository
- [ ] Root Directory: `client` ⚠️
- [ ] Framework: Vite (or Other)

### Step 2: Configure Build
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### Step 3: Environment Variables (Frontend)
- [ ] Add: `VITE_API_BASE_URL=https://your-backend-dev.onrender.com`
- [ ] ⚠️ NO trailing slash
- [ ] Select: Production, Preview, Development

### Step 4: Deploy from Dev Branch
- [ ] Settings → Git → Change Production Branch to `dev` OR
- [ ] Deployments → Create Deployment → Select `dev` branch
- [ ] Click Deploy

### Step 5: Get Frontend URL
- [ ] Copy Vercel URL: `https://your-frontend-dev.vercel.app`

---

## 🔗 Connect Backend & Frontend

### Update Backend CORS
- [ ] Render Dashboard → Backend Service → Environment
- [ ] Update `ALLOWED_ORIGINS` with Vercel URL
- [ ] Save (auto-redeploys)

### Test Integration
- [ ] Open Vercel URL in browser
- [ ] Open DevTools (F12) → Console
- [ ] Check: No CORS errors ✅
- [ ] Try login: Should work ✅

---

## 🔄 Future Updates

### Update Backend
- [ ] Push to `dev` branch → Auto-deploys on Render

### Update Frontend
- [ ] Push to `dev` branch → Auto-deploys on Vercel

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Update `ALLOWED_ORIGINS` in Render with exact Vercel URL |
| Frontend can't reach backend | Check `VITE_API_BASE_URL` in Vercel env vars |
| Build fails | Check Root Directory is `client` |
| Database errors | Verify `DATABASE_URL` uses Internal URL (not External) |

---

## 📝 URLs to Save

- **Backend URL**: `https://____________________.onrender.com`
- **Frontend URL**: `https://____________________.vercel.app`
- **Database Internal URL**: `postgresql://____________________`

---

**Full Guide**: See [DEV_BRANCH_DEPLOYMENT_GUIDE.md](./DEV_BRANCH_DEPLOYMENT_GUIDE.md) for detailed instructions.

