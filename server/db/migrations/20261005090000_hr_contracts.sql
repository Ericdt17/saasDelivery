-- ============================================================================
-- HR employee contracts — generation + e-signature lifecycle
-- ============================================================================
-- Modeled on backend_core merchant contracts:
--   generated (frozen snapshot + resolved HTML + PDF + sha256)
--   → ready_for_signature (single-use 64-hex token, 30-day expiry)
--   → signed (employee signature + attestation page appended)
--   | declined | expired | cancelled.
-- The template itself is file-based (server/src/templates/contract.html),
-- like payslip.html; template_key freezes which version a contract used.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_contracts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'generated'
    CHECK (status IN (
      'generated', 'ready_for_signature',
      'signed', 'declined', 'expired', 'cancelled'
    )),
  template_key VARCHAR(80) NOT NULL,
  contract_date DATE NOT NULL,
  -- Employee + company data frozen at generation (immutable afterwards)
  snapshot JSONB NOT NULL,
  -- Resolved HTML (signature slot empty) + rendered PDF, frozen at generation
  document_html TEXT NOT NULL,
  document_pdf BYTEA NOT NULL,
  document_file_name VARCHAR(255) NOT NULL,
  document_sha256 VARCHAR(64) NOT NULL,
  ready_for_signature_at TIMESTAMPTZ,
  signature_token VARCHAR(64),
  signature_token_expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_consent VARCHAR(255),
  signature_ip VARCHAR(64),
  signature_user_agent VARCHAR(255),
  signature_image_base64 TEXT,
  signed_pdf BYTEA,
  signed_document_sha256 VARCHAR(64),
  declined_at TIMESTAMPTZ,
  decline_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_contracts_signature_token_unique UNIQUE (signature_token)
);

CREATE INDEX IF NOT EXISTS idx_hr_contracts_employee_created
  ON hr_contracts (employee_id, created_at DESC);
