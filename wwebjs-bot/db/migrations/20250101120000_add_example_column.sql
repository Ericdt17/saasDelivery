-- Example Migration: Add a test column
-- This demonstrates how to add a new column to an existing table
-- 
-- NOTE: This is an EXAMPLE migration file
-- In production, you would:
-- 1. Check if column exists before adding (PostgreSQL)
-- 2. Handle errors gracefully (SQLite)
-- 3. Or use database-specific migration files
--
-- For idempotent column addition in PostgreSQL:
-- DO $$ 
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM information_schema.columns 
--     WHERE table_name = 'deliveries' AND column_name = 'example_field'
--   ) THEN
--     ALTER TABLE deliveries ADD COLUMN example_field TEXT;
--   END IF;
-- END $$;
--
-- For SQLite, ALTER TABLE ADD COLUMN will fail if column exists
-- Handle this in application code or use a wrapper

-- Simple version (will fail if column exists - handle in migration runner)
ALTER TABLE deliveries ADD COLUMN example_field TEXT;

