-- Update Local SQLite Database Schema to Match Production
-- Run this in DBeaver connected to your SQLite database (data/bot.db)

-- ============================================
-- 1. Create agencies table
-- ============================================
CREATE TABLE IF NOT EXISTS agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agency',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email);

-- ============================================
-- 2. Create groups table
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  whatsapp_group_id TEXT UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id);
CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id);

-- ============================================
-- 3. Add missing columns to deliveries table
-- ============================================

-- Add whatsapp_message_id column
ALTER TABLE deliveries ADD COLUMN whatsapp_message_id TEXT;

-- Add agency_id column
ALTER TABLE deliveries ADD COLUMN agency_id INTEGER;

-- Add group_id column
ALTER TABLE deliveries ADD COLUMN group_id INTEGER;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id ON deliveries(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id);

-- ============================================
-- 4. Add missing column to delivery_history table
-- ============================================

-- Add agency_id column to delivery_history
ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER;

-- Create index
CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id);

-- ============================================
-- 5. Verify the changes
-- ============================================

-- Check all tables exist
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Check deliveries table columns
SELECT name, type FROM pragma_table_info('deliveries') ORDER BY cid;

-- Check if agencies table exists
SELECT COUNT(*) as agencies_count FROM agencies;

-- Check if groups table exists
SELECT COUNT(*) as groups_count FROM groups;


