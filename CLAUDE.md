# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LivSight — a multi-tenant SaaS delivery management system with two main components in this repo:
- **`server/`** — Node.js/Express REST API
- **`client/`** — React 18 + TypeScript + Vite frontend dashboard
- **Database** — PostgreSQL (production) or SQLite (development), selectable via env vars

The WhatsApp bot lives in a separate repository and is not part of this codebase.

## Development Commands

### Backend (server/)
```bash
cd server
npm run dev          # Start API server with nodemon (src/api/server.js)
npm run migrate      # Run pending DB migrations (auto-detects SQLite vs Postgres)
npm run test:db      # Test database connection
```

### Frontend (client/)
```bash
cd client
npm run dev          # Start Vite dev server on port 5173
npm run build        # Production build
npm run lint         # ESLint
```

### Environment Setup
Copy the appropriate env example file for your backend:
- `server/env.local.sqlite.example` → `server/.env` (SQLite, simplest for dev)
- `server/env.local.postgres.example` → `server/.env` (PostgreSQL)

Frontend: Set `VITE_API_BASE_URL` in `client/.env`, or leave empty to use Vite proxy to `http://localhost:3000`.

## Architecture

### Database Adapter Pattern
The backend auto-selects the database based on environment:
- If `DATABASE_URL` is set → PostgreSQL (`pg` library)
- Otherwise → SQLite (`better-sqlite3`)

`server/src/db.js` contains all query functions. `server/db/migrate.js` runs migrations from `server/db/migrations/` in alphabetical order, tracking executed files in a `schema_migrations` table.

### Multi-Tenant Isolation
- Each agency has its own `agency_id` embedded in the JWT token
- All API routes automatically filter data by `req.user.agencyId`
- Super admins can view all agencies; regular agency accounts see only their data

### Authentication Flow
- JWT stored in HTTP-only cookies (`auth_token`, 15-minute expiry, `sameSite: strict`)
- Frontend `AuthContext` (`client/src/contexts/AuthContext.tsx`) fetches `/api/v1/auth/me` on load to restore sessions
- Backend middleware (`server/src/api/middleware/auth.js`) validates the cookie on every protected route

### Status Vocabulary (Important)
Backend uses English statuses; frontend displays French labels:

| Backend | Frontend display |
|---------|-----------------|
| `pending` | en cours |
| `delivered` | livré |
| `failed` / `cancelled` | annulé |
| `pickup` | pickup |
| `expedition` | expédition |
| `client_absent` | client absent |

Transformation logic lives in `client/src/lib/data-transform.ts`.

### API Structure
- Base path: `/api/v1/`
- Express 5 app in `server/src/api/server.js`
- Routes in `server/src/api/routes/` (auth, agencies, groups, deliveries, tariffs, stats, search, reports, expeditions, reminders, recruitment, vendors, waitlist)
- CORS: allows all in dev, validates against `ALLOWED_ORIGINS` env var in production (credentials: true required for cookie auth)

### Frontend Service Layer
`client/src/services/api.ts` is the base HTTP client (10s timeout, `credentials: 'include'`). Domain-specific services (`deliveries.ts`, `groups.ts`, etc.) wrap it. State management uses React Query (`@tanstack/react-query`).

## Key Environment Variables

### Backend
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (triggers Postgres mode) |
| `DB_TYPE` | `sqlite` or `postgres` |
| `JWT_SECRET` | Token signing secret (required in production) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `API_PORT` | Server port (default: 3000) |
| `BOT_ALERT_WEBHOOK_URL` | Optional Discord/Slack webhook for API error alerts |

### Frontend
| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend URL; empty = use Vite proxy |

## Deployment
- **Backend**: VPS via GitHub Actions CD (`npm run start` → `node src/api/server.js`)
- **Frontend**: Vercel (`npm run build`, output: `client/dist/`)
- Run `npm run migrate` as a pre-deploy step when adding migrations
- Super admin accounts are created via seed scripts, not the signup endpoint (signup only allows `agency` role)
