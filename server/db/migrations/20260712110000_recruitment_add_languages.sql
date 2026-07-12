-- Recruitment: spoken languages on applications (comma-separated: francais, anglais)

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS languages TEXT;
