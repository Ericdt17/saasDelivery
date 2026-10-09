-- ============================================================================
-- employees — work schedule (free text, per employee)
-- ============================================================================
-- Example: "8h00–17h00, pause 1h"
-- ============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_schedule VARCHAR(160);
