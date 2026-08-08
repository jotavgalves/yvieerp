PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN image_key TEXT;
ALTER TABLE product_variants ADD COLUMN image_key TEXT;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  instagram TEXT,
  email TEXT,
  cnpj TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pedido' CHECK (status IN ('Pedido','Recebido','Cancelado')),
  items_subtotal REAL NOT NULL DEFAULT 0 CHECK (items_subtotal >= 0),
  freight_cost REAL NOT NULL DEFAULT 0 CHECK (freight_cost >= 0),
  other_cost REAL NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  total_cost REAL NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_units INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  notes TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status, purchase_date DESC);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
