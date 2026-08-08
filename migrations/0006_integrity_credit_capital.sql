PRAGMA foreign_keys = ON;

ALTER TABLE sales ADD COLUMN credit_used REAL NOT NULL DEFAULT 0 CHECK (credit_used >= 0);
ALTER TABLE sales ADD COLUMN delivery_method TEXT;
ALTER TABLE sales ADD COLUMN delivery_address TEXT;
ALTER TABLE sales ADD COLUMN promised_date TEXT;
ALTER TABLE sales ADD COLUMN order_notes TEXT;
ALTER TABLE sales ADD COLUMN deleted_at TEXT;

ALTER TABLE stock_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE stock_entries ADD COLUMN deleted_reason TEXT;

CREATE TABLE IF NOT EXISTS customer_credit_movements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  return_id TEXT REFERENCES returns(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('Crédito','Uso','Estorno','Ajuste')),
  amount REAL NOT NULL CHECK (amount <> 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_customer_credit_customer ON customer_credit_movements(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_credit_sale ON customer_credit_movements(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_credit_return ON customer_credit_movements(return_id);

INSERT INTO customer_credit_movements(id,customer_id,sale_id,return_id,type,amount,note,created_at)
SELECT 'ccm_' || lower(hex(randomblob(10))), s.customer_id, r.sale_id, r.id, 'Crédito', r.credit_amount,
       'Crédito migrado de ' || r.number, r.created_at
FROM returns r
JOIN sales s ON s.id=r.sale_id
WHERE r.credit_amount > 0
  AND NOT EXISTS (SELECT 1 FROM customer_credit_movements ccm WHERE ccm.return_id=r.id AND ccm.type='Crédito');

CREATE TABLE IF NOT EXISTS owner_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Aporte','Pró-labore','Retirada')),
  amount REAL NOT NULL CHECK (amount > 0),
  transaction_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX IF NOT EXISTS idx_owner_transactions_date ON owner_transactions(transaction_date DESC,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stock_entries_deleted ON stock_entries(deleted_at);
