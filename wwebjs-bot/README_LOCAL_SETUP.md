# 🏠 Local Development Setup

This guide explains how to set up your local development environment that uses SQLite, separate from your Render PostgreSQL database.

## Quick Setup

1. **Copy the example environment file**:
   ```bash
   cd wwebjs-bot
   cp .env.example .env
   ```

2. **Your `.env` file is already configured** for local development:
   - Uses SQLite by default (`DB_TYPE=sqlite`)
   - Database file: `data/bot.db` (gitignored)
   - Port: `3000`

3. **Start the API server**:
   ```bash
   npm run api
   ```

That's it! Your local development uses SQLite and won't affect your Render PostgreSQL database.

## Environment Variables Explained

### For Local Development (SQLite)

Your `.env` file should have:
```env
DB_TYPE=sqlite
DB_PATH=./data/bot.db
API_PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

This keeps your local SQLite database separate from production.

### For Production (PostgreSQL on Render)

Render will automatically set:
```env
DB_TYPE=postgres
DATABASE_URL=<render-internal-database-url>
NODE_ENV=production
PORT=10000
```

## Database Locations

- **Local Development**: `wwebjs-bot/data/bot.db` (SQLite file)
- **Production**: PostgreSQL database on Render (cloud-hosted)

Both databases are completely independent. Changes in one don't affect the other.

## Testing Locally

```bash
# Start API server
npm run api

# In another terminal, test the API
curl http://localhost:3000/api/v1/health

# Or use your frontend
cd ../client
npm run dev
```

## Switching Between Databases

If you ever want to test with PostgreSQL locally:

1. Install PostgreSQL locally or use Docker
2. Update your `.env`:
   ```env
   DB_TYPE=postgres
   DATABASE_URL=postgresql://user:password@localhost:5432/deliverybot
   ```
3. Restart the API server

But for development, SQLite is recommended - it's simpler and faster for local testing.

## Important Notes

- ✅ Your local SQLite database (`data/bot.db`) is gitignored
- ✅ Local development defaults to SQLite (no setup needed)
- ✅ Render deployment uses PostgreSQL (configured in Render dashboard)
- ✅ Both databases are independent - safe to test locally without affecting production




