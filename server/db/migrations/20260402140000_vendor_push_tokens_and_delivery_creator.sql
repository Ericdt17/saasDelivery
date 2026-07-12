-- Vendor Expo push tokens + optional creator on deliveries

CREATE TABLE IF NOT EXISTS vendor_push_tokens (
  id SERIAL PRIMARY KEY,
  vendor_user_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_vendor_push_tokens_vendor_user_id ON vendor_push_tokens(vendor_user_id);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_created_by_user_id ON deliveries(created_by_user_id);
