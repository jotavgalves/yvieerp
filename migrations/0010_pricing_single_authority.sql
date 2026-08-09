-- Uma variante existente só pode ter preço de venda alterado pelo fluxo de Precificação.
-- Outros módulos continuam livres para alterar estoque, custo, SKU etc., mas qualquer preço
-- enviado por engano é restaurado pelo D1 sem desfazer o restante da operação.

CREATE TRIGGER IF NOT EXISTS trg_product_variant_price_authority
AFTER UPDATE OF cash_price, card_price ON product_variants
WHEN (
  ABS(COALESCE(NEW.cash_price,0)-COALESCE(OLD.cash_price,0)) > 0.0001
  OR ABS(COALESCE(NEW.card_price,0)-COALESCE(OLD.card_price,0)) > 0.0001
)
AND NOT EXISTS (
  SELECT 1 FROM operation_guards WHERE operation_key='pricing:' || NEW.id
)
AND NOT EXISTS (
  SELECT 1 FROM operation_guards WHERE operation_key='price-restore:' || NEW.id
)
BEGIN
  INSERT OR REPLACE INTO operation_guards(operation_key,created_at)
  VALUES('price-restore:' || NEW.id,datetime('now'));

  UPDATE product_variants
  SET cash_price=OLD.cash_price,
      card_price=OLD.card_price,
      sale_price=OLD.cash_price
  WHERE id=NEW.id;

  DELETE FROM operation_guards WHERE operation_key='price-restore:' || NEW.id;
END;

-- sale_price é somente espelho legado; nunca pode divergir do preço à vista.
CREATE TRIGGER IF NOT EXISTS trg_product_variant_sale_price_mirror
AFTER UPDATE OF sale_price ON product_variants
WHEN ABS(COALESCE(NEW.sale_price,0)-COALESCE(NEW.cash_price,0)) > 0.0001
BEGIN
  UPDATE product_variants SET sale_price=NEW.cash_price WHERE id=NEW.id;
END;
