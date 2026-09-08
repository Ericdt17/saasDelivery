# Plan — Module RH (pointage + admin)

> **Branche :** `feat/hr` (renommée depuis `feat/empoyee` ; WIP merchant-terms conservé sur cette branche)  
> **Méthode :** TDD obligatoire (Red → Green → Refactor)  
> **Hors scope pour l’instant :** fiches de paie PDF + envoi email (Phase 7)

---

## Décisions figées (Phase 0)

| Sujet | Choix | Statut |
|-------|-------|--------|
| Branche | Renommer `feat/empoyee` → `feat/hr` ; garder tout le WIP | ✅ |
| Schéma `employees` | **Étendre** la migration recrutement (ALTER) : `application_id` nullable + `poste`, `salary_base`, `face_descriptor`, `is_active`, `enrolled_at` | ✅ |
| Accès admin | `super_admin` uniquement | ✅ |
| Timezone pointage | `Africa/Douala` (8h30 / 12h00) | ✅ |
| Multi-tenant | Roster global H-Groupe (pas d’`agency_id` sur employé) | ✅ |
| Playwright | Racine monorepo, dossier `e2e/` | ✅ |
| Email / PDF paie | **Plus tard** (Phase 7) | ✅ reporté |

---

## Stack de tests

| Couche | Outil | Emplacement |
|--------|-------|-------------|
| Backend API / DB | **Jest** + Supertest (déjà en place) | `server/src/__tests__/integration/hr.test.js` |
| Frontend admin (unit) | **Vitest** (déjà en place) | `client/src/**/*.test.ts(x)` |
| E2E (hr-app + flows critiques) | **Playwright** | `e2e/` (racine) |

> Commande E2E : `npm run test:e2e` (ou `npx playwright test`).  
> Utilisé surtout pour le flow check-in (caméra/GPS mockés) à partir de la Phase 6.

### Boucle TDD (chaque slice)

1. **Red** — écrire le test qui échoue  
2. **Green** — code minimal  
3. **Refactor** — nettoyer  
4. Lancer les tests concernés avant de passer à la slice suivante  
5. Commit uniquement sur demande explicite

---

## Vue d’ensemble des phases

```
Phase 0   Prérequis (branche, décisions, Playwright)
Phase 1   Migration DB (employees étendus + attendances)
Phase 2   Backend employés (CRUD + enroll)
Phase 3   Backend check-in public (face + GPS + règles métier)
Phase 4   Backend attendances (liste + summary)
Phase 5   Dashboard admin (Employees + Attendances)
Phase 6   hr-app (web app pointage) + E2E Playwright
Phase 7   ⏸ PLUS TARD — Payslips PDF + email
```

Ne pas avancer à la phase N+1 tant que les tests de la phase N ne sont pas verts.

---

## Phase 0 — Prérequis

**Objectif :** base de travail propre, sans feature métier.

- [x] Renommer `feat/empoyee` → `feat/hr` (WIP conservé, y compris merchant-terms)
- [x] Trancher le conflit schéma `employees` → **étendre** (voir tableau décisions)
- [x] Timezone `Africa/Douala` + rôle `super_admin` figés ci-dessus

### Phase 0b — Installer Playwright

- [x] Playwright à la racine, tests dans `e2e/`
- [x] Smoke test : page HTML locale + `expect` basique
- [x] Commandes : `npm run test:e2e` / `npm run test:e2e:ui` (ou `npx playwright test`)

**Tests :** smoke Playwright uniquement (pas de métier).

---

## Phase 1 — Migration SQL

**Objectif :** tables prêtes pour pointage (sans payslips).

### Tables

**`employees`** (étendre ou recréer selon décision) — champs RH minimum :

- `full_name`, `email` UNIQUE, `phone`, `poste`, `salary_base`
- `face_descriptor` JSONB (array 128 floats) — **jamais exposé en API**
- `is_active` DEFAULT true, `enrolled_at`, `created_at`

**`attendances` :**

- `employee_id` FK, `date`, `check_in_time`
- `status` : `present` | `late` | `absent`
- `face_verified`, `gps_verified`, `latitude`, `longitude`
- `UNIQUE (employee_id, date)`

**Hors scope Phase 1 :** table `payslips`.

### TDD

