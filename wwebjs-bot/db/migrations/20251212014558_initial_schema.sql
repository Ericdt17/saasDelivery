CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'agency',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  customer_name TEXT,
  items TEXT,
  amount_due DECIMAL(10, 2) DEFAULT 0,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  quartier TEXT,
  notes TEXT,
  carrier TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agency_id INTEGER,
  group_id INTEGER,
  whatsapp_message_id TEXT
);

CREATE TABLE IF NOT EXISTS delivery_history (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT DEFAULT 'bot',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agency_id INTEGER
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  whatsapp_group_id TEXT,
  name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries (phone);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);

CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries (created_at);

CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history (delivery_id);

ALTER TABLE delivery_history ADD CONSTRAINT fk_delivery_history_delivery_id FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE groups ADD CONSTRAINT fk_groups_agency_id FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE ON UPDATE NO ACTION;