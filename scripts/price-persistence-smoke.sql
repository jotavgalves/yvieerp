-- Garante que apenas o fluxo de Precificação altera preços de variante existente.
DELETE FROM operation_guards WHERE operation_key LIKE 'pricing:smoke_price_variant%' OR operation_key LIKE 'price-restore:smoke_price_variant%';
DELETE FROM product_variants WHERE id='smoke_price_variant';
DELETE FROM products WHERE id='smoke_price_product';
DROP TABLE IF EXISTS smoke_price_assertions;
CREATE TABLE smoke_price_assertions(ok INTEGER NOT NULL CHECK(ok = 1));

INSERT INTO products(id,name,category,status,created_at,updated_at)
VALUES('smoke_price_product','Produto Preço Smoke','Teste','Ativo',datetime('now'),datetime('now'));

INSERT INTO product_variants(id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_price_variant','smoke_price_product','SMOKE-PRICE',0,1,20,50,50,55,1,datetime('now'),datetime('now'));

-- Simula uma Entrada/edição antiga tentando regravar preços desatualizados junto com estoque.
-- O estoque deve mudar, mas os preços precisam permanecer intactos.
UPDATE product_variants
SET stock=3,cash_price=42,card_price=44,sale_price=42
WHERE id='smoke_price_variant';
INSERT INTO smoke_price_assertions
SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_price_variant')=3
                 AND ABS((SELECT cash_price FROM product_variants WHERE id='smoke_price_variant')-50)<0.001
                 AND ABS((SELECT sale_price FROM product_variants WHERE id='smoke_price_variant')-50)<0.001
                 AND ABS((SELECT card_price FROM product_variants WHERE id='smoke_price_variant')-55)<0.001
            THEN 1 ELSE 0 END;

-- Precificação abre uma guarda curta e é a única operação autorizada a alterar os preços.
INSERT INTO operation_guards(operation_key,created_at)
VALUES('pricing:smoke_price_variant',datetime('now'));
UPDATE product_variants
SET cash_price=79.90,card_price=84.90,sale_price=79.90
WHERE id='smoke_price_variant';
DELETE FROM operation_guards WHERE operation_key='pricing:smoke_price_variant';
INSERT INTO smoke_price_assertions
SELECT CASE WHEN ABS((SELECT cash_price FROM product_variants WHERE id='smoke_price_variant')-79.90)<0.001
                 AND ABS((SELECT sale_price FROM product_variants WHERE id='smoke_price_variant')-79.90)<0.001
                 AND ABS((SELECT card_price FROM product_variants WHERE id='smoke_price_variant')-84.90)<0.001
            THEN 1 ELSE 0 END;

-- Escrita apenas no campo legado também não pode criar uma segunda verdade.
UPDATE product_variants SET sale_price=12 WHERE id='smoke_price_variant';
INSERT INTO smoke_price_assertions
SELECT CASE WHEN ABS((SELECT sale_price FROM product_variants WHERE id='smoke_price_variant')-79.90)<0.001 THEN 1 ELSE 0 END;

DROP TABLE smoke_price_assertions;
DELETE FROM operation_guards WHERE operation_key LIKE 'pricing:smoke_price_variant%' OR operation_key LIKE 'price-restore:smoke_price_variant%';
DELETE FROM product_variants WHERE id='smoke_price_variant';
DELETE FROM products WHERE id='smoke_price_product';
