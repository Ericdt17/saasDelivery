-- ============================================================================
-- Dépenses générales de l'entreprise (hors API livraisons, hors salaires)
-- ============================================================================
-- Saisies manuellement dans le dashboard (source = 'manual'); 'system' est
-- réservé à d'éventuelles dépenses automatiques futures. effective_month
-- (1er du mois) porte l'imputation comptable — la dépense est déduite du
-- chiffre d'affaires de CE mois-là, indépendamment de expense_date.
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_expenses (
  id SERIAL PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  category VARCHAR(40) NOT NULL
    CHECK (category IN (
      'loyer', 'energie_eau', 'internet_telephone', 'transport',
      'materiel_equipement', 'marketing', 'administratif_legal',
      'maintenance', 'autre'
    )),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  -- Mois d'imputation (toujours le 1er du mois)
  effective_month DATE NOT NULL,
  notes TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'system')),
  created_by INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_expenses_effective_month
  ON company_expenses (effective_month);
