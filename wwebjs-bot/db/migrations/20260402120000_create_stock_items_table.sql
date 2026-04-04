-- Create stock_items table (vendor inventory)
-- Scoped by group_id (vendor token groupId)

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_items_group_id ON stock_items(group_id);

