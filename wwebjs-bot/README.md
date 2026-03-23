# LivSight — Bot & API

Node.js backend for the LivSight delivery management platform. Includes a WhatsApp bot (whatsapp-web.js) and a REST API (Express 5).

---

## Architecture

```
src/
├── index.js          # Bot entry point (WhatsApp client)
├── parser.js         # Parses WhatsApp messages → delivery objects
├── statusParser.js   # Detects status keywords (livré, échec, absent…)
├── daily-report.js   # Daily report generation
├── config.js         # Centralized config
├── db/               # Database abstraction (auto-selects SQLite or PostgreSQL)
├── api/              # REST API (server.js + routes/ + middleware/)
├── utils/            # JWT, password, group helpers
└── scripts/          # Admin one-off scripts (seed, reset password, etc.)
db/
├── migrate.js        # Migration runner
└── migrations/       # SQL files, executed alphabetically
```

Two PM2 processes in production:
- `whatsapp-bot` → `src/index.js`
- `api-server` → `src/api/server.js`

---

## Local Development

### Prerequisites
- Node.js 18+
- A WhatsApp account (for bot)

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
npm run dev        # Bot + API with auto-reload
npm run api:dev    # API only (no WhatsApp)
```

### Key env vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (omit for SQLite) |
| `JWT_SECRET` | Token signing secret |
| `API_PORT` | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `CLIENT_ID` | WhatsApp LocalAuth session ID |
| `REPORT_ENABLED` / `REPORT_TIME` | Daily report config |

---

## WhatsApp Message Format

```
612345678
2 robes + 1 sac
15k
Bonapriso
```

- **Line 1**: Phone number (must start with 6, 9 digits)
- **Line 2**: Items description
- **Line 3**: Amount (`15k` = 15 000 FCFA, or `15000`)
- **Line 4**: Quartier (neighbourhood)

Optionally add a carrier on line 5: `Men Travel`, `General Voyage`, etc.

**Status updates** — reply to a bot message with a keyword:
- `livré` → delivered
- `échec` / `annulé` → failed
- `absent` → client absent
- `pickup` → pickup
- `expédition` → expedition

---

## API Endpoints

Base path: `/api/v1/`

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
# Create super admin account
node src/scripts/seed-super-admin.js

# Reset a password
node src/scripts/reset-password.js

# Test DB connection
node src/scripts/test-db-connection.js
```

---

## Production

Deployed on VPS via GitHub Actions CD pipeline. See `PRODUCTION_DEPLOYMENT_CHECKLIST.md` in the repo root.

```bash
npm start    # node src/index.js
```
