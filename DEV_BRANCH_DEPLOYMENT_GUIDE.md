# 🚀 Dev Branch Deployment Guide

Complete guide to deploy your `dev` branch on Render (Backend) and Vercel (Frontend).

## 📋 Overview

This guide will help you deploy:

- **Backend API** → Render (from `dev` branch)
- **Frontend** → Vercel (from `dev` branch)

---

## Part 1: Deploy Backend on Render (Dev Branch)

### Step 1: Create PostgreSQL Database (if not exists)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `saas-delivery-db-dev` (or your preferred name)
   - **Database**: `deliverybot_dev` (or your preferred name)
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 15 or 16
   - **Plan**: Starter ($7/month) or Free tier
4. Click **"Create Database"**
5. **IMPORTANT**: Copy the **Internal Database URL** from the database dashboard
   - Format: `postgresql://user:password@hostname:5432/database`
   - You'll need this in Step 2

### Step 2: Deploy Backend API Service

1. In Render Dashboard, click **"New +"** → **"Web Service"**

2. **Connect Repository**:
   - Connect your GitHub repository
   - Select your repository

3. **Basic Settings**:
   - **Name**: `saas-delivery-api-dev` (or your preferred name)
   - **Region**: Same as database
   - **Branch**: `dev` ⚠️ **IMPORTANT: Change from `main` to `dev`**
   - **Root Directory**: `wwebjs-bot`
   - **Environment**: `Node`
   - **Instance Type**: Starter ($7/month) or Free tier

4. **Build & Start Commands**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run api`

5. **Environment Variables** (Click "Advanced" → "Add Environment Variable"):

   ```
   NODE_ENV=development
   DB_TYPE=postgres
   DATABASE_URL=<paste_internal_database_url_from_step_1>
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   TIME_ZONE=UTC
   ```

   **⚠️ Important Notes**:
   - `NODE_ENV=development` - Use `development` for dev branch deployment (not `production`)
   - Replace `<paste_internal_database_url_from_step_1>` with the actual Internal Database URL from Step 1
   - Replace `https://your-frontend.vercel.app` with your actual Vercel URL (you'll get this after deploying frontend)
   - You can update `ALLOWED_ORIGINS` later after frontend is deployed

   **Note on NODE_ENV**:
   - `development` - More relaxed CORS, detailed error messages, better for testing
   - `production` - Strict CORS, optimized performance, minimal error details (use for main/production branch)

6. Click **"Create Web Service"**

7. **Wait for Deployment**:
   - Render will clone your `dev` branch
   - Install dependencies
   - Start the service
   - Check the "Logs" tab to monitor deployment

### Step 3: Verify Backend Deployment

1. Once deployed, Render will show your service URL (e.g., `https://saas-delivery-api-dev.onrender.com`)

2. Test the health endpoint:

   ```bash
   curl https://your-backend-dev.onrender.com/api/v1/health
   ```

3. Expected response:

   ```json
   {
     "status": "ok",
     "timestamp": "...",
     "service": "delivery-bot-api",
     "version": "1.0.0"
   }
   ```

4. **Copy your backend URL** - You'll need it for frontend deployment

---

## Part 2: Deploy Frontend on Vercel (Dev Branch)

### Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. **Import Git Repository**:
   - Select your GitHub repository
   - Click **"Import"**

### Step 2: Configure Project Settings

1. **Project Name**: `saas-delivery-frontend-dev` (or your preferred name)

2. **Framework Preset**:
   - Select **"Vite"** (or leave as "Other" and configure manually)

3. **Root Directory**:
   - Click **"Edit"** next to Root Directory
   - Set to: `client`
   - Click **"Continue"**

4. **Build and Output Settings**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` (default)

5. **Environment Variables** (Click "Environment Variables"):
   - Click **"Add"** and add:
     ```
     Name: VITE_API_BASE_URL
     Value: https://your-backend-dev.onrender.com
     ```
   - **⚠️ Important**:
     - Replace `https://your-backend-dev.onrender.com` with your actual Render backend URL from Part 1, Step 3
     - Make sure there's **NO trailing slash** at the end
     - Select **"Production"**, **"Preview"**, and **"Development"** environments

6. **Git Branch**:
   - **⚠️ IMPORTANT**: Before deploying, click **"Settings"** → **"Git"**
   - Under **"Production Branch"**, you can either:
     - Option A: Keep `main` as production, and manually select `dev` branch for this deployment
     - Option B: Change production branch to `dev` (if you want dev to be your production)
   - For this deployment, we'll use `dev` branch

### Step 3: Deploy

1. **Before clicking "Deploy"**:
   - Go to **"Settings"** → **"Git"**
   - Under **"Production Branch"**, temporarily set it to `dev` OR
   - After creating the project, go to **"Deployments"** tab and create a new deployment from `dev` branch

2. Click **"Deploy"**

3. **Alternative: Deploy from dev branch directly**:
   - After project is created, go to **"Deployments"** tab
   - Click **"..."** → **"Redeploy"**
   - Select **"Use existing Build Cache"** or **"Rebuild"**
   - Or create a new deployment:
     - Click **"Create Deployment"**
     - Select branch: `dev`
     - Click **"Deploy"**

### Step 4: Get Frontend URL

1. Once deployment completes, Vercel will show your deployment URL
2. It will be something like: `https://saas-delivery-frontend-dev.vercel.app`
3. **Copy this URL** - You'll need it to update backend CORS

