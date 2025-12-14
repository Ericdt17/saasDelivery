# 🚀 Netlify Dev Branch Deployment Guide

Complete guide to deploy your frontend from `dev` branch on Netlify.

---

## 📋 Quick Configuration

Based on your Netlify form, here's what to fill in:

### Required Settings

1. **Branch to deploy**: `dev` ✅ (Already selected)

2. **Base directory**: 
   ```
   client
   ```
   ⚠️ **Important**: This tells Netlify where your frontend code is located

3. **Build command**:
   ```
   npm run build
   ```

4. **Publish directory**:
   ```
   dist
   ```
   ⚠️ **Important**: This is where Vite outputs the built files

5. **Functions directory**: 
   ```
   netlify/functions
   ```
   (Leave as default - you don't need this for a static frontend)

---

## 🔧 Step-by-Step Configuration

### Step 1: Connect Repository

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to **GitHub** (or GitLab/Bitbucket)
4. Select your repository
5. Click **"Import"**

### Step 2: Configure Build Settings

On the deployment settings page:

1. **Branch to deploy**: 
   - Select `dev` from dropdown ✅

2. **Base directory**: 
   - Enter: `client`
   - This is the folder containing your `package.json` and `vite.config.ts`

3. **Build command**: 
   - Enter: `npm run build`
   - This runs Vite to build your React app

4. **Publish directory**: 
   - Enter: `dist`
   - This is where Vite outputs the built files

5. **Functions directory**: 
   - Leave as default: `netlify/functions`
   - (Not needed for static frontend)

### Step 3: Set Environment Variables

1. Scroll down to **"Environment variables"** section
2. Click **"Add variable"**
3. Add the following:

   **Variable name**: `VITE_API_BASE_URL`
   
   **Value**: `https://your-backend-dev.onrender.com`
   
   ⚠️ **Important**: 
   - Replace `your-backend-dev.onrender.com` with your actual Render backend URL
   - Make sure there's **NO trailing slash** at the end
   - Example: `https://saas-delivery-api-dev.onrender.com` ✅
   - NOT: `https://saas-delivery-api-dev.onrender.com/` ❌

4. Click **"Add variable"**

### Step 4: Deploy

1. Click **"Deploy site"** button
2. Netlify will:
   - Clone your `dev` branch
   - Install dependencies (`npm install`)
   - Run build command (`npm run build`)
   - Deploy the `dist` folder

3. Wait for deployment to complete (usually 2-5 minutes)

### Step 5: Get Your Frontend URL

1. Once deployment completes, Netlify will show your site URL
2. It will be something like: `https://random-name-123.netlify.app`
3. You can customize it in **Site settings** → **Change site name**
4. **Copy this URL** - You'll need it to update backend CORS

---

## 🔗 Update Backend CORS

After getting your Netlify URL:

1. Go to **Render Dashboard** → Your Backend Service
2. Go to **"Environment"** tab
3. Find `ALLOWED_ORIGINS` variable
4. Update it to include your Netlify URL:
   ```
   ALLOWED_ORIGINS=https://your-site.netlify.app
   ```
5. Click **"Save Changes"**
6. Render will automatically redeploy with new CORS settings

---

## 📝 Complete Configuration Summary

| Setting | Value |
|---------|-------|
| **Branch** | `dev` |
| **Base directory** | `client` |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Functions directory** | `netlify/functions` (default) |
| **Environment Variable** | `VITE_API_BASE_URL=https://your-backend-dev.onrender.com` |

---

## ✅ Verification Checklist

After deployment:

- [ ] Netlify shows "Published" status
- [ ] Site URL is accessible
- [ ] Open site in browser
- [ ] Open DevTools (F12) → Console
- [ ] Check: No CORS errors ✅
- [ ] Check: No network errors ✅
- [ ] Try logging in - should work ✅

---

## 🔄 Updating Your Deployment

### Automatic Updates

- Push changes to `dev` branch → Netlify auto-deploys
- Netlify will detect new commits and rebuild

### Manual Redeploy

1. Go to Netlify Dashboard → Your Site
2. Click **"Deploys"** tab
3. Click **"Trigger deploy"** → **"Deploy site"**

### Update Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Edit `VITE_API_BASE_URL` if backend URL changes
3. Click **"Save"**
4. Go to **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

---

## 🚨 Troubleshooting

### Build Fails

**Problem**: Build command fails

**Solutions**:
- Check **Base directory** is set to `client`
- Verify `package.json` exists in `client` folder
- Check build logs in Netlify for specific errors
- Try building locally: `cd client && npm run build`

### Environment Variables Not Working

**Problem**: `VITE_API_BASE_URL` not found

**Solutions**:
- Verify variable name is exactly `VITE_API_BASE_URL` (case-sensitive)
- Make sure variable is set for correct environment (Production/Preview/Development)
- Redeploy after adding/updating variables
- Check browser console: `console.log(import.meta.env.VITE_API_BASE_URL)`

### CORS Errors

**Problem**: Browser shows CORS errors

**Solutions**:
- Verify `ALLOWED_ORIGINS` in Render includes your Netlify URL
- Make sure URL matches exactly (including `https://`)
- Redeploy backend after updating CORS
- Check Netlify URL doesn't have trailing slash

### Site Shows 404 or Blank Page

**Problem**: Site loads but shows blank page or 404

**Solutions**:
- Verify **Publish directory** is set to `dist`
- Check that `dist/index.html` exists after build
- Check browser console for JavaScript errors
- Verify React Router is configured correctly

---

## 📚 Netlify-Specific Features

### Custom Domain

1. Go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Follow instructions to configure DNS

### Preview Deployments

- Netlify automatically creates preview deployments for pull requests
- Each PR gets its own URL for testing
- Environment variables apply to previews too

### Build Hooks

- Set up build hooks to trigger deployments from external services
- Useful for CI/CD pipelines

---

## 🔐 Security Notes

1. **Environment Variables**: Never commit sensitive data
2. **CORS**: Only allow your frontend URL in backend CORS
3. **HTTPS**: Netlify provides free SSL certificates automatically
4. **Branch Protection**: Consider protecting `dev` branch if working in a team

---

## 📝 Quick Reference

### Netlify Settings
```
Branch: dev
Base directory: client
Build command: npm run build
Publish directory: dist
```

### Environment Variable
```
VITE_API_BASE_URL=https://your-backend-dev.onrender.com
```

### Backend CORS (Render)
```
ALLOWED_ORIGINS=https://your-site.netlify.app
```

---

## 🆘 Need Help?

1. Check Netlify build logs (Dashboard → Site → Deploys → Click deployment)
2. Check browser console for errors
3. Verify all settings match this guide
4. Test backend URL is accessible: `curl https://your-backend-dev.onrender.com/api/v1/health`

---

**That's it!** Your frontend should now be deployed on Netlify from the `dev` branch. 🎉


