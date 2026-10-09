-- ============================================================================
-- employees — identity / legal + contract terms for future HR contracts
-- ============================================================================
-- Additive only. Existing rows keep NULL on new columns until filled in the UI.
-- employee_type drives which contract template family will be used later
-- (livreur → employee_contract_livreur, agent → employee_contract_agent).
-- ============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(80),
  ADD COLUMN IF NOT EXISTS national_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS place_of_work VARCHAR(160),
  ADD COLUMN IF NOT EXISTS contract_kind VARCHAR(16),
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS trial_period_days INTEGER,
  ADD COLUMN IF NOT EXISTS mission_description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_employee_type_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_employee_type_check
      CHECK (
        employee_type IS NULL
        OR employee_type IN ('livreur', 'agent')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_contract_kind_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_contract_kind_check
      CHECK (
        contract_kind IS NULL
        OR contract_kind IN ('cdi', 'cdd')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_trial_period_days_check'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_trial_period_days_check
      CHECK (
        trial_period_days IS NULL
        OR trial_period_days >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_employee_type
  ON employees (employee_type);
