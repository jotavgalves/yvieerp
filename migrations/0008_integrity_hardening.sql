PRAGMA foreign_keys = ON;

ALTER TABLE returns ADD COLUMN returned_value REAL NOT NULL DEFAULT 0 CHECK (returned_value >= 0);
ALTER TABLE returns ADD COLUMN exchange_value REAL NOT NULL DEFAULT 0 CHECK (exchange_value >= 0);
ALTER TABLE returns ADD COLUMN debt_offset REAL NOT NULL DEFAULT 0 CHECK (debt_offset >= 0);
ALTER TABLE returns ADD COLUMN additional_amount REAL NOT NULL DEFAULT 0 CHECK (additional_amount >= 0);
ALTER TABLE returns ADD COLUMN additional_payment_status TEXT CHECK (additional_payment_status IN ('Pago','Pendente'));

UPDATE returns
SET returned_value = COALESCE((
      SELECT SUM(ri.quantity * ri.unit_price)
      FROM return_items ri
      WHERE ri.return_id = returns.id AND ri.direction = 'Entrada'
    ), 0),
    exchange_value = COALESCE((
      SELECT SUM(ri.quantity * ri.unit_price)
      FROM return_items ri
      WHERE ri.return_id = returns.id AND ri.direction = 'Saída'
    ), 0);

UPDATE returns
SET additional_amount = CASE
      WHEN exchange_value > returned_value THEN exchange_value - returned_value
      ELSE 0
    END,
    additional_payment_status = CASE
      WHEN exchange_value > returned_value THEN 'Pago'
      ELSE NULL
    END;

CREATE INDEX IF NOT EXISTS idx_returns_financial_values ON returns(sale_id, returned_value, exchange_value);
