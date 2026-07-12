# Test Suite Summary — LivSight Backend

**Framework:** Jest + Supertest
**Total:** 213 tests (195 passed, 18 skipped¹)
**Coverage:** statements ~63% · branches ~55% · functions ~54% · lines ~63% (see `npm run test:coverage` for exact figures)
**Run:** `npm test` · `npm run test:coverage` · `npm run test:db:integration`

> ¹ The 18 real-DB tests are skipped locally when `DATABASE_URL` is not set. They run automatically in CI against the Postgres service container. Use only **non-production** databases for `test:db:integration` and local `DATABASE_URL`.

---

## Structure

```
src/__tests__/
├── helpers/
│   └── createAuthToken.js       JWT factory helpers (agency + super_admin tokens)
├── setEnv.js                    Shared env setup (JWT_SECRET, AUTH_HEADER_FALLBACK)
│
├── unit/                        Pure function tests — no I/O, no Express
│   ├── parser.test.js
│   ├── statusParser.test.js
│   ├── calculations.test.js       imports `src/lib/deliveryCalculations.js` (same code as routes/bot)
│   ├── reportsAggregates.test.js
│   └── authMiddleware.test.js   JWT helpers mocked; exercises `authenticateToken` + `authorizeRole`
│
├── integration/                 HTTP-level tests — mocked DB, real Express router
│   ├── health.test.js
│   ├── auth.test.js
│   ├── deliveries.test.js
│   ├── statusTransitions.test.js
│   ├── stats.test.js
│   ├── tariffs.test.js
│   ├── groups.test.js
│   ├── agencies.test.js
│   ├── reports.test.js
│   └── search.test.js
│
└── db/
    └── realDb.test.js           Real-PostgreSQL tests (skipped without DATABASE_URL)
```

---

## Unit Tests

### `unit/parser.test.js` — 12 tests
Tests `parseDeliveryMessage` and `isDeliveryMessage` from `src/parser.js`.

| Test | Description |
|------|-------------|
| Parses standard 4-line message | `612345678 / 2 robes / 15k / Bonapriso` |
| k-suffix conversion | `15k` → `15000`, `20k` → `20000` |
| Plain numeric amounts | `20000` accepted as-is |
| Quartier extraction | Matches against predefined quartier list |
| Bepanda quartier | Second quartier in the list |
| Invalid: plain greeting | `bonjour` → no valid phone extracted |
| Invalid: empty string | No amount extracted |
| `isDeliveryMessage` rejects greeting | Returns `false` for plain text |
| `isDeliveryMessage` accepts valid message | Returns `true` |
| Rejects status keyword "Livré" | Not a delivery message |
| Rejects status keyword "Échec" | Not a delivery message |
| Rejects plain text | Returns `false` |

---

### `unit/statusParser.test.js` — 14 tests
Tests `parseStatusUpdate` and `isStatusUpdate` from `src/statusParser.js`.

| Test | Description |
|------|-------------|
| "Livré \<phone\>" | Type = `payment` (not `delivered`) |
| "Échec \<phone\>" | Type = `failed` |
| "Numéro ne passe pas \<phone\>" | Type = `failed` |
| "client absent" | Type = `client_absent` |
| "Vient chercher \<phone\>" | Type = `pickup` |
| "Collecté 10k \<phone\>" | Amount = 10000 |
| "Collecté 15k \<phone\>" | Amount = 15000 |
| "Collecté 5k \<phone\>" | Amount = 5000 |
| Phone not starting with 6 | Ignored |
| Missing phone | Handled gracefully |
| `isStatusUpdate` → true for "Livré" | Recognised as status |
| `isStatusUpdate` → true for "Échec" | Recognised as status |
| `isStatusUpdate` → false for delivery | Not a status message |
| `isStatusUpdate` → false for greeting | Not a status message |

---

### `unit/calculations.test.js` — 12 tests
Tests `computeTariffPending`, `roundAmount`, and `computeAmountPaidAfterFee` from **`src/lib/deliveryCalculations.js`** — the same module used by `deliveries` routes and WhatsApp updates, so tests cannot drift from production logic.

