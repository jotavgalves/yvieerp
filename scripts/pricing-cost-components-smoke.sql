-- Valida que custo-base, frete e outros custos podem ser definidos por produto e sobrescritos por variação
-- sem alterar o custo médio real do estoque.
DELETE FROM product_variants WHERE id IN ('smoke_cost_rule_a1','smoke_cost_rule_a2');
DELETE FROM products WHERE id='smoke_cost_rule_a';
DROP TABLE IF EXISTS smoke_pricing_cost_assertions;
CREATE TABLE smoke_pricing_cost_assertions(ok INTEGER NOT NULL CHECK(ok=1));

INSERT INTO products(
  id,name,category,status,default_target_margin,default_card_fee,
  default_pricing_piece_cost,default_pricing_freight_cost,default_pricing_other_cost,
  created_at,updated_at
) VALUES(
  'smoke_cost_rule_a','Produto Custos','Teste','Ativo',50,4,NULL,3,2,datetime('now'),datetime('now')
);

INSERT INTO product_variants(
  id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,
  target_margin_override,card_fee_override,pricing_piece_cost_override,
  pricing_freight_cost_override,pricing_other_cost_override,active,created_at,updated_at
) VALUES
('smoke_cost_rule_a1','smoke_cost_rule_a','SMOKE-COST-RULE-A1',5,1,20,50,50,52,NULL,NULL,NULL,NULL,NULL,1,datetime('now'),datetime('now')),
('smoke_cost_rule_a2','smoke_cost_rule_a','SMOKE-COST-RULE-A2',5,1,22,50,50,52,60,5,30,7,4,1,datetime('now'),datetime('now'));

-- A1 herda o produto: como o custo-base padrão é NULL, usa o custo médio real 20.
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((
  SELECT COALESCE(v.pricing_piece_cost_override,p.default_pricing_piece_cost,v.average_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-20)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((
  SELECT COALESCE(v.pricing_freight_cost_override,p.default_pricing_freight_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-3)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((
  SELECT COALESCE(v.pricing_other_cost_override,p.default_pricing_other_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-2)<0.001 THEN 1 ELSE 0 END;

-- A2 é personalizada e deve ignorar o padrão do produto.
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((SELECT pricing_piece_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-30)<0.001
                 AND ABS((SELECT pricing_freight_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-7)<0.001
                 AND ABS((SELECT pricing_other_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-4)<0.001
            THEN 1 ELSE 0 END;

-- Alterar o padrão do produto afeta somente a variação herdada.
UPDATE products
SET default_pricing_piece_cost=26,default_pricing_freight_cost=5,default_pricing_other_cost=1
WHERE id='smoke_cost_rule_a';
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((
  SELECT COALESCE(v.pricing_piece_cost_override,p.default_pricing_piece_cost,v.average_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-26)<0.001
AND ABS((
  SELECT COALESCE(v.pricing_freight_cost_override,p.default_pricing_freight_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-5)<0.001
AND ABS((
  SELECT COALESCE(v.pricing_other_cost_override,p.default_pricing_other_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a1'
)-1)<0.001 THEN 1 ELSE 0 END;

INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((SELECT pricing_piece_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-30)<0.001
                 AND ABS((SELECT pricing_freight_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-7)<0.001
                 AND ABS((SELECT pricing_other_cost_override FROM product_variants WHERE id='smoke_cost_rule_a2')-4)<0.001
            THEN 1 ELSE 0 END;

-- Nenhuma configuração comercial pode reavaliar o estoque.
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_cost_rule_a1')-20)<0.001
                 AND ABS((SELECT average_cost FROM product_variants WHERE id='smoke_cost_rule_a2')-22)<0.001
            THEN 1 ELSE 0 END;

-- Voltar A2 para herança remove todos os overrides de formação de preço.
UPDATE product_variants
SET target_margin_override=NULL,card_fee_override=NULL,pricing_piece_cost_override=NULL,
    pricing_freight_cost_override=NULL,pricing_other_cost_override=NULL
WHERE id='smoke_cost_rule_a2';
INSERT INTO smoke_pricing_cost_assertions
SELECT CASE WHEN ABS((
  SELECT COALESCE(v.pricing_piece_cost_override,p.default_pricing_piece_cost,v.average_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a2'
)-26)<0.001
AND ABS((
  SELECT COALESCE(v.pricing_freight_cost_override,p.default_pricing_freight_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a2'
)-5)<0.001
AND ABS((
  SELECT COALESCE(v.pricing_other_cost_override,p.default_pricing_other_cost)
  FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_cost_rule_a2'
)-1)<0.001 THEN 1 ELSE 0 END;

DROP TABLE smoke_pricing_cost_assertions;
DELETE FROM product_variants WHERE id IN ('smoke_cost_rule_a1','smoke_cost_rule_a2');
DELETE FROM products WHERE id='smoke_cost_rule_a';
