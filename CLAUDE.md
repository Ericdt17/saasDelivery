# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LivSight — a multi-tenant SaaS for agencies, HR check-in, and recruitment. This repo contains three sub-apps:
- **`server/`** — Node.js/Express REST API (PostgreSQL required)
- **`client/`** — React 18 + TypeScript + Vite dashboard (port 5173)
- **`hr-app/`** — Standalone React employee check-in app with face recognition (port 5174)

The delivery/expedition product vertical has been removed from application code (legacy DB tables may still exist). The WhatsApp bot lives in a separate repository and is not part of this codebase.

## Development Commands

### Backend (server/)
```bash
cd server
npm run dev              # Start API server with nodemon
npm run migrate          # Run pending DB migrations
npm run test:db          # Test database connection
npm test                 # Run all unit/integration tests (Jest)
npm test -- --testPathPattern=hr   # Run a single test file by pattern
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Jest with coverage report
DATABASE_URL=postgresql://... npm run test:db:integration  # Real-DB integration tests
```

### Frontend (client/)
```bash
cd client
npm run dev              # Start Vite dev server on port 5173
npm test                 # Run Vitest tests
npm test -- hr           # Run a single test file by pattern
npm run build            # Production build
npm run lint             # ESLint
```

### HR app (hr-app/)
```bash
cd hr-app
npm run dev              # Start on port 5174 (strict — must be 5174 for E2E)
```

### E2E tests (root)
```bash
npm run test:e2e         # Playwright (auto-starts hr-app dev server)
npm run test:e2e:ui      # Playwright with interactive UI
```

### Environment Setup
Copy `server/env.local.postgres.example` → `server/.env` and fill in your Postgres credentials. `DATABASE_URL` is required — the server exits at startup if it is missing.

Frontend: set `VITE_API_BASE_URL` in `client/.env`, or leave empty to use the Vite proxy to `http://localhost:3000`.

## Architecture

### Database
PostgreSQL is required in all environments. `server/src/db/index.js` creates a connection pool and exposes query helpers. `server/src/db/postgres-queries.js` contains all SQL. Migrations run automatically on server startup (unless `SKIP_MIGRATIONS=true`); they can also be run manually with `npm run migrate`.

Migration files live in `server/db/migrations/` and are run in filename-alphabetical order, tracked in a `schema_migrations` table.

### Multi-Tenant Isolation
- Each agency has its own `agency_id` embedded in the JWT token
- All API routes filter data by `req.user.agencyId`
- Super admins (`super_admin` role) can view all agencies; `agency_admin` accounts see only their own data

### Authentication Flow
- JWT stored in HTTP-only cookies (`auth_token`, `sameSite: strict`)
- Frontend `AuthContext` (`client/src/contexts/AuthContext.tsx`) fetches `/api/v1/auth/me` on load to restore sessions
- Backend middleware (`server/src/api/middleware/auth.js`) exposes `authenticateToken`, `authorizeRole`, and `requireSuperAdmin`
- Set `AUTH_HEADER_FALLBACK=true` to also accept `Authorization: Bearer` header (used in integration tests and mobile clients)

### API Structure
- Base path: `/api/v1/`
- Express 5 app in `server/src/api/server.js`
- Routes in `server/src/api/routes/`; newer routes delegate to controllers in `server/src/api/controllers/`
- Registered routes: `auth`, `agencies`, `waitlist`, `recruitment`, `merchant-terms`, `hr`, `settings`
- CORS: allows all localhost origins in dev; validates against `ALLOWED_ORIGINS` in production

### Frontend Service Layer
`client/src/services/api.ts` is the base HTTP client (10 s timeout, `credentials: 'include'`). Domain services (`hr.ts`, `recruitment.ts`, etc.) wrap it. Custom hooks in `client/src/hooks/` expose React Query state. `AgencyContext` (`client/src/contexts/AgencyContext.tsx`) holds the current agency for the session. The main dashboard (`/`) shows HR KPIs for `super_admin`.

### HR Check-in App (`hr-app/`)
A separate lightweight React app (no router, no auth) used by employees to clock in via face recognition (MediaPipe Tasks Vision). It calls the public `/api/v1/hr/checkin/*` endpoints, which are rate-limited and require no JWT. The compiled face-descriptor utility is shared via `shared/hrLandmarkDescriptor.mjs`. E2E tests for this app live in `e2e/`.

### Payslip PDF Generation
- Endpoint: `GET /api/v1/hr/employees/:id/payslip.pdf?year=YYYY&month=M` (JWT required, `agency_admin` or `super_admin`)
- Business logic in `server/src/lib/hrPayslip.js`: computes net pay from `salary_base`, attendance counts, and `countWeekdaysInMonth`. Late-day penalty = half a day's rate.
- Rendered via Puppeteer in `server/src/lib/pdf/renderPayslipPdf.js` using the HTML template at `server/src/templates/payslip.html`. The template uses `{{key}}` mustache-style placeholders — values are HTML-escaped except `logoHtml` (raw). The Puppeteer browser instance is lazily shared across requests.
- Company branding (name, logo, NUI/RCCM, accent color) is stored in the `company_settings` table (singleton row) and resolved via `resolveCompanyBranding()` in `hrPayslip.js`. Falls back to `DEFAULT_COMPANY_BRANDING` if the row is missing.
- Settings API: `GET/PUT /api/v1/settings/company` — `super_admin` only, validated with Zod.
- Frontend settings page: `client/src/pages/config/Parametres.tsx` — shows agency fields for `agency` role and company branding fields for `super_admin`.

### Testing Conventions
- **Server unit/integration tests**: Jest, files in `server/src/__tests__/`. DB layer is mocked via `jest.mock('../../db', ...)`. `setEnv.js` injects test env vars before any module loads.
- **Server real-DB tests**: separate Jest config (`jest.db.config.js`), files in `server/src/__tests__/db/`, need a live `DATABASE_URL`.
- **Client tests**: Vitest, files in `client/src/__tests__/`.
- **E2E tests**: Playwright, files in `e2e/`, target `http://127.0.0.1:5174` (hr-app).

## Key Environment Variables

### Backend
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required — server exits if missing) |
| `DB_TYPE` | `postgres` |
| `JWT_SECRET` | Token signing secret (required in production) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (required in production) |
| `API_PORT` | Server port (default: 3000; Render uses `PORT`) |
| `SKIP_MIGRATIONS` | Set `true` to skip auto-migration on startup |
| `AUTH_HEADER_FALLBACK` | Set `true` to accept `Authorization: Bearer` in addition to cookies |
| `BOT_ALERT_WEBHOOK_URL` | Optional Discord/Slack webhook for startup/error alerts |
| `HR_OFFICE_LAT` / `HR_OFFICE_LNG` / `HR_OFFICE_RADIUS_M` | Geofence centre and radius for check-in validation |
| `HR_CHECKIN_IGNORE_TIME` | Set `true` to skip time-of-day validation during development |

### Frontend
| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend URL; empty = use Vite proxy to `http://localhost:3000` |

## Deployment
- **Backend**: VPS via GitHub Actions CD (`npm run start` → `node src/api/server.js`)
- **Frontend**: Vercel (`npm run build`, output: `client/dist/`)
- Run `npm run migrate` as a pre-deploy step when adding migrations
- Super admin accounts are created via seed scripts — the signup endpoint only allows the `agency` role
