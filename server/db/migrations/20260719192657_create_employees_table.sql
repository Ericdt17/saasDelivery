-- ============================================================================
-- Employees : roster RH (création manuelle + embauche depuis candidature)
-- ============================================================================
-- application_id nullable : création HR sans candidature.
-- Champs RH pointage : poste, salary_base, face_descriptor, is_active, enrolled_at.
-- Colonnes recrutement conservées pour un hire futur (snapshot candidature).
-- Accès API : super_admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,

  -- Liens recrutement (optionnels pour création manuelle HR)
  application_id BIGINT UNIQUE
    REFERENCES job_applications(id) ON DELETE RESTRICT,
  job_offer_id BIGINT
    REFERENCES job_offers(id) ON DELETE SET NULL,

  -- Identité
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  email VARCHAR(255) NOT NULL,
  photo_url TEXT,
  gender VARCHAR(50),
  quartier VARCHAR(255),

  -- Snapshot recrutement (job_offers) — distinct de poste RH
  job_title VARCHAR(255),
  job_type VARCHAR(50),

  -- Formation / mobilité (snapshot candidature)
  education_level VARCHAR(50),
  field_of_study VARCHAR(255),
  school_name VARCHAR(255),
  transport VARCHAR(50),
  availability VARCHAR(50),

  -- Gestion RH (lifecycle recrutement)
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated')),
  hired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  salary DECIMAL(10, 2),

  -- Module pointage / paie
  poste VARCHAR(100),
  salary_base INTEGER,
  face_descriptor JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT employees_email_unique UNIQUE (email),
  CONSTRAINT employees_education_level_check CHECK (
    education_level IS NULL
    OR education_level IN ('bac', 'licence', 'master', 'doctorat')
  ),
  CONSTRAINT employees_transport_check CHECK (
    transport IS NULL
    OR transport IN ('scooter', 'velo', 'voiture', 'apied')
  ),
  CONSTRAINT employees_availability_check CHECK (
    availability IS NULL
    OR availability IN ('plein', 'partiel', 'weekend')
  )
);

CREATE INDEX IF NOT EXISTS idx_employees_status
  ON employees (status);

CREATE INDEX IF NOT EXISTS idx_employees_job_offer_id
  ON employees (job_offer_id);

CREATE INDEX IF NOT EXISTS idx_employees_hired_at
  ON employees (hired_at);

CREATE INDEX IF NOT EXISTS idx_employees_is_active
  ON employees (is_active);

CREATE INDEX IF NOT EXISTS idx_employees_email
  ON employees (email);
