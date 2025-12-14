-- Migration: Add agency_code column to agencies table
-- This allows agencies to have unique codes for group verification
-- 
-- Format: Alphanumeric, 4-20 characters, case-insensitive
-- Used to verify and link WhatsApp groups to agencies

-- Add agency_code column
-- Note: This will fail if column already exists (SQLite)
-- Migration runner will catch "duplicate column" errors and mark as applied
ALTER TABLE agencies ADD COLUMN agency_code VARCHAR(20);

-- Add unique index for agency_code
-- This ensures codes are unique across all agencies
-- Migration runner will handle "index already exists" errors gracefully
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_code ON agencies(agency_code);

