-- Job offer type: free-text label set by admin (no fixed CHECK list)

ALTER TABLE job_offers DROP CONSTRAINT IF EXISTS job_offers_type_check;
