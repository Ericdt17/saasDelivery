-- Migration: Add delivery_fee column to deliveries table
-- This column stores the tariff amount applied when a delivery is marked as delivered
-- The tariff is subtracted from the amount_paid (montant encaissé)
--
-- Format: DECIMAL(10, 2) - allows up to 99,999,999.99 with 2 decimal places
-- Default: 0 - means no tariff has been applied yet
--
-- Note: This will fail if column already exists (SQLite)
-- Migration runner will catch "duplicate column" errors and mark as applied

ALTER TABLE deliveries ADD COLUMN delivery_fee DECIMAL(10, 2) DEFAULT 0;

