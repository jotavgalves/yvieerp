PRAGMA foreign_keys = ON;

-- Componentes de custo usados exclusivamente na formação de preço.
-- Eles não alteram average_cost nem o capital em estoque.
ALTER TABLE products ADD COLUMN default_pricing_piece_cost REAL CHECK (default_pricing_piece_cost IS NULL OR default_pricing_piece_cost >= 0);
ALTER TABLE products ADD COLUMN default_pricing_freight_cost REAL NOT NULL DEFAULT 0 CHECK (default_pricing_freight_cost >= 0);
ALTER TABLE products ADD COLUMN default_pricing_other_cost REAL NOT NULL DEFAULT 0 CHECK (default_pricing_other_cost >= 0);

ALTER TABLE product_variants ADD COLUMN pricing_piece_cost_override REAL CHECK (pricing_piece_cost_override IS NULL OR pricing_piece_cost_override >= 0);
ALTER TABLE product_variants ADD COLUMN pricing_freight_cost_override REAL CHECK (pricing_freight_cost_override IS NULL OR pricing_freight_cost_override >= 0);
ALTER TABLE product_variants ADD COLUMN pricing_other_cost_override REAL CHECK (pricing_other_cost_override IS NULL OR pricing_other_cost_override >= 0);

-- Preserva a última composição de custo conhecida de cada variação.
-- O custo-base só vira override quando a última precificação divergia do custo médio real atual.
UPDATE product_variants
SET pricing_piece_cost_override = CASE
      WHEN EXISTS (SELECT 1 FROM pricing_history ph WHERE ph.variant_id = product_variants.id)
       AND ABS(COALESCE((SELECT ph.piece_cost FROM pricing_history ph WHERE ph.variant_id=product_variants.id ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1), average_cost)-average_cost) > 0.0001
      THEN (SELECT ph.piece_cost FROM pricing_history ph WHERE ph.variant_id=product_variants.id ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1)
      ELSE NULL
    END,
    pricing_freight_cost_override = CASE
      WHEN EXISTS (SELECT 1 FROM pricing_history ph WHERE ph.variant_id = product_variants.id)
      THEN (SELECT ph.freight_cost FROM pricing_history ph WHERE ph.variant_id=product_variants.id ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1)
      ELSE NULL
    END,
    pricing_other_cost_override = CASE
      WHEN EXISTS (SELECT 1 FROM pricing_history ph WHERE ph.variant_id = product_variants.id)
      THEN (SELECT ph.other_cost FROM pricing_history ph WHERE ph.variant_id=product_variants.id ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1)
      ELSE NULL
    END;
