-- Create expeditions table (separate from deliveries)

CREATE TABLE IF NOT EXISTS expeditions (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  destination VARCHAR(255) NOT NULL,
  agence_de_voyage VARCHAR(255) NOT NULL,
  frais_de_course DECIMAL(10, 2) NOT NULL DEFAULT 0,
  frais_de_lagence_de_voyage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'en_attente',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expeditions_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  CONSTRAINT fk_expeditions_group
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CONSTRAINT chk_expeditions_frais_de_course_non_negative
    CHECK (frais_de_course >= 0),
  CONSTRAINT chk_expeditions_frais_de_lagence_non_negative
    CHECK (frais_de_lagence_de_voyage >= 0)
);

CREATE INDEX IF NOT EXISTS idx_expeditions_agency_created_at
  ON expeditions(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expeditions_group_created_at
  ON expeditions(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expeditions_agency_status
  ON expeditions(agency_id, status);
