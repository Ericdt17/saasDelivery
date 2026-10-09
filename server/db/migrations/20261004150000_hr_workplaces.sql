-- ============================================================================
-- HR workplaces (lieux de travail) — admin CRUD setting
-- ============================================================================
-- employees.place_of_work free text is replaced by workplace_id FK.
-- ============================================================================

CREATE TABLE IF NOT EXISTS hr_workplaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_workplaces_name_unique UNIQUE (name)
);

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS workplace_id INTEGER
    REFERENCES hr_workplaces(id) ON DELETE SET NULL;

-- Best-effort: promote any existing free-text place_of_work into workplaces.
INSERT INTO hr_workplaces (name)
SELECT DISTINCT TRIM(place_of_work)
FROM employees
WHERE place_of_work IS NOT NULL
  AND TRIM(place_of_work) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE employees e
SET workplace_id = w.id
FROM hr_workplaces w
WHERE e.place_of_work IS NOT NULL
  AND TRIM(e.place_of_work) = w.name
  AND e.workplace_id IS NULL;

ALTER TABLE employees
  DROP COLUMN IF EXISTS place_of_work;

CREATE INDEX IF NOT EXISTS idx_employees_workplace_id
  ON employees (workplace_id);

CREATE INDEX IF NOT EXISTS idx_hr_workplaces_active
  ON hr_workplaces (is_active);
