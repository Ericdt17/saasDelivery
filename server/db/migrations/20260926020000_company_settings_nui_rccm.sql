-- Legal identifiers for PDF footers (NUI / RCCM), aligned with backend_core.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS trade_register VARCHAR(80);
