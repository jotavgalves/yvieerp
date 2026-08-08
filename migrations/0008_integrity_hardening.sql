PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operation_guards (
  operation_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

ALTER TABLE sale_items ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

UPDATE sale_items
SET returned_quantity = COALESCE((
  SELECT SUM(ri.quantity)
  FROM return_items ri
  JOIN returns r ON r.id = ri.return_id
  WHERE ri.sale_item_id = sale_items.id AND ri.direction = 'Entrada'
), 0);

ALTER TABLE returns ADD COLUMN returned_value REAL NOT NULL DEFAULT 0 CHECK (returned_value >= 0);
ALTER TABLE returns ADD COLUMN exchange_value REAL NOT NULL DEFAULT 0 CHECK (exchange_value >= 0);
ALTER TABLE returns ADD COLUMN debt_offset REAL NOT NULL DEFAULT 0 CHECK (debt_offset >= 0);
ALTER TABLE returns ADD COLUMN additional_amount REAL NOT NULL DEFAULT 0 CHECK (additional_amount >= 0);
ALTER TABLE returns ADD COLUMN additional_payment_status TEXT CHECK (additional_payment_status IN ('Pago','Pendente'));

UPDATE returns
SET returned_value = COALESCE((SELECT SUM(ri.quantity * ri.unit_price) FROM return_items ri WHERE ri.return_id = returns.id AND ri.direction = 'Entrada'), 0),
    exchange_value = COALESCE((SELECT SUM(ri.quantity * ri.unit_price) FROM return_items ri WHERE ri.return_id = returns.id AND ri.direction = 'Saída'), 0);

UPDATE returns
SET additional_amount = CASE WHEN exchange_value > returned_value THEN exchange_value - returned_value ELSE 0 END,
    additional_payment_status = CASE WHEN exchange_value > returned_value THEN 'Pago' ELSE NULL END;

CREATE INDEX IF NOT EXISTS idx_returns_financial_values ON returns(sale_id, returned_value, exchange_value);
