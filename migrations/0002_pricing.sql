PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pricing_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  piece_cost REAL NOT NULL CHECK (piece_cost >= 0),
  freight_cost REAL NOT NULL DEFAULT 0 CHECK (freight_cost >= 0),
  other_cost REAL NOT NULL DEFAULT 0 CHECK (other_cost >= 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  target_margin REAL NOT NULL DEFAULT 0 CHECK (target_margin >= 0 AND target_margin < 100),
  card_fee REAL NOT NULL DEFAULT 0 CHECK (card_fee >= 0 AND card_fee < 100),
  cash_price REAL NOT NULL CHECK (cash_price >= 0),
  card_price REAL NOT NULL CHECK (card_price >= 0),
  applied_price REAL NOT NULL CHECK (applied_price >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_pricing_variant ON pricing_history(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_product ON pricing_history(product_id, created_at DESC);
