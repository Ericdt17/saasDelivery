-- Recruitment: current employment yes/no fields on applications

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS currently_employed VARCHAR(3),
  ADD COLUMN IF NOT EXISTS in_other_company VARCHAR(3);

ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_currently_employed_check;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_currently_employed_check
  CHECK (currently_employed IS NULL OR currently_employed IN ('oui', 'non'));

ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_in_other_company_check;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_in_other_company_check
  CHECK (in_other_company IS NULL OR in_other_company IN ('oui', 'non'));
