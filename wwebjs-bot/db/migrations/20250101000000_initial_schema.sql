-- Initial Schema Migration
-- Creates all base tables for the application
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Agencies table
CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'agency',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  whatsapp_group_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  items TEXT,
  amount_due DECIMAL(10, 2) DEFAULT 0,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  quartier VARCHAR(255),
  notes TEXT,
  carrier VARCHAR(255),
  group_id INTEGER,
  agency_id INTEGER,
  whatsapp_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

-- Delivery history table
CREATE TABLE IF NOT EXISTS delivery_history (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  actor VARCHAR(100) DEFAULT 'bot',
  agency_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id);
CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id);
CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id);
CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email);
CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id);
CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id);


