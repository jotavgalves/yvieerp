-- cash_price é a fonte de verdade do preço à vista/Pix.
-- sale_price permanece apenas como espelho legado para compatibilidade.
UPDATE product_variants
SET sale_price = cash_price,
    updated_at = datetime('now')
WHERE ABS(COALESCE(sale_price,0) - COALESCE(cash_price,0)) > 0.0001;

CREATE TRIGGER IF NOT EXISTS trg_product_variant_cash_price_sync
AFTER UPDATE OF cash_price ON product_variants
WHEN ABS(COALESCE(NEW.sale_price,0) - COALESCE(NEW.cash_price,0)) > 0.0001
BEGIN
  UPDATE product_variants
  SET sale_price = NEW.cash_price
  WHERE id = NEW.id;
END;
