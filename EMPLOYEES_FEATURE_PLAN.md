# Plan — Gestion des employés recrutés

> **Branche :** `feat/empoyee` (à renommer éventuellement en `feat/employees`)  
> **Accès :** `super_admin` uniquement  
> **Statut :** à développer par toi (pas d’implémentation complète par l’IA)

---

## Pourquoi je veux coder ça moi-même

Je commence bientôt mon **alternance**. Je veux utiliser cette feature comme exercice réel de développement, pas comme un livrable généré à ma place.

Objectifs d’apprentissage :

- appliquer le **TDD** (Red → Green → Refactor) comme dans `.cursor/rules/tdd-and-commits.mdc`
- comprendre le flux **migration → DB queries → API → tests → frontend**
- m’entraîner aux conventions Git (commits impératifs, push sur demande)
- savoir demander de l’aide (debug, review) sans déléguer tout le code

**Rôle de l’IA / mentor :** guider, revoir, débloquer — pas remplacer mon implémentation.

---

## Contexte produit (état actuel)

Aujourd’hui le module recrutement couvre :

| Élément | État |
|---------|------|
| Offres + questions | ✅ |
| Candidatures (formulaire public) | ✅ |
| Évaluation admin (`status`, `funnel_step`) | ✅ |
| `status = accepted` | ✅ flag seulement |
| Table / API / page **Employés** | ❌ absent |

Une candidature acceptée reste dans `job_applications`. Il n’existe pas encore de roster RH.

---

## Objectif MVP

1. **Embaucher** une candidature `accepted` → créer un enregistrement `employees`
2. **Lister / voir / mettre à jour** (notes, statut `active` / `inactive`)
3. UI admin : bouton « Embaucher » + page « Employés »
4. Tout réservé au **`super_admin`**

Hors scope MVP (plus tard) : salaires, contrats, planning, création d’employé sans candidature.

---

## Workflow TDD (obligatoire)

Pour **chaque** endpoint / comportement :

1. **Red** — écrire un test qui échoue
2. **Green** — implémenter le minimum pour le faire passer
3. **Refactor** — nettoyer sans casser les tests
4. Lancer les tests concernés avant de considérer la slice terminée
5. Commit uniquement quand tu le décides (message impératif anglais)

Ne commence **pas** par le frontend.

---

## Étape 0 — Branche

Tu es déjà sur `feat/empoyee`. Optionnel :

```bash
git branch -m feat/employees
```

---

## Étape 1 — Modèle de données

Créer une migration dans `server/db/migrations/`, ex. :

`YYYYMMDDHHMMSS_create_employees_table.sql`

### Colonnes MVP suggérées

| Colonne | Rôle |
|---------|------|
| `id` | PK |
| `application_id` | UNIQUE, FK → `job_applications` (nullable si création manuelle plus tard) |
| `job_offer_id` | FK optionnelle |
| `full_name`, `phone`, `email` | identité |
| `photo_url` | optionnel (copié depuis la candidature) |
| `job_title` / `job_type` | snapshot au moment de l’embauche |
| `status` | `active` / `inactive` |
| `hired_at`, `notes` | |
| `created_at`, `updated_at` | |

Puis :

```bash
cd server && npm run migrate
```

---

## Étape 2 — Couche DB (queries)

Fichiers modèles à lire :

- `server/src/db/postgres-queries.js` (fonctions `recruitment*`)
- `server/src/db/index.js` (exports)

Fonctions à ajouter (noms libres) :

- `createEmployee` / `createEmployeeFromApplication`
- `listEmployees`
- `getEmployeeById`
- `updateEmployee`
- éventuellement `findEmployeeByApplicationId`

---

## Étape 3 — API (`super_admin`)

Middleware : `requireSuperAdmin` (comme pour `DELETE` candidature).

| Méthode | Route (proposition) | Comportement |
|---------|---------------------|--------------|
| `POST` | `/api/v1/recruitment/admin/applications/:id/hire` | candidature `accepted` → crée employé |
| `GET` | `/api/v1/recruitment/admin/employees` | liste |
| `GET` | `/api/v1/recruitment/admin/employees/:id` | détail |
| `PATCH` | `/api/v1/recruitment/admin/employees/:id` | notes / status |

### Cas d’erreur à couvrir en tests

| Cas | Status HTTP |
|-----|-------------|
| Rôle `agency` | `403` |
| Candidature introuvable | `404` |
| Status ≠ `accepted` | `400` |
| Déjà embauché (`application_id` unique) | `409` |
| Hire OK | `201` |

Fichiers à étendre :

- `server/src/api/routes/recruitment.js`
- `server/src/api/controllers/recruitment.controller.js`  
  (ou un nouveau controller `employees` si tu préfères séparer)

---

## Étape 4 — Tests d’abord

Fichier modèle : `server/src/__tests__/integration/recruitment.test.js`  
(ou un nouveau `employees.test.js`)

**Premier test :**

```text
POST .../applications/:id/hire as super_admin
→ 201 + employee créé
```

Ensuite : `403`, `400`, `409`, `404`.

```bash
cd server && npm test -- src/__tests__/integration/recruitment.test.js
# ou le fichier que tu auras créé
```

---

## Étape 5 — Frontend (après API verte)

1. `client/src/services/recruitment.ts` — `hireApplication`, `getEmployees`, etc.
2. Hooks React Query (`useRecruitment.ts` ou hooks dédiés)
3. Bouton **Embaucher** sur `ApplicationsPage` si `status === "accepted"` et `isSuperAdmin`
4. Page `/recruitment/employees` + entrée Sidebar « Employés »
5. Routes dans `client/src/App.tsx`

---

## Ordre de slices (petits commits)

1. Migration `employees` + migrate OK  
2. Query `create` / `getByApplication` + tests DB ou integration  
3. Endpoint `hire` (super_admin) + tests HTTP  
4. `GET` liste / détail + tests  
5. `PATCH` status/notes + tests  
6. Service + hooks frontend  
7. UI Embaucher + page Employés  

Exemple de message de commit :

```text
Add employees table and hire endpoint for accepted applications.
```

---

## Comment demander de l’aide

- **Bloqué sur un test / une erreur** → Ask mode + coller le test et le message d’erreur  
- **Review de ton code** → coller un diff ou passer en Agent mode « review only »  
- **Ne pas** demander « implémente toute la feature » si l’objectif est d’apprendre

---

## Checklist de fin de MVP

- [ ] Migration appliquée (local)
- [ ] `POST …/hire` fonctionne pour `super_admin`
- [ ] `agency` reçoit `403`
- [ ] Impossible d’embaucher deux fois la même candidature
- [ ] Liste + détail employés
- [ ] Désactivation (`inactive`)
- [ ] UI Embaucher + page Employés
- [ ] Tests concernés verts
- [ ] PR / merge vers `main` quand prêt

---

## Références utiles dans le repo

- Règle TDD + commits : `.cursor/rules/tdd-and-commits.mdc`
- Recrutement API : `server/src/api/routes/recruitment.js`
- Controller : `server/src/api/controllers/recruitment.controller.js`
- Tests integration : `server/src/__tests__/integration/recruitment.test.js`
- UI candidatures : `client/src/pages/recruitment/ApplicationsPage.tsx`
- Schema candidatures : `server/db/migrations/20260418140000_create_recruitment_tables.sql`
