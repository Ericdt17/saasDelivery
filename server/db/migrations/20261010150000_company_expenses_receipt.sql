-- ============================================================================
-- Justificatif de dépense (image) — stocké en base64 comme les signatures
-- ============================================================================

ALTER TABLE company_expenses
  ADD COLUMN IF NOT EXISTS receipt_base64 TEXT;
