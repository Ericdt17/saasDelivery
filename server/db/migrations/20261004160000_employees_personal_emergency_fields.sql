-- ============================================================================
-- employees — personal email, birth place, emergency contact
-- ============================================================================
-- gender already exists (VARCHAR); HR UI will write homme|femme.
-- personal_email is optional and distinct from check-in email.
-- ============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(160),
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(80);
