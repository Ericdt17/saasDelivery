-- ============================================================================
-- employee_salary_history — effective-dated base salary (rise / drop)
-- ============================================================================
-- Changes default to the 1st of next Douala month; optional same-month correction.
-- employees.salary_base remains the denormalized amount for the current month.
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_salary_history (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount INTEGER,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_salary_history_employee_from_unique
    UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_salary_history_employee_from
  ON employee_salary_history (employee_id, effective_from DESC);

-- Snapshot known current amounts from the start of the current Douala month.
-- Past months without rows fall back to employees.salary_base (same as before history).
INSERT INTO employee_salary_history (employee_id, amount, effective_from)
SELECT
  id,
  salary_base,
  (date_trunc('month', timezone('Africa/Douala', NOW())))::date
FROM employees
ON CONFLICT (employee_id, effective_from) DO NOTHING;
