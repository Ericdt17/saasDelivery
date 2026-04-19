-- Recruitment: add optional cover letter (PDF) to applications

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS cover_letter_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_original_name VARCHAR(255);

