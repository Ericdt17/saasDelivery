-- Singleton company branding for PDFs / reports (mirrors backend_core company_settings).
CREATE TABLE IF NOT EXISTS company_settings (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  company_name VARCHAR(120) NOT NULL DEFAULT 'LivSight',
  legal_name VARCHAR(160),
  tax_id VARCHAR(40),
  trade_register VARCHAR(80),
  address TEXT,
  phone VARCHAR(40),
  email VARCHAR(120),
  accent_color VARCHAR(7) NOT NULL DEFAULT '#4A9FD4',
  logo_base64 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_settings (id, company_name, legal_name, address, phone, email, accent_color)
VALUES (
  1,
  'LivSight',
  'LivSight',
  'Douala, Cameroun',
  '+237 000 000 000',
  'contact@livsight.com',
  '#4A9FD4'
)
ON CONFLICT (id) DO NOTHING;
