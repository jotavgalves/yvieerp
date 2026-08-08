PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operation_guards (
  operation_key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

ALTER TABLE sale_items ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

UPDATE sale_items
SET returned_quantity = COALESCE((SELECT SUM(ri.quantity) FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE ri.sale_item_id=sale_items.id AND ri.direction='Entrada'),0);

ALTER TABLE returns ADD COLUMN returned_value REAL NOT NULL DEFAULT 0 CHECK (returned_value >= 0);
ALTER TABLE returns ADD COLUMN exchange_value REAL NOT NULL DEFAULT 0 CHECK (exchange_value >= 0);
ALTER TABLE returns ADD COLUMN debt_offset REAL NOT NULL DEFAULT 0 CHECK (debt_offset >= 0);
ALTER TABLE returns ADD COLUMN additional_amount REAL NOT NULL DEFAULT 0 CHECK (additional_amount >= 0);
ALTER TABLE returns ADD COLUMN additional_payment_status TEXT CHECK (additional_payment_status IN ('Pago','Pendente'));

UPDATE returns
SET returned_value=COALESCE((SELECT SUM(ri.quantity*ri.unit_price) FROM return_items ri WHERE ri.return_id=returns.id AND ri.direction='Entrada'),0),
    exchange_value=COALESCE((SELECT SUM(ri.quantity*ri.unit_price) FROM return_items ri WHERE ri.return_id=returns.id AND ri.direction='Saída'),0);
UPDATE returns SET additional_amount=CASE WHEN exchange_value>returned_value THEN exchange_value-returned_value ELSE 0 END,additional_payment_status=CASE WHEN exchange_value>returned_value THEN 'Pago' ELSE NULL END;

CREATE INDEX IF NOT EXISTS idx_returns_financial_values ON returns(sale_id,returned_value,exchange_value);

CREATE TRIGGER IF NOT EXISTS trg_customer_credit_nonnegative
BEFORE INSERT ON customer_credit_movements
WHEN (SELECT COALESCE(SUM(amount),0) FROM customer_credit_movements WHERE customer_id=NEW.customer_id)+NEW.amount < -0.009
BEGIN
  SELECT RAISE(ABORT,'NEGATIVE_CUSTOMER_CREDIT');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_receive_once
BEFORE UPDATE OF status ON purchases
WHEN OLD.status='Recebido' AND NEW.status='Recebido'
BEGIN
  SELECT RAISE(ABORT,'PURCHASE_ALREADY_RECEIVED');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_reverse_once
BEFORE UPDATE OF reversed_at ON purchases
WHEN OLD.reversed_at IS NOT NULL AND NEW.reversed_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'PURCHASE_ALREADY_REVERSED');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_entry_delete_once
BEFORE UPDATE OF deleted_at ON stock_entries
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'ENTRY_ALREADY_DELETED');
END;

CREATE TRIGGER IF NOT EXISTS trg_inventory_count_apply_once
BEFORE UPDATE OF status ON inventory_counts
WHEN OLD.status='Aplicado' AND NEW.status='Aplicado'
BEGIN
  SELECT RAISE(ABORT,'INVENTORY_COUNT_ALREADY_APPLIED');
END;
