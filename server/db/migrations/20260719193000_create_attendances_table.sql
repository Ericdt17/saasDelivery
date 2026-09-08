-- ============================================================================
-- Attendances : pointages journaliers employés
-- ============================================================================
-- UNIQUE (employee_id, date) = un seul pointage par jour.
-- status : present | late | absent
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendances (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL
    REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL
    CHECK (status IN ('present', 'late', 'absent')),
  face_verified BOOLEAN NOT NULL DEFAULT false,
  gps_verified BOOLEAN NOT NULL DEFAULT false,
  latitude DECIMAL,
  longitude DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendances_employee_date_unique UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendances_employee_id
  ON attendances (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendances_date
  ON attendances (date);

CREATE INDEX IF NOT EXISTS idx_attendances_status
  ON attendances (status);
