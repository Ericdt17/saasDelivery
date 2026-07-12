-- Migration: Upgrade reminders to campaign workflow

ALTER TABLE reminders
  DROP CONSTRAINT IF EXISTS fk_reminders_contact;

ALTER TABLE reminders
  ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS audience_mode VARCHAR(32) NOT NULL DEFAULT 'contacts',
  ADD COLUMN IF NOT EXISTS send_interval_min_sec INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS send_interval_max_sec INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS window_start VARCHAR(5),
  ADD COLUMN IF NOT EXISTS window_end VARCHAR(5),
  ADD COLUMN IF NOT EXISTS total_targets INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reminders
  DROP CONSTRAINT IF EXISTS chk_reminders_status;

ALTER TABLE reminders
  ADD CONSTRAINT chk_reminders_status
  CHECK (status IN ('scheduled', 'running', 'completed', 'cancelled', 'failed'));

ALTER TABLE reminders
  ADD CONSTRAINT chk_reminders_audience_mode
  CHECK (audience_mode IN ('contacts', 'groups', 'quick_numbers'));

ALTER TABLE reminders
  ADD CONSTRAINT chk_reminders_interval_positive
  CHECK (send_interval_min_sec > 0 AND send_interval_max_sec > 0 AND send_interval_min_sec <= send_interval_max_sec);

CREATE TABLE IF NOT EXISTS reminder_targets (
  id SERIAL PRIMARY KEY,
  reminder_id INTEGER NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_value VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_targets_reminder
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE,
  CONSTRAINT chk_reminder_targets_type
    CHECK (target_type IN ('contact', 'group', 'quick_number')),
  CONSTRAINT chk_reminder_targets_status
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_targets_unique
  ON reminder_targets(reminder_id, target_type, target_value);

CREATE INDEX IF NOT EXISTS idx_reminder_targets_poll
  ON reminder_targets(status, reminder_id, id);

CREATE INDEX IF NOT EXISTS idx_reminders_campaign_poll
  ON reminders(status, send_at, id);