- [ ] Test migration / schema (ou integration qui insert/select sur les nouvelles tables)
- [ ] `npm run migrate` OK en local (Postgres recommandé pour JSONB)

**Fichiers :**

- `server/db/migrations/YYYYMMDDHHMMSS_*.sql`
- éventuellement ajuster `20260719192657_create_employees_table.sql` si non encore appliquée en prod

---

## Phase 2 — Backend employés (admin)

**Objectif :** CRUD + enrollment facial.

### Routes (`authenticateToken` + `requireSuperAdmin`)

| Méthode | Route | Body / notes |
|---------|-------|--------------|
| `GET` | `/api/v1/hr/employees` | liste sans `face_descriptor` |
| `POST` | `/api/v1/hr/employees` | `{ full_name, email, phone, poste, salary_base }` |
| `PATCH` | `/api/v1/hr/employees/:id` | mise à jour champs non sensibles |
| `POST` | `/api/v1/hr/employees/:id/enroll` | `{ face_descriptor }` → set `enrolled_at` |

### TDD (Red d’abord)

Fichier : `server/src/__tests__/integration/hr.test.js`

- [ ] `POST` employé → `201`
- [ ] email dupliqué → `409`
- [ ] `agency` → `403`
- [ ] `GET` liste → pas de `face_descriptor` dans le JSON
- [ ] `POST …/enroll` → employé marqué enrolled ; descriptor jamais renvoyé
- [ ] `PATCH` → champs mis à jour

**Implémentation ensuite :**

- `server/src/api/routes/hr.js`
- `server/src/api/controllers/hr.controller.js`
- queries dans `postgres-queries.js` + export `db/index.js`
- `app.use('/api/v1/hr', hrRouter)` dans `server.js`

---

## Phase 3 — Backend check-in (public)

**Objectif :** pointage sécurisé pour `rh.livsight.com`.

