PRAGMA foreign_keys = ON;

ALTER TABLE sales ADD COLUMN delivered_at TEXT;
ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'Pago' CHECK (status IN ('Pago','Pendente'));
ALTER TABLE expenses ADD COLUMN due_date TEXT;
ALTER TABLE expenses ADD COLUMN paid_at TEXT;
ALTER TABLE expenses ADD COLUMN beneficiary TEXT;

UPDATE sales SET delivered_at=updated_at WHERE order_status='Entregue' AND delivered_at IS NULL;
UPDATE expenses SET paid_at=created_at WHERE status='Pago' AND paid_at IS NULL;

CREATE TABLE IF NOT EXISTS accounts_receivable (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente','Recebido','Cancelado')),
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_receivable_status_due ON accounts_receivable(status,due_date);
CREATE INDEX IF NOT EXISTS idx_receivable_sale ON accounts_receivable(sale_id);

INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at)
SELECT 'rec_' || lower(hex(randomblob(10))), id, 'Saldo de ' || number, total, substr(created_at,1,10), 'Pendente', created_at, updated_at
FROM sales
WHERE payment_status='Pendente' AND order_status<>'Cancelado'
  AND NOT EXISTS (SELECT 1 FROM accounts_receivable ar WHERE ar.sale_id=sales.id AND ar.status<>'Cancelado');

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('Devolução','Troca')),
  refund_amount REAL NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  credit_amount REAL NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_id,created_at DESC);

CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE RESTRICT,
  sale_item_id TEXT REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  direction TEXT NOT NULL CHECK (direction IN ('Entrada','Saída')),
  unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

CREATE TABLE IF NOT EXISTS inventory_counts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho','Aplicado','Cancelado')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS inventory_count_items (
  id TEXT PRIMARY KEY,
  count_id TEXT NOT NULL REFERENCES inventory_counts(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  expected_quantity INTEGER NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity INTEGER NOT NULL CHECK (counted_quantity >= 0),
  difference INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_inventory_count_items_count ON inventory_count_items(count_id);
