-- Recruitment: optional profile photo (image) on applications

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_original_name VARCHAR(255);
