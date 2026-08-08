PRAGMA foreign_keys = ON;

ALTER TABLE purchases ADD COLUMN cancelled_at TEXT;
ALTER TABLE purchases ADD COLUMN reversed_at TEXT;
ALTER TABLE purchases ADD COLUMN reversal_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_reversed ON purchases(reversed_at);
