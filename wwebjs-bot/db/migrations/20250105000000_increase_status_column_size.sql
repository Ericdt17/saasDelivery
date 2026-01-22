-- Migration: Increase status column size to accommodate long status values
-- Date: 2025-01-05
-- Issue: Status values like "present_ne_decroche_zone1" (25 chars) exceed VARCHAR(20) limit
-- Fix: Increase status column from VARCHAR(20) to VARCHAR(50)
--
-- Affected statuses:
-- - present_ne_decroche_zone1 (25 characters)
-- - present_ne_decroche_zone2 (25 characters)
--
-- PostgreSQL: ALTER COLUMN TYPE is supported and will execute successfully
-- SQLite: SQLite doesn't support ALTER COLUMN TYPE, so this will fail with a syntax error.
--         However, SQLite uses TEXT type which has no length limit, so this migration
--         is not needed for SQLite. The migration system will catch this error and
--         mark the migration as applied (since SQLite doesn't need this fix).

-- For PostgreSQL: Increase column size from VARCHAR(20) to VARCHAR(50)
-- For SQLite: This will fail but that's OK - SQLite uses TEXT with no length limit
ALTER TABLE deliveries ALTER COLUMN status TYPE VARCHAR(50);
