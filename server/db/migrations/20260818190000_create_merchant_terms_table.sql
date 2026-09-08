-- Conditions générales pour les marchands partenaires (super_admin CRUD)

CREATE TABLE IF NOT EXISTS merchant_terms (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_terms_is_active ON merchant_terms (is_active);
CREATE INDEX IF NOT EXISTS idx_merchant_terms_created_at ON merchant_terms (created_at DESC);
