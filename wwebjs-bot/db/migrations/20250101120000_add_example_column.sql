-- Example Migration: Add a test column
-- This demonstrates how to add a new column to an existing table
-- 
-- Note: This migration will fail if the column already exists
-- To make it idempotent, check if column exists before adding
-- or handle the error in your application code

ALTER TABLE deliveries ADD COLUMN example_field TEXT;