| Test | Description |
|------|-------------|
| `computeTariffPending` → true | status=pending, quartier set, fee=0 |
| `computeTariffPending` → true | fee explicitly 0 |
| `computeTariffPending` → false | delivery_fee > 0 |
| `computeTariffPending` → false | status != pending |
| `computeTariffPending` → false | quartier missing |
| `computeTariffPending` case-insensitive | "PENDING" treated same as "pending" |
| `roundAmount` | Rounds to 2 decimal places |
| `roundAmount` whole number | No fractional part |
| `computeAmountPaidAfterFee` | amount_due − delivery_fee (rounded, clamped) |
| `computeAmountPaidAfterFee` clamps at 0 | fee > amount_due → 0, never negative |
| Pickup tariff (1000 FCFA) | amount_paid = amount_due − 1000 |
| Zone1 tariff (500 FCFA) | amount_paid = amount_due − 500 |

---

### `unit/reportsAggregates.test.js` — 5 tests
Tests **`buildReportPdfData`** in `src/lib/reportAggregates.js` (totals, quartier groupings, fixed-status buckets, and `allLivraisonsDetails` display amounts). The group PDF route delegates to this module so unit tests catch sum/regression bugs without parsing PDF output.

---

### `unit/authMiddleware.test.js` — 7 tests
Mocks `src/utils/jwt` and asserts cookie/header token handling: 401 without token, successful decode + `req.user`, logout path with bad token (`req.user = null`, `next`), 401 on invalid token for normal routes, and `authorizeRole` 401/403/`next` behaviour.

---

## Integration Tests

All integration tests use a fully mocked `src/db` module. JWT tokens are generated with `createTestToken` / `createSuperAdminToken` and passed via `Authorization: Bearer` (enabled by `AUTH_HEADER_FALLBACK=true` in `setEnv.js`). `resetMocks: true` in `jest.config.js` clears mock queues between every test.

---

### `integration/health.test.js` — 2 tests

| Test | Expected |
|------|----------|
| `GET /api/v1/health` | 200 `{ status: 'ok' }` |
| `GET /` | 200 API info |

---

### `integration/auth.test.js` — 13 tests

**`POST /api/v1/auth/login`**

| Test | Expected |
|------|----------|
| Missing email | 400 |
| Invalid email format | 400 |
| Password shorter than 6 chars | 400 |
| Agency not found | 401 |
| Wrong password | 401 |
| Disabled account | 403 |
| Valid credentials | 200 + `auth_token` cookie set |

**`POST /api/v1/auth/signup`**

| Test | Expected |
|------|----------|
| Missing name | 400 |
| Email already taken | 409 |
| Valid signup | 201 + cookie set |

**`GET /api/v1/auth/me`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Valid token | 200 with user data |
| Account deleted from DB | 401 |

---

### `integration/deliveries.test.js` — 13 tests

**`GET /api/v1/deliveries`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Authenticated agency | 200 with deliveries array |
| `agency_id` from JWT passed to DB | Verified by mock assertion |
| Super admin filter by `agency_id` query param | Verified |

**`GET /api/v1/deliveries/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Found | 200 with delivery data |

**`POST /api/v1/deliveries`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Missing phone | 400 |
| Missing items | 400 |
| Negative amount_due | 400 |
| Valid payload | 201 with new delivery |

**`DELETE /api/v1/deliveries/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Success | 200 |

---

### `integration/statusTransitions.test.js` — 24 tests
Tests all 8 business logic cases (CAS 1–8) in `PUT /api/v1/deliveries/:id` plus tariff logic at `POST` creation.

**CAS 1: → delivered**

| Test | Expected |
|------|----------|
| Applies quartier tariff, calculates `amount_paid = amount_due − fee` | amount_paid computed correctly |
| fee > amount_due | amount_paid clamped to 0 |
| Partial payment already recorded | Tariff deducted from existing amount_paid |
| Full payment already recorded | Recalculated from amount_due |
| No tariff configured for quartier | Transition allowed, fee unchanged |
| Existing delivery_fee preserved when no tariff | fee kept as-is |

**CAS 2: → client_absent**

| Test | Expected |
|------|----------|
| Applies quartier tariff | delivery_fee set, amount_paid forced to 0 |

**CAS 2.5: quartier change while delivered**

| Test | Expected |
|------|----------|
| Re-fetches tariff for new quartier, recalculates amount_paid | Correct fee + amount_paid |

**CAS 3: → failed**

| Test | Expected |
|------|----------|
| From pending | delivery_fee=0, amount_paid=0 |
| From delivered | delivery_fee=0, amount_paid=0 (full refund) |

**CAS 4: → pickup**

| Test | Expected |
|------|----------|
| Fixed 1000 FCFA | amount_paid = amount_due − 1000 |
| amount_due < 1000 | amount_paid clamped to 0 |

**CAS 5: → present_ne_decroche_zone1**

| Test | Expected |
|------|----------|
| Fixed 500 FCFA | amount_paid forced to 0 |

