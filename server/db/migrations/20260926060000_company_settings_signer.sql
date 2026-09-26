-- Authorized signatory (name + role) for payslips / future signed docs.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS signer_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS signer_role VARCHAR(120);
