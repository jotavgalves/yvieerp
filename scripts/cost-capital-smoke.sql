-- Garante que corrigir custo médio reavalia o capital em estoque sem alterar quantidade.
DELETE FROM inventory_movements WHERE variant_id='smoke_cost_variant';
DELETE FROM product_variants WHERE id='smoke_cost_variant';
DELETE FROM products WHERE id='smoke_cost_product';
DROP TABLE IF EXISTS smoke_cost_assertions;
CREATE TABLE smoke_cost_assertions(ok INTEGER NOT NULL CHECK(ok = 1));

INSERT INTO products(id,name,category,status,created_at,updated_at)
VALUES('smoke_cost_product','Produto Custo Smoke','Teste','Ativo',datetime('now'),datetime('now'));
INSERT INTO product_variants(id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_cost_variant','smoke_cost_product','SMOKE-COST',10,1,20,50,50,55,1,datetime('now'),datetime('now'));
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at)
VALUES('smoke_cost_initial','smoke_cost_product','smoke_cost_variant','Ajuste',10,20,'Estoque inicial',datetime('now'));

INSERT INTO smoke_cost_assertions
SELECT CASE WHEN ABS((SELECT stock*average_cost FROM product_variants WHERE id='smoke_cost_variant')-200)<0.001 THEN 1 ELSE 0 END;

-- Simula a correção auditável de custo: quantidade fica igual, custo médio muda.
UPDATE product_variants
SET average_cost=CASE WHEN ABS(average_cost-20)<0.000001 THEN 30 ELSE -1 END,
    updated_at=datetime('now')
WHERE id='smoke_cost_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_cost_adjust','smoke_cost_product','smoke_cost_variant','Ajuste',0,30,'cost_adjustment','smoke_cost_ref','Correção de custo médio: 20.00 → 30.00',datetime('now'));

INSERT INTO smoke_cost_assertions
SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_cost_variant')=10 THEN 1 ELSE 0 END;
INSERT INTO smoke_cost_assertions
SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_cost_variant')-30)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_cost_assertions
SELECT CASE WHEN ABS((SELECT stock*average_cost FROM product_variants WHERE id='smoke_cost_variant')-300)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_cost_assertions
SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_cost_variant')=(SELECT SUM(quantity) FROM inventory_movements WHERE variant_id='smoke_cost_variant') THEN 1 ELSE 0 END;

DROP TABLE smoke_cost_assertions;
DELETE FROM inventory_movements WHERE variant_id='smoke_cost_variant';
DELETE FROM product_variants WHERE id='smoke_cost_variant';
DELETE FROM products WHERE id='smoke_cost_product';
