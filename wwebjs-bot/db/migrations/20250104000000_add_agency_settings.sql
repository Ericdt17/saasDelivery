-- Migration: Add agency settings columns (address, phone, logo_base64)
-- This allows agencies to store their contact information and logo for PDF reports
--
-- Note: Uses ALTER TABLE with IF NOT EXISTS equivalent logic
-- For SQLite: Will fail if columns exist, but migration runner handles it
-- For PostgreSQL: Using IF NOT EXISTS syntax where available

-- Add address column
ALTER TABLE agencies ADD COLUMN address TEXT;

-- Add phone column  
ALTER TABLE agencies ADD COLUMN phone VARCHAR(50);

-- Add logo_base64 column (stores base64 encoded image)
ALTER TABLE agencies ADD COLUMN logo_base64 TEXT;