### Routes publiques (sans auth)

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/api/v1/hr/checkin/verify-email?email=` | email existe + actif + enrolled ? |
| `POST` | `/api/v1/hr/checkin` | pointage |

### Body check-in

```json
{ "email", "face_descriptor", "latitude", "longitude" }
```

### Règles métier à tester

| Règle | Comportement attendu |
|-------|----------------------|
| Email inconnu / inactif | erreur |
| Pas de `face_descriptor` enrollé | erreur |
| Distance faciale > 0.5 | refus |
| GPS hors rayon 300 m (Hippodrome 3.8721, 11.5137) | refus |
| Avant 8h30 (`Africa/Douala`) | `present` |
| Après 8h30 | `late` |
| Après 12h00 | pointage fermé |
| Déjà pointé ce jour | refus (1 seul / jour) |
| Rate limit | max 10 tentatives / IP / heure |
| Succès | `{ success, employee_name, check_in_time, status }` |

### TDD

- [ ] Unit : Haversine (dans / hors 300 m)
- [ ] Unit : Euclidean face distance ≤ 0.5
- [ ] Unit : calcul `present` / `late` / fermeture 12h (timezone mockée)
- [ ] Integration : happy path check-in
- [ ] Integration : doublon jour → erreur
- [ ] Integration : hors zone GPS
- [ ] Integration : rate limit (10e → bloqué)

**Optionnel Phase 3 :** upload photo Cloudinary `livsight/hr/checkins` si photo fournie — sinon reporter.

**Deps à ajouter si besoin :** `express-rate-limit` (pas encore dans le repo).

---

## Phase 4 — Backend attendances (admin)

### Routes

| Méthode | Route | Query |
|---------|-------|-------|
| `GET` | `/api/v1/hr/attendances` | `employee_id`, `date`, `month`, `year` |
| `GET` | `/api/v1/hr/attendances/summary` | `month`, `year` |

### TDD

- [ ] Filtre mois / employé
- [ ] Summary agrège présents / retards / absents (règle absent : pas de pointage avant 12h — préciser calcul en test)
- [ ] `403` non super_admin
- [ ] Réponses sans `face_descriptor`

---

## Phase 5 — Dashboard admin RH

**Objectif :** UI shadcn alignée sur le client existant.  
**Pas de payslips.**

### Fichiers

- `client/src/pages/hr/EmployeesPage.tsx`
- `client/src/pages/hr/AttendancesPage.tsx`
- `client/src/services/hr.ts` (+ hooks React Query)
- Routes dans `App.tsx` : `/hr/employees`, `/hr/attendances`
- Section **RH** dans `Sidebar` (2 liens pour l’instant)

### EmployeesPage

- [ ] Table : nom, poste, email, salaire base, badge Enregistré / En attente
- [ ] Dialog Ajouter employé
- [ ] Bouton Enroller visage (caméra → descriptor → `POST …/enroll`)

### AttendancesPage

- [ ] Filtres mois + employé
- [ ] Table : employé, date, heure, statut (badges vert/orange/rouge), GPS, Face

### TDD frontend

- [ ] Vitest : rendu liste / badges / états vides (mocks API)
- [ ] Optionnel : Playwright smoke sur `/hr/employees` (login super_admin fixture)

---

## Phase 6 — hr-app (pointage employé) + E2E

**Objectif :** app Vite + React + Tailwind dans `/hr-app`, mobile-first, une page / 4 étapes.

**Statut :** ✅ livré (`npm run dev:hr-app`, E2E `npm run test:e2e`)

### Flow

1. **Email** → `GET /checkin/verify-email`
2. **Face** → MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) + descripteur landmarks 128-d + caméra
3. **GPS** → silencieux ; hors zone → message bureau
4. **Confirmation** → nom, heure, Présent / En retard

Design : fond blanc, bleu LivSight, centré, une action par étape.

### TDD / E2E Playwright

- [x] E2E : email invalide → message erreur
- [x] E2E : email OK → passage étape face (mock descriptor)
- [x] E2E : GPS hors zone → message « Vous devez être au bureau… »
- [x] E2E : happy path → écran confirmation (API mockée)

### Infra (quand on déploie)

- [ ] DNS `rh.livsight.com`
- [ ] Ajouter origin dans `ALLOWED_ORIGINS`
- [ ] Déploiement Vercel (projet séparé ou monorepo)

---

## Phase 7 — PLUS TARD (hors sprint actuel)

> Ne pas commencer tant que Phases 1–6 ne sont pas stables.

- Table `payslips`
- `POST /hr/payslips/generate` — formule :  
  `salary_net = salary_base - (days_absent × salary_base / 26)`
- `POST /hr/payslips/send` — PDF pdfkit + **service email à créer** (n’existe pas encore dans le repo)
- `GET /hr/payslips`
- `PayslipsPage` + lien Sidebar
- Contenu PDF H-Groupe SARL / NUI / Confidentiel
- Tests Jest génération + envoi (email mocké)

---

## Ordre de slices (commits suggérés)

1. Docs + Playwright smoke  
2. Migration employees/attendances + test schema  
3. CRUD employees API + tests  
4. Enroll face + tests (descriptor jamais exposé)  
5. Utils Haversine / face distance / horaires + unit tests  
6. Check-in + rate limit + tests  
7. Attendances list/summary + tests  
8. Admin EmployeesPage + Vitest  
9. Admin AttendancesPage + Vitest  
10. Scaffold hr-app  
11. Flow check-in UI + E2E Playwright  

Messages de commit (style repo) : `Add …`, `Fix …` — anglais, impératif.

---

## Checklist « prêt pour Phase 7 »

- [ ] Migration appliquée
- [ ] CRUD employés + enroll verts
- [ ] Check-in règles métier + rate limit verts
- [ ] Attendances admin OK
- [ ] Pages `/hr/employees` et `/hr/attendances` utilisables
- [ ] hr-app flow 4 étapes + E2E principaux verts
- [ ] Aucune réponse API ne contient `face_descriptor`
- [ ] Fiches de paie **volontairement** absentes

---

## Références repo

- TDD : `.cursor/rules/tdd-and-commits.mdc`
- Auth : `server/src/api/middleware/auth.js`
- PDF existant (réutiliser plus tard) : `server/src/api/routes/reports.js`
- Cloudinary : `server/src/config/cloudinary.js`
- Plan recrutement employés (différent) : `EMPLOYEES_FEATURE_PLAN.md`
- Migration employees actuelle : `server/db/migrations/20260719192657_create_employees_table.sql`

---

## Prochaine action

Confirmer les **décisions** (schéma employees, timezone, rôle), puis démarrer **Phase 0b → Phase 1** en TDD.
