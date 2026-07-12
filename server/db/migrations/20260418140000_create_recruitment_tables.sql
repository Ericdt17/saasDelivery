-- Recruitment: job offers, custom questions, applications, answers

CREATE TABLE IF NOT EXISTS job_offers (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('livreur', 'agent')),
  description TEXT,
  location VARCHAR(255) NOT NULL DEFAULT 'Hippodrome, Yaoundé',
  slots INTEGER NOT NULL DEFAULT 1,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_questions (
  id BIGSERIAL PRIMARY KEY,
  job_offer_id BIGINT NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('text', 'mcq')),
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id BIGSERIAL PRIMARY KEY,
  job_offer_id BIGINT NOT NULL REFERENCES job_offers(id) ON DELETE RESTRICT,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  quartier VARCHAR(255),
  transport VARCHAR(50) CHECK (transport IN ('scooter', 'velo', 'voiture', 'apied')),
  availability VARCHAR(50) CHECK (availability IN ('plein', 'partiel', 'weekend')),
  cv_url TEXT,
  cv_original_name VARCHAR(255),
  funnel_step INTEGER NOT NULL DEFAULT 1,
  score INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'accepted', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_application UNIQUE (job_offer_id, phone)
);

CREATE TABLE IF NOT EXISTS job_answers (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES job_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_answer UNIQUE (application_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_job_offers_is_open ON job_offers (is_open);
CREATE INDEX IF NOT EXISTS idx_job_questions_offer ON job_questions (job_offer_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_offer ON job_applications (job_offer_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications (status);
CREATE INDEX IF NOT EXISTS idx_job_answers_application ON job_answers (application_id);
