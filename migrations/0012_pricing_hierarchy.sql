PRAGMA foreign_keys = ON;

-- Regra de precificação em dois níveis:
-- produto define o padrão; variante pode sobrescrever somente quando necessário.
ALTER TABLE products ADD COLUMN default_target_margin REAL NOT NULL DEFAULT 55 CHECK (default_target_margin >= 0 AND default_target_margin <= 95);
ALTER TABLE products ADD COLUMN default_card_fee REAL NOT NULL DEFAULT 6.12 CHECK (default_card_fee >= 0 AND default_card_fee <= 40);

ALTER TABLE product_variants ADD COLUMN target_margin_override REAL CHECK (target_margin_override IS NULL OR (target_margin_override >= 0 AND target_margin_override <= 95));
ALTER TABLE product_variants ADD COLUMN card_fee_override REAL CHECK (card_fee_override IS NULL OR (card_fee_override >= 0 AND card_fee_override <= 40));

-- O registro de precificação mais recente do produto vira seu padrão inicial.
UPDATE products
SET default_target_margin = COALESCE((
      SELECT ph.target_margin
      FROM pricing_history ph
      WHERE ph.product_id = products.id
      ORDER BY ph.created_at DESC, ph.rowid DESC
      LIMIT 1
    ), default_target_margin),
    default_card_fee = COALESCE((
      SELECT ph.card_fee
      FROM pricing_history ph
      WHERE ph.product_id = products.id
      ORDER BY ph.created_at DESC, ph.rowid DESC
      LIMIT 1
    ), default_card_fee);

-- Preserva diferenças reais entre variantes como override. Se a última regra da variante
-- for igual ao padrão do produto, ela passa a herdar e não duplica configuração.
UPDATE product_variants
SET target_margin_override = CASE
      WHEN EXISTS (SELECT 1 FROM pricing_history ph WHERE ph.variant_id = product_variants.id)
       AND ABS(COALESCE((
          SELECT ph.target_margin FROM pricing_history ph
          WHERE ph.variant_id = product_variants.id
          ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1
        ), (SELECT p.default_target_margin FROM products p WHERE p.id = product_variants.product_id))
        - (SELECT p.default_target_margin FROM products p WHERE p.id = product_variants.product_id)) > 0.0001
      THEN (
        SELECT ph.target_margin FROM pricing_history ph
        WHERE ph.variant_id = product_variants.id
        ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1
      )
      ELSE NULL
    END,
    card_fee_override = CASE
      WHEN EXISTS (SELECT 1 FROM pricing_history ph WHERE ph.variant_id = product_variants.id)
       AND ABS(COALESCE((
          SELECT ph.card_fee FROM pricing_history ph
          WHERE ph.variant_id = product_variants.id
          ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1
        ), (SELECT p.default_card_fee FROM products p WHERE p.id = product_variants.product_id))
        - (SELECT p.default_card_fee FROM products p WHERE p.id = product_variants.product_id)) > 0.0001
      THEN (
        SELECT ph.card_fee FROM pricing_history ph
        WHERE ph.variant_id = product_variants.id
        ORDER BY ph.created_at DESC, ph.rowid DESC LIMIT 1
      )
      ELSE NULL
    END;