**CAS 6: → present_ne_decroche_zone2**

| Test | Expected |
|------|----------|
| Fixed 1000 FCFA | amount_paid forced to 0 |

**CAS 7: zone1/zone2 → pending**

| Test | Expected |
|------|----------|
| Leaving zone1 | delivery_fee cancelled (→ 0) |
| Leaving zone2 | delivery_fee cancelled (→ 0) |

**CAS 8: delivered → pending**

| Test | Expected |
|------|----------|
| Resets tariff | delivery_fee=0, amount_paid=0 |

**`tariff_pending` flag lifecycle**

| Test | Expected |
|------|----------|
| After → delivered | tariff_pending=false |
| After → failed | tariff_pending=false |

**Tariff logic at `POST` creation**

| Test | Expected |
|------|----------|
| pending + quartier + no fee | tariff_pending=true |
| status=pickup at creation | Fixed 1000 FCFA, amount_paid calculated |
| status=zone1 at creation | Fixed 500 FCFA, amount_paid=0 |
| status=delivered at creation | DB tariff applied |
| status=client_absent at creation | amount_paid forced to 0 |

---

### `integration/stats.test.js` — 8 tests

**`GET /api/v1/stats/daily`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Invalid date format | 400 |
| Non-existent date (Feb 30) | 400 |
| Valid date | 200 with stats |
| No date param | 200 using today's date |
| Agency user | Scoped to `agency_id` from JWT |
| Super admin with `agency_id` query param | Filters by provided ID |
| `group_id` query param | Passed through to DB call |

---

### `integration/tariffs.test.js` — 27 tests

**`GET /api/v1/tariffs`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Agency user | 200, scoped to their `agency_id` |
| Super admin | 200, all tariffs |

**`GET /api/v1/tariffs/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's tariff | 403 |
| Authorized | 200 with tariff data |

**`POST /api/v1/tariffs`**

| Test | Expected |
|------|----------|
| Missing quartier | 400 |
| Missing tarif_amount | 400 |
| Negative tarif_amount | 400 |
| Duplicate quartier | 409 |
| Valid payload | 201 |
| Different agency_id in body | 403 |

**`PUT /api/v1/tariffs/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's tariff | 403 |
| No valid fields | 400 |
| Negative tarif_amount | 400 |
| Quartier conflict | 409 |
| Valid amount update | 200 |

**`DELETE /api/v1/tariffs/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's tariff | 403 |
| Success | 200 |

**`POST /api/v1/tariffs/import`**

| Test | Expected |
|------|----------|
| No file | 400 |
| Unsupported format (.txt) | 400 |
| Valid CSV — new quartiers | 200 `{ created: 2, updated: 0, errors: [] }` |
| Valid CSV — existing quartier | 200 `{ created: 0, updated: 1, errors: [] }` |
| Invalid tarif_amount in row | 200 with error row reported |
| Missing quartier in row | 200 with error row reported |

---

### `integration/groups.test.js` — 20 tests

**`GET /api/v1/groups`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Agency user | 200, scoped to their agency |
| Super admin | 200, all groups |

**`GET /api/v1/groups/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's group | 403 |
| Authorized | 200 with group data |

**`POST /api/v1/groups`**

| Test | Expected |
|------|----------|
| Missing name | 400 |
| Missing whatsapp_group_id | 400 |
| Invalid WhatsApp Group ID format | 400 |
| Duplicate whatsapp_group_id | 409 |
| Valid payload | 201 |
| Different agency_id in body | 403 |

