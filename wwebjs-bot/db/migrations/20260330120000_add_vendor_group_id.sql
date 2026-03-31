-- Add vendor support: vendors belong to one agency (parent) and one group (their slot)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS parent_agency_id INTEGER;

-- ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL syntax; use DO blocks instead
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agencies_group_id'
  ) THEN
    ALTER TABLE agencies ADD CONSTRAINT fk_agencies_group_id
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_agencies_parent_agency_id'
  ) THEN
    ALTER TABLE agencies ADD CONSTRAINT fk_agencies_parent_agency_id
      FOREIGN KEY (parent_agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agencies_group_id ON agencies(group_id);
CREATE INDEX IF NOT EXISTS idx_agencies_parent_agency_id ON agencies(parent_agency_id);
