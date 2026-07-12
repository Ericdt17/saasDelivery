-- Migration: Create tariffs table
-- This table stores delivery tariffs (pricing) for each quartier (neighborhood) per agency
-- Each agency can set their own tariff amounts for different neighborhoods
--
-- Note: This migration uses IF NOT EXISTS to avoid errors if the table already exists
-- This is safe to run on existing databases that may have the table created manually

-- Create tariffs table
CREATE TABLE IF NOT EXISTS tariffs (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  quartier VARCHAR(255) NOT NULL,
  tarif_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Create unique index to ensure one tariff per agency-quartier combination
-- This prevents duplicate tariffs for the same quartier within an agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_tariffs_agency_quartier ON tariffs(agency_id, quartier);

-- Create index for faster lookups by agency_id
CREATE INDEX IF NOT EXISTS idx_tariffs_agency_id ON tariffs(agency_id);

-- Create index for faster lookups by quartier (for searches across agencies)
CREATE INDEX IF NOT EXISTS idx_tariffs_quartier ON tariffs(quartier);











