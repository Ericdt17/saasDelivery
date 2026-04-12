-- Public landing waitlist signups (email + phone, no auth)

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_waitlist_email UNIQUE (email),
  CONSTRAINT uq_waitlist_phone UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_created_at ON waitlist_entries (created_at DESC);
