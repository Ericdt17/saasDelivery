-- Migration: Add tariff_pending flag to deliveries
-- Purpose: surface "Tarif non applique" for pending deliveries missing tariff
-- Rule: pending + quartier present + missing/zero delivery_fee => tariff_pending = true

ALTER TABLE deliveries
ADD COLUMN tariff_pending BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE deliveries
SET tariff_pending = CASE
  WHEN status = 'pending'
    AND quartier IS NOT NULL
    AND TRIM(quartier) <> ''
    AND (delivery_fee IS NULL OR delivery_fee <= 0)
  THEN TRUE
  ELSE FALSE
END;
