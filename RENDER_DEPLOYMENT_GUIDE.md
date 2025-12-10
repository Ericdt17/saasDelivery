# 🚀 Render Deployment Guide

Complete guide to deploy your SaaS Delivery application on Render.

## Overview

Your application consists of:

1. **Backend API** - Express.js server (`wwebjs-bot/src/api/server.js`)
2. **Frontend** - React + Vite application (`client/`)
3. **Database** - PostgreSQL (hosted on Render)

## Prerequisites

- GitHub repository with your code
- Render account (sign up at https://render.com)
- Local development: Keep using SQLite (default) - your local database will remain separate

## Database Strategy

**Local Development**: SQLite database (`data/bot.db`) - perfect for testing
**Production (Render)**: PostgreSQL database - shared and persistent

Your local SQLite database will remain untouched. Only the Render deployment will use PostgreSQL.

---

## Step 1: Create PostgreSQL Database on Render

1. Go to your Render Dashboard
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `saas-delivery-db` (or your preferred name)
   - **Database**: `deliverybot` (or your preferred name)
   - **User**: `deliverybot` (auto-generated)
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 15 or 16
   - **Plan**: Starter ($7/month) or higher
4. Click **"Create Database"**
5. **IMPORTANT**: Copy the **Internal Database URL** from the database dashboard
   - Format: `postgresql://user:password@hostname:5432/database`

---

## Step 2: Deploy Backend API

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `saas-delivery-api` (or your preferred name)
   - **Region**: Same as database
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `wwebjs-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run api`
   - **Instance Type**: Starter ($7/month) or higher

4. **Environment Variables** - Add these:

   ```
   NODE_ENV=production
   DB_TYPE=postgres
   DATABASE_URL=<paste_internal_database_url_from_step_1>
   API_PORT=10000
   ALLOWED_ORIGINS=https://your-frontend-url.onrender.com,https://your-custom-domain.com
   TIME_ZONE=UTC
   ```

   **Note**: Replace `<paste_internal_database_url_from_step_1>` with the actual database URL

5. Click **"Create Web Service"**

6. **Important**: Update `package.json` to include the `api` script (if not already there):
   ```json
   "scripts": {
     "api": "node src/api/server.js"
   }
   ```

---

## Step 3: Deploy Frontend

### Option A: Static Site (Recommended for Vite apps)

1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `saas-delivery-frontend`
   - **Branch**: `main`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Environment Variables**:

   ```
   VITE_API_BASE_URL=https://your-backend-api-url.onrender.com
   ```

   Replace `your-backend-api-url` with your actual backend service URL from Step 2

5. Click **"Create Static Site"**

### Option B: Web Service (Alternative)

If you prefer a Web Service for the frontend:

1. Click **"New +"** → **"Web Service"**
2. Configure:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l 10000`
3. Add environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend-api-url.onrender.com
   ```

---

## Step 4: Update CORS Settings

After deploying both services, update the backend environment variable:

1. Go to your Backend Web Service → **Environment**
2. Update `ALLOWED_ORIGINS`:
   ```
   ALLOWED_ORIGINS=https://saas-delivery-frontend.onrender.com,https://your-custom-domain.com
   ```
3. Save and redeploy

---

## Step 5: Initialize Database Tables

The PostgreSQL adapter should automatically create tables on first connection. To verify:

1. Go to your Backend service → **Logs**
2. Check for messages like:
   - `✅ PostgreSQL database connected`
   - `✅ Tables initialized successfully`

If tables aren't created automatically, you can manually run the schema:

1. Go to your Database → **Connect** → **PSQL** tab
2. Copy the connection command and run it locally, OR
3. Use Render's built-in PostgreSQL client in the dashboard

**Note**: Your local SQLite database (`wwebjs-bot/data/bot.db`) will remain separate and continue to be used for local development/testing.

---

## Step 6: Verify Deployment

### Backend Health Check

```bash
curl https://your-backend-api-url.onrender.com/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "delivery-bot-api",
  "version": "1.0.0"
}
```

### Frontend

Visit your frontend URL in a browser and verify it loads correctly.

---

## Environment Variables Reference

### Backend (`wwebjs-bot` service)

| Variable          | Required | Description                            | Example                         |
| ----------------- | -------- | -------------------------------------- | ------------------------------- |
| `NODE_ENV`        | Yes      | Environment mode                       | `production`                    |
| `DB_TYPE`         | Yes      | Database type                          | `postgres`                      |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string           | `postgresql://...`              |
| `API_PORT`        | No       | Port for API server                    | `10000` (Render default)        |
| `ALLOWED_ORIGINS` | Yes      | CORS allowed origins (comma-separated) | `https://frontend.onrender.com` |
| `TIME_ZONE`       | No       | Timezone for date operations           | `UTC`                           |

### Frontend (`client` service)

| Variable            | Required | Description     | Example                    |
| ------------------- | -------- | --------------- | -------------------------- |
| `VITE_API_BASE_URL` | Yes      | Backend API URL | `https://api.onrender.com` |

---

## Custom Domain Setup (Optional)

1. Go to your service → **Settings** → **Custom Domains**
2. Add your domain
3. Update DNS records as instructed by Render
4. Update `ALLOWED_ORIGINS` to include your custom domain

---

## Troubleshooting

### Database Connection Issues

**Error**: `Failed to connect to PostgreSQL`

**Solutions**:

1. Verify `DATABASE_URL` uses the **Internal Database URL** (not External)
2. Ensure database and backend are in the same region
3. Check database service is running

### CORS Errors

**Error**: `Not allowed by CORS`

**Solutions**:

1. Update `ALLOWED_ORIGINS` to include your frontend URL
2. Ensure no trailing slashes in URLs
3. Redeploy backend after changing environment variables

### Build Failures

**Backend**:

- Ensure `package.json` has `api` script
- Check Node.js version compatibility
- Verify all dependencies are in `dependencies` (not `devDependencies`)

**Frontend**:

- Ensure `VITE_API_BASE_URL` is set
- Check for TypeScript/build errors
- Verify `dist` folder is generated correctly

### Service Not Starting

1. Check **Logs** tab for error messages
2. Verify start command is correct:
   - Backend: `npm run api`
   - Frontend (if Web Service): `npx serve -s dist -l 10000`

---

## Cost Estimation

- **PostgreSQL Database**: $7/month (Starter)
- **Backend Web Service**: $7/month (Starter) - Free tier available (with limitations)
- **Frontend Static Site**: FREE
- **Total**: ~$14/month (or $7/month if using free tier for backend)

---

## Important Notes

1. **WhatsApp Bot**: The WhatsApp bot functionality (`src/index.js`) requires persistent session storage and may not work on Render's ephemeral file system. Only the API server is deployed.

2. **Database Migrations**: Tables are auto-created on first connection. For production, consider adding migration scripts.

3. **Secrets**: Never commit `.env` files. Use Render's Environment Variables interface.

4. **Auto-Deploy**: Render auto-deploys on git push to the connected branch. Disable if needed in service settings.

5. **Scaling**: For production, consider upgrading to higher-tier plans for better performance and reliability.

---

## Next Steps

1. Set up monitoring and alerts
2. Configure automatic backups for database
3. Add CI/CD pipeline for testing before deployment
4. Set up SSL certificates for custom domains
5. Implement authentication/authorization
6. Add rate limiting to API
