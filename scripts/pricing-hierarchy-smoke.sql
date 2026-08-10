-- Valida a hierarquia Produto -> Variação sem vazamento de configuração.
DELETE FROM product_variants WHERE id IN ('smoke_rule_a1','smoke_rule_a2','smoke_rule_b1');
DELETE FROM products WHERE id IN ('smoke_rule_a','smoke_rule_b');
DROP TABLE IF EXISTS smoke_pricing_rule_assertions;
CREATE TABLE smoke_pricing_rule_assertions(ok INTEGER NOT NULL CHECK(ok=1));

INSERT INTO products(id,name,category,status,default_target_margin,default_card_fee,created_at,updated_at)
VALUES
('smoke_rule_a','Produto A','Teste','Ativo',50,4,datetime('now'),datetime('now')),
('smoke_rule_b','Produto B','Teste','Ativo',45,3,datetime('now'),datetime('now'));

INSERT INTO product_variants(id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,target_margin_override,card_fee_override,active,created_at,updated_at)
VALUES
('smoke_rule_a1','smoke_rule_a','SMOKE-RULE-A1',1,1,20,40,40,42,NULL,NULL,1,datetime('now'),datetime('now')),
('smoke_rule_a2','smoke_rule_a','SMOKE-RULE-A2',1,1,20,50,50,55,70,8,1,datetime('now'),datetime('now')),
('smoke_rule_b1','smoke_rule_b','SMOKE-RULE-B1',1,1,20,40,40,42,NULL,NULL,1,datetime('now'),datetime('now'));

-- A1 herda A; A2 usa override; B1 herda B.
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a1')-50)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a1')-4)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-70)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-8)<0.001 THEN 1 ELSE 0 END;

-- Alterar Produto A afeta somente variantes herdadas de A.
UPDATE products SET default_target_margin=60,default_card_fee=5.5 WHERE id='smoke_rule_a';
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a1')-60)<0.001
                 AND ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a1')-5.5)<0.001
            THEN 1 ELSE 0 END;
-- Override A2 não muda.
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-70)<0.001
                 AND ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-8)<0.001
            THEN 1 ELSE 0 END;
-- Produto B não muda.
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_b1')-45)<0.001
                 AND ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_b1')-3)<0.001
            THEN 1 ELSE 0 END;

-- Voltar A2 para herança remove a personalização e passa a usar o padrão A.
UPDATE product_variants SET target_margin_override=NULL,card_fee_override=NULL WHERE id='smoke_rule_a2';
INSERT INTO smoke_pricing_rule_assertions
SELECT CASE WHEN ABS((SELECT COALESCE(v.target_margin_override,p.default_target_margin) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-60)<0.001
                 AND ABS((SELECT COALESCE(v.card_fee_override,p.default_card_fee) FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id='smoke_rule_a2')-5.5)<0.001
            THEN 1 ELSE 0 END;

DROP TABLE smoke_pricing_rule_assertions;
DELETE FROM product_variants WHERE id IN ('smoke_rule_a1','smoke_rule_a2','smoke_rule_b1');
DELETE FROM products WHERE id IN ('smoke_rule_a','smoke_rule_b');