### Step 5: Update Backend CORS

1. Go back to **Render Dashboard** → Your Backend Service
2. Go to **"Environment"** tab
3. Find `ALLOWED_ORIGINS` variable
4. Update it to include your Vercel URL:
   ```
   ALLOWED_ORIGINS=https://your-frontend-dev.vercel.app
   ```
5. Click **"Save Changes"**
6. Render will automatically redeploy with new environment variables

---

## Part 3: Verify Everything Works

### 1. Test Backend

```bash
# Test health endpoint
curl https://your-backend-dev.onrender.com/api/v1/health

# Test login endpoint (replace credentials)
curl -X POST https://your-backend-dev.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### 2. Test Frontend

1. Open your Vercel URL: `https://your-frontend-dev.vercel.app`
2. Open browser DevTools (F12) → Console tab
3. Check for errors:
   - No CORS errors ✅
   - No network errors ✅
   - API calls succeed ✅

### 3. Test Login

1. Navigate to login page
2. Try logging in with valid credentials
3. Verify you can access the dashboard

---

## 🔄 Updating Deployments

### Update Backend (Render)

1. Push changes to `dev` branch on GitHub
2. Render will automatically detect changes and redeploy
3. Or manually trigger: Render Dashboard → Your Service → **"Manual Deploy"** → Select `dev` branch

### Update Frontend (Vercel)

1. Push changes to `dev` branch on GitHub
2. Vercel will automatically detect changes and create a new deployment
3. Or manually trigger: Vercel Dashboard → Your Project → **"Deployments"** → **"Redeploy"**

---

## 🔧 Troubleshooting

### Backend Issues

**Problem**: Backend not starting

- Check Render logs for errors
- Verify `DATABASE_URL` is correct (Internal Database URL)
- Verify `DB_TYPE=postgres` is set
- Check if database is running

**Problem**: CORS errors

- Verify `ALLOWED_ORIGINS` includes your Vercel URL
- Make sure URL matches exactly (including `https://`)
- Redeploy backend after updating `ALLOWED_ORIGINS`

**Problem**: Database connection errors

- Verify `DATABASE_URL` uses Internal Database URL (not External)
- Check database is running
- Verify database tables exist (run migrations if needed)

### Frontend Issues

**Problem**: Frontend can't reach backend

- Verify `VITE_API_BASE_URL` is set correctly in Vercel
- Check browser console for network errors
- Verify backend URL is accessible (test with curl)

**Problem**: Environment variables not working

- Vercel requires rebuild after adding env vars
- Go to **"Deployments"** → **"Redeploy"** after adding variables
- Verify variable name is exactly `VITE_API_BASE_URL` (case-sensitive)

**Problem**: Build fails

- Check Vercel build logs
- Verify `Root Directory` is set to `client`
- Verify `Build Command` is `npm run build`
- Verify `Output Directory` is `dist`

---

## 📝 Environment Variables Summary

### Render (Backend)

```
NODE_ENV=development
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@hostname:5432/database
ALLOWED_ORIGINS=https://your-frontend-dev.vercel.app
TIME_ZONE=UTC
```

**Note**: Use `NODE_ENV=development` for dev branch. Use `NODE_ENV=production` only for production/main branch deployments.

### Vercel (Frontend)

```
VITE_API_BASE_URL=https://your-backend-dev.onrender.com
```

**Important Notes**:

- `VITE_API_BASE_URL` must NOT have trailing slash
- `ALLOWED_ORIGINS` must match exact frontend URL (including https://)
- Frontend must be rebuilt after changing `VITE_API_BASE_URL`
- Backend must be redeployed after changing `ALLOWED_ORIGINS`

---

## 🎯 Quick Checklist

### Backend (Render)

- [ ] PostgreSQL database created
- [ ] Backend service created
- [ ] Branch set to `dev`
- [ ] Root directory set to `wwebjs-bot`
- [ ] All environment variables set
- [ ] Backend URL copied
- [ ] Health endpoint returns 200

### Frontend (Vercel)

- [ ] Project created and connected to GitHub
- [ ] Root directory set to `client`
- [ ] Branch set to `dev`
- [ ] `VITE_API_BASE_URL` environment variable set
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Frontend deployed successfully
- [ ] Frontend URL copied

### Integration

- [ ] Backend `ALLOWED_ORIGINS` updated with Vercel URL
- [ ] Backend redeployed after CORS update
- [ ] Frontend can reach backend (no CORS errors)
- [ ] Login functionality works
- [ ] All features working as expected

---

## 🔐 Security Notes

1. **Database URL**: Always use Internal Database URL in Render (not External)
2. **Environment Variables**: Never commit sensitive data to Git
3. **CORS**: Only allow your frontend URL in `ALLOWED_ORIGINS`
4. **Branch Protection**: Consider protecting your `dev` branch if working in a team

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Production Troubleshooting Guide](./PRODUCTION_TROUBLESHOOTING.md)

---

## 🆘 Need Help?

If something doesn't work:

1. Check the [Production Troubleshooting Guide](./PRODUCTION_TROUBLESHOOTING.md)
2. Check Render logs (Dashboard → Service → Logs)
3. Check Vercel build logs (Dashboard → Project → Deployments → Click deployment → Build Logs)
4. Check browser console for errors
5. Verify all environment variables are set correctly
