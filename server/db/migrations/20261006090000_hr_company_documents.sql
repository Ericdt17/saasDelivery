-- ============================================================================
-- Company documents (règlement intérieur) — versioned, acknowledged by staff
-- ============================================================================
-- One company-wide document per doc_type (internal_regulation now; procedure
-- and policy reuse the same tables later). Versions are immutable once
-- published; "not read" is DERIVED from the absence of an acknowledgement for
-- the current published version (no unread rows are materialised).
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_company_documents (
  id SERIAL PRIMARY KEY,
  doc_type VARCHAR(40) NOT NULL DEFAULT 'internal_regulation'
    CHECK (doc_type IN ('internal_regulation', 'procedure', 'policy')),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  -- FK added below (circular reference with versions)
  current_version_id INTEGER,
  created_by INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_company_documents_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS hr_company_document_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL
    REFERENCES hr_company_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  -- Markdown source; rendered to sanitised HTML at read time
  content_md TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_by INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
  published_by INTEGER REFERENCES agencies(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_company_document_versions_number_unique
    UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_hr_company_document_versions_doc_status
  ON hr_company_document_versions (document_id, status);

ALTER TABLE hr_company_documents
  ADD CONSTRAINT hr_company_documents_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES hr_company_document_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS hr_company_document_acknowledgements (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL
    REFERENCES hr_company_document_versions(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL
    REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  -- An employee acknowledges one exact version at most once (idempotency)
  CONSTRAINT hr_company_document_acks_unique UNIQUE (version_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_company_document_acks_employee
  ON hr_company_document_acknowledgements (employee_id);
