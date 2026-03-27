-- Migration: Create reminder contacts and scheduled reminders tables
-- Adds:
-- - agency_reminder_contacts: phonebook entries per agency (multi-tenant)
-- - reminders: scheduled WhatsApp reminder messages to those contacts

-- Contacts used as reminder recipients (many per agency)
CREATE TABLE IF NOT EXISTS agency_reminder_contacts (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  label VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_agency_reminder_contacts_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Avoid duplicate active contacts per agency (best-effort; keeps old duplicates possible if is_active toggled)
CREATE UNIQUE INDEX IF NOT EXISTS uq_agency_reminder_contacts_agency_phone
  ON agency_reminder_contacts(agency_id, phone);

CREATE INDEX IF NOT EXISTS idx_agency_reminder_contacts_agency_active
  ON agency_reminder_contacts(agency_id, is_active);

-- Scheduled reminders
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  send_at TIMESTAMP NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP,
  last_error TEXT,
  created_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminders_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_contact
    FOREIGN KEY (contact_id) REFERENCES agency_reminder_contacts(id) ON DELETE CASCADE,
  CONSTRAINT chk_reminders_status
    CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed'))
);

-- Polling index for worker
CREATE INDEX IF NOT EXISTS idx_reminders_status_send_at
  ON reminders(status, send_at);

CREATE INDEX IF NOT EXISTS idx_reminders_agency_send_at
  ON reminders(agency_id, send_at DESC);

