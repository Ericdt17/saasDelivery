-- ============================================================================
-- Catégories de dépenses dynamiques + justificatifs multiples
-- ============================================================================
-- 1) Les catégories deviennent une table gérée dans Paramètres ; les 9
--    catégories historiques sont seedées (« Autre » exige une note via
--    requires_note). company_expenses.category (texte + CHECK) est migré
--    vers category_id puis supprimé.
-- 2) Une dépense peut avoir plusieurs justificatifs : table dédiée, les
--    receipt_base64 existants y sont déplacés puis la colonne est supprimée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  -- Une note est exigée à la saisie pour cette catégorie (ex. « Autre »)
  requires_note BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_expense_categories_name_unique UNIQUE (name)
);

-- Seed des catégories historiques
INSERT INTO company_expense_categories (name, requires_note) VALUES
  ('Loyer', false),
  ('Énergie / Eau', false),
  ('Internet & téléphone', false),
  ('Transport', false),
  ('Matériel & équipement', false),
  ('Marketing', false),
  ('Administratif & légal', false),
  ('Maintenance', false),
  ('Autre', true)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE company_expenses
  ADD COLUMN IF NOT EXISTS category_id INTEGER
    REFERENCES company_expense_categories(id);

-- Backfill des dépenses existantes (clé technique → catégorie seedée)
UPDATE company_expenses e
SET category_id = c.id
FROM company_expense_categories c
WHERE e.category_id IS NULL
  AND c.name = CASE e.category
    WHEN 'loyer' THEN 'Loyer'
    WHEN 'energie_eau' THEN 'Énergie / Eau'
    WHEN 'internet_telephone' THEN 'Internet & téléphone'
    WHEN 'transport' THEN 'Transport'
    WHEN 'materiel_equipement' THEN 'Matériel & équipement'
    WHEN 'marketing' THEN 'Marketing'
    WHEN 'administratif_legal' THEN 'Administratif & légal'
    WHEN 'maintenance' THEN 'Maintenance'
    ELSE 'Autre'
  END;

ALTER TABLE company_expenses
  ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE company_expenses
  DROP COLUMN IF EXISTS category;

CREATE INDEX IF NOT EXISTS idx_company_expenses_category_id
  ON company_expenses (category_id);

-- ---------------------------------------------------------------------------
-- Justificatifs multiples
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_expense_receipts (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL
    REFERENCES company_expenses(id) ON DELETE CASCADE,
  image_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_expense_receipts_expense
  ON company_expense_receipts (expense_id);

-- Migration des justificatifs existants (colonne unique → table)
INSERT INTO company_expense_receipts (expense_id, image_base64, created_at)
SELECT id, receipt_base64, created_at
FROM company_expenses
WHERE receipt_base64 IS NOT NULL;

ALTER TABLE company_expenses
  DROP COLUMN IF EXISTS receipt_base64;
