-- Company signature image for payslip PDFs (data URL / base64).
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS signature_base64 TEXT;
