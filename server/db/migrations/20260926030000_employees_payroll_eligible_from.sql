-- ============================================================================
-- employees.payroll_eligible_from — first calendar month included in payroll mass
-- ============================================================================
-- Toggle "inclure au mois suivant" at creation sets this to the 1st of next month.
-- Existing rows backfilled from creation month (Africa/Douala).
-- ============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payroll_eligible_from DATE;

UPDATE employees
SET payroll_eligible_from = (
  date_trunc('month', timezone('Africa/Douala', created_at))
)::date
WHERE payroll_eligible_from IS NULL;

ALTER TABLE employees
  ALTER COLUMN payroll_eligible_from SET NOT NULL;

ALTER TABLE employees
  ALTER COLUMN payroll_eligible_from SET DEFAULT (
    date_trunc('month', timezone('Africa/Douala', NOW()))
  )::date;
