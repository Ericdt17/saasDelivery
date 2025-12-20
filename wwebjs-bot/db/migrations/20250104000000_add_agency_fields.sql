-- Migration: Add address, phone, and logo_base64 columns to agencies table
-- These columns allow agencies to store additional contact information and logo
--
-- PostgreSQL: Uses IF NOT EXISTS (supported in PostgreSQL 9.5+)
-- SQLite: Will fail if column exists, but migration runner handles gracefully

-- Add address column (nullable TEXT)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS address TEXT;

-- Add phone column (nullable VARCHAR(20))
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Add logo_base64 column (nullable TEXT - stores base64 encoded image)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