**`PUT /api/v1/groups/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's group | 403 |
| Name update | 200 |
| Toggle is_active → false | 200 |

**`DELETE /api/v1/groups/:id`**

| Test | Expected |
|------|----------|
| Not found | 404 |
| Another agency's group | 403 |
| Default (soft delete) | 200, `deleteGroup` called |
| `?permanent=true` (hard delete) | 200, `hardDeleteGroup` called |

---

### `integration/agencies.test.js` — 28 tests

**`GET /api/v1/agencies/me`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Super admin | 403 (no associated agency) |
| Agency not found | 404 |
| Agency admin | 200 with own agency data |

**`GET /api/v1/agencies`** *(super admin only)*

| Test | Expected |
|------|----------|
| No token | 401 |
| Agency user | 403 |
| Super admin | 200 with all agencies |

**`GET /api/v1/agencies/:id`** *(super admin only)*

| Test | Expected |
|------|----------|
| Agency user | 403 |
| Not found | 404 |
| Super admin | 200 with agency data |

**`POST /api/v1/agencies`** *(super admin only)*

| Test | Expected |
|------|----------|
| Agency user | 403 |
| Missing name | 400 |
| Missing email | 400 |
| Missing password | 400 |
| agency_code too short (< 4 chars) | 400 |
| agency_code with special characters | 400 |
| Duplicate agency_code | 409 |
| Valid payload (no code) | 201 |
| Valid payload + code normalised to uppercase | 201 |

**`PUT /api/v1/agencies/:id`**

| Test | Expected |
|------|----------|
| Agency user updating another agency | 403 |
| Not found | 404 |
| No valid fields | 400 |
| agency_code conflict (super admin) | 409 |
| Agency admin updates own allowed fields | 200 |
| Super admin updates restricted fields | 200 |

**`DELETE /api/v1/agencies/:id`** *(super admin only)*

| Test | Expected |
|------|----------|
| Agency user | 403 |
| Not found | 404 |
| Success | 200 |

---

### `integration/reports.test.js` — 8 tests
PDFKit is replaced with a class-based `EventEmitter` mock; `pipe()` schedules `res.end()` via `setImmediate` so supertest receives a complete response without real PDF generation.

**`GET /api/v1/reports/groups/:groupId/pdf`**

| Test | Expected |
|------|----------|
| No token | 401 |
| Group not found | 404 |
| Another agency's group | 403 |
| Agency not found for the group | 404 |
| Agency user (happy path) | 200, `Content-Type: application/pdf` |
| Super admin can access any group | 200 |
| Date range params forwarded to DB | `startDate` / `endDate` passed to `getDeliveries` |
| `group_id` scoping | `group_id` passed to `getDeliveries` |

---

### `integration/search.test.js` — 2 tests

**`GET /api/v1/search`**

| Test | Expected |
|------|----------|
| Missing or blank `q` | 400 |
| Valid `q` | 200, `data` / `count` / `query`; `searchDeliveries` called with query string |

---

## Real-DB Integration Tests (skipped locally)

### `db/realDb.test.js` — 18 tests
Run via `npm run test:db:integration` with a live PostgreSQL instance. Skipped automatically when `DATABASE_URL` is not set.

All test rows use unique prefixes (`jest_realdb_`, `TEST9`, `JEST_`) and are cleaned up in `beforeAll` + `afterAll`.

**Agency CRUD**

| Test | Validates |
|------|-----------|
| `createAgency` | Returns a numeric id > 0 |
| `getAgencyByEmail` | Retrieves the created agency by email |
| `getAgencyById` | Retrieves the created agency by id |

**Tariff CRUD + Lookup**

| Test | Validates |
|------|-----------|
| `createTariff` | Returns a numeric id > 0 |
| `getTariffByAgencyAndQuartier` | Returns correct tariff with right amount |
| `getTariffByAgencyAndQuartier` (unknown) | Returns null for unregistered quartier |
| `updateTariff` | Persists the new tarif_amount |
| `getTariffsByAgency` | Includes the test tariff in the list |
| `deleteTariff` | Removes the tariff (returns null after) |

**Delivery CRUD**

| Test | Validates |
|------|-----------|
| `insertDelivery` | Returns a numeric id > 0 |
| `getDeliveryById` | Returns correct phone, amount_due, status |
| `updateDelivery` | Persists status, delivery_fee, amount_paid |

**`getDailyStats` SQL aggregations**
Controlled dataset inserted at `TEST_DATE = '2000-01-01'` (5 deliveries with known amounts).

| Test | Expected value |
|------|---------------|
| Counts by status | total=5, delivered=2, failed=1, pending=1, pickup=1 |
| `total_due` | 55 000 (sum of all amount_due) |
| `total_collected` | 38 500 (sum of all amount_paid) |
| `total_remaining` | 16 500 (sum of amount_due − amount_paid) |
| Empty date | All zeroes |
| Wrong agency_id | total=0 (proper isolation) |

---

## CI Pipeline

```
CI
├── client-ci            Lint + build (no DB)
├── backend-unit         Jest unit + integration tests + coverage thresholds (no DB)
└── backend-ci           Postgres service → migrate → real-DB tests → API smoke test
```

Coverage thresholds enforced in `backend-unit` (see `jest.config.js`; raise gradually as tests grow):

| Metric | Threshold |
|--------|-----------|
| Statements | 62% |
| Branches | 54% |
| Functions | 52% |
| Lines | 62% |

Optional discipline in CI: fail the job if global coverage **drops** compared to `main` (e.g. store baseline artifact and compare `coverage-summary.json`), in addition to these minimums.
