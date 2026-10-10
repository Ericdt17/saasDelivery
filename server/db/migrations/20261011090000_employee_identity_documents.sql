-- ============================================================================
-- Documents d'identité employé (images) — CNI recto/verso + plan de
-- localisation du domicile. Stockage pur (base64, comme les signatures) :
-- AUCUN impact sur la génération des contrats ni sur les champs requis.
-- ============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cni_front_base64 TEXT,
  ADD COLUMN IF NOT EXISTS cni_back_base64 TEXT,
  ADD COLUMN IF NOT EXISTS home_location_base64 TEXT;
