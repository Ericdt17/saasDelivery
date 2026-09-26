-- Company stamp (cachet) image for payslip PDFs.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS stamp_base64 TEXT;
