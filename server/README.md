# LivSight — API Backend

Node.js REST API for the LivSight delivery management platform (Express 5).

This backend is used by:
- The **web dashboard** in `../client` (cookie-based auth)
- A **vendor mobile app** via `/api/v1/vendor/*` routes (Bearer token auth fallback is supported when enabled)

> **Note:** The WhatsApp bot lives in a separate repository. This repo contains only the REST API and dashboard.

---

## Architecture

```
src/
├── config.js         # Centralized config
├── db/               # Database abstraction (auto-selects SQLite or PostgreSQL)
├── api/              # REST API (server.js + routes/ + middleware/)
├── services/         # Domain services
├── repositories/     # Data access layer
├── utils/            # JWT, password helpers
└── scripts/          # Admin one-off scripts (seed, reset password, etc.)
db/
├── migrate.js        # Migration runner
└── migrations/       # SQL files, executed alphabetically
```

One PM2 process in production:
- `api-server` → `src/api/server.js`

---

## Local Development

### Prerequisites
- Node.js 18+

### Setup

```bash
# SQLite (simplest, no DB setup needed)
cp env.local.sqlite.example .env

# Or PostgreSQL
cp env.local.postgres.example .env
# Edit .env with your DATABASE_URL
```

```bash
npm install
npm run migrate    # Create tables
npm run dev        # API with auto-reload
```

### Key env vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (omit for SQLite) |
| `JWT_SECRET` | Token signing secret |
| `API_PORT` | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `AUTH_HEADER_FALLBACK` | When `true`, allows `Authorization: Bearer <token>` auth (needed for mobile vendor clients that can't use HTTP-only cookies) |
| `BOT_ALERT_WEBHOOK_URL` | Optional Discord/Slack webhook for API error alerts |
| `RECRUITMENT_ALERT_WEBHOOK_URL` | Optional Discord/Slack webhook for new recruitment applications |
| `RECRUITMENT_DASHBOARD_URL` | Optional dashboard URL in recruitment Discord alerts (defaults to first `ALLOWED_ORIGINS`) |

Security notes:
- Do **not** commit `.env` files. Use the `env.*.example` templates instead.
- Rotate any secrets if they were ever committed to git history.

---

## API Endpoints

Base path: `/api/v1/`

For the full contract and examples, see `../API.md`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Current user |
| GET | `/deliveries` | List deliveries (paginated, filtered) |
| POST | `/deliveries` | Create delivery |
| PUT | `/deliveries/:id` | Update delivery |
| GET | `/groups` | List WhatsApp groups |
| GET | `/tariffs` | List tariffs |
| GET | `/stats/daily` | Daily stats |
| GET | `/search` | Search deliveries |
| GET | `/agencies` | List agencies (super admin) |
| POST | `/agencies` | Create agency (super admin) |

---

## Database

Auto-selected based on environment:
- `DATABASE_URL` set → PostgreSQL
- Otherwise → SQLite (`data/bot.db`)

```bash
npm run migrate    # Run pending migrations
npm run test:db    # Test DB connection
```

Migrations live in `db/migrations/`, named `YYYYMMDDHHMMSS_description.sql`, executed alphabetically.

---

## Scripts

```bash
# Seed test deliveries (dev helper)
npm run seed

# Create super admin account
node src/scripts/seed-super-admin.js

# Reset a password
node src/scripts/reset-password.js

# Test DB connection
npm run test:db
```

Other useful scripts live in `src/scripts/` (examples: vendor creation, migration checks, prod migration helpers).

---

## Production

Deployed on VPS via GitHub Actions CD pipeline. See:
- `../PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `../Production Deployment guide.md`
- `../PRODUCTION_TROUBLESHOOTING.md`

```bash
npm start    # node src/api/server.js
```
