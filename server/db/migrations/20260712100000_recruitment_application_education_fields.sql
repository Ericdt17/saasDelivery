-- Recruitment: profile / education fields on applications

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS field_of_study VARCHAR(255),
  ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);

ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_education_level_check;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_education_level_check
  CHECK (
    education_level IS NULL
    OR education_level IN ('bac', 'licence', 'master', 'doctorat')
  );

CREATE INDEX IF NOT EXISTS idx_job_applications_education_level
  ON job_applications (education_level);
