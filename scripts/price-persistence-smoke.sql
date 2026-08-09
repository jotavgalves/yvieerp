-- Garante que cash_price é a fonte de verdade e que sale_price acompanha o valor salvo.
DELETE FROM product_variants WHERE id='smoke_price_variant';
DELETE FROM products WHERE id='smoke_price_product';
DROP TABLE IF EXISTS smoke_price_assertions;
CREATE TABLE smoke_price_assertions(ok INTEGER NOT NULL CHECK(ok = 1));

INSERT INTO products(id,name,category,status,created_at,updated_at)
VALUES('smoke_price_product','Produto Preço Smoke','Teste','Ativo',datetime('now'),datetime('now'));

INSERT INTO product_variants(id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_price_variant','smoke_price_product','SMOKE-PRICE',0,1,20,50,50,55,1,datetime('now'),datetime('now'));

-- Simula a persistência do novo preço à vista. O trigger deve manter o espelho legado sincronizado.
UPDATE product_variants SET cash_price=79.90 WHERE id='smoke_price_variant';
INSERT INTO smoke_price_assertions
SELECT CASE WHEN ABS((SELECT cash_price FROM product_variants WHERE id='smoke_price_variant')-79.90)<0.001
                 AND ABS((SELECT sale_price FROM product_variants WHERE id='smoke_price_variant')-79.90)<0.001
                 AND ABS((SELECT card_price FROM product_variants WHERE id='smoke_price_variant')-55)<0.001
            THEN 1 ELSE 0 END;

DROP TABLE smoke_price_assertions;
DELETE FROM product_variants WHERE id='smoke_price_variant';
DELETE FROM products WHERE id='smoke_price_product';
