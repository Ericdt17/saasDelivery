-- Super-admin broadcasts: all registered active groups; global rows may omit agency_id

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS chk_reminders_audience_mode;

ALTER TABLE reminders ADD CONSTRAINT chk_reminders_audience_mode
  CHECK (audience_mode IN ('contacts', 'groups', 'quick_numbers', 'all_groups'));

ALTER TABLE reminders ALTER COLUMN agency_id DROP NOT NULL;
