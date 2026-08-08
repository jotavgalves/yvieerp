PRAGMA foreign_keys = ON;

-- IDs reservados exclusivamente ao CI.
DELETE FROM customer_credit_movements WHERE id LIKE 'smoke_%';
DELETE FROM accounts_receivable WHERE id LIKE 'smoke_%';
DELETE FROM return_items WHERE id LIKE 'smoke_%';
DELETE FROM returns WHERE id LIKE 'smoke_%';
DELETE FROM inventory_movements WHERE id LIKE 'smoke_%';
DELETE FROM sale_items WHERE id LIKE 'smoke_%';
DELETE FROM sales WHERE id LIKE 'smoke_%';
DELETE FROM stock_entry_items WHERE id LIKE 'smoke_%';
DELETE FROM stock_entries WHERE id LIKE 'smoke_%';
DELETE FROM owner_transactions WHERE id LIKE 'smoke_%';
DELETE FROM product_variants WHERE id LIKE 'smoke_%';
DELETE FROM products WHERE id LIKE 'smoke_%';
DELETE FROM customers WHERE id LIKE 'smoke_%';

CREATE TEMP TABLE smoke_assertions(ok INTEGER NOT NULL CHECK(ok = 1));

-- Garante que a migration de integridade está realmente aplicada.
INSERT INTO smoke_assertions SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('sales') WHERE name='credit_used') THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('sales') WHERE name='deleted_at') THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('stock_entries') WHERE name='deleted_at') THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='customer_credit_movements') THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='owner_transactions') THEN 1 ELSE 0 END;

INSERT INTO customers(id,name,phone,tags,created_at) VALUES('smoke_customer','Cliente Smoke','5581999999999','[]',datetime('now'));
INSERT INTO products(id,name,category,status,created_at,updated_at) VALUES('smoke_product','Produto Smoke','Teste','Ativo',datetime('now'),datetime('now'));
INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_variant','smoke_product','Preto','M','SMOKE-SKU',10,1,30,60,60,65,1,datetime('now'),datetime('now'));

-- Venda de 2 peças: o mesmo efeito que a rota de venda produz no estoque.
INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivery_method)
VALUES('smoke_sale_1','SMOKE-001','smoke_customer','Separando','Pago','Pix',120,0,0,120,60,60,datetime('now'),datetime('now'),'Retirada');
INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost) VALUES('smoke_sale_item_1','smoke_sale_1','smoke_product','smoke_variant',2,60,30);
UPDATE product_variants SET stock=stock-2 WHERE id='smoke_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_mov_sale','smoke_product','smoke_variant','Venda',-2,30,'sale','smoke_sale_1','SMOKE-001',datetime('now'));
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_variant')=8 THEN 1 ELSE 0 END;

-- Devolve 1 peça e gera R$ 30 de crédito: estoque deve voltar para 9 e saldo para 30.
INSERT INTO returns(id,number,sale_id,type,refund_amount,credit_amount,created_at) VALUES('smoke_return','SMOKE-TR','smoke_sale_1','Devolução',30,30,datetime('now'));
INSERT INTO return_items(id,return_id,sale_item_id,product_id,variant_id,quantity,direction,unit_cost,unit_price)
VALUES('smoke_return_item','smoke_return','smoke_sale_item_1','smoke_product','smoke_variant',1,'Entrada',30,60);
UPDATE product_variants SET stock=stock+1 WHERE id='smoke_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_mov_return','smoke_product','smoke_variant','Devolução',1,30,'return','smoke_return','Devolução smoke',datetime('now'));
INSERT INTO customer_credit_movements(id,customer_id,sale_id,return_id,type,amount,note,created_at)
VALUES('smoke_credit_in','smoke_customer','smoke_sale_1','smoke_return','Crédito',30,'Crédito smoke',datetime('now'));
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_variant')=9 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT SUM(amount) FROM customer_credit_movements WHERE customer_id='smoke_customer')=30 THEN 1 ELSE 0 END;

-- Novo pedido usa R$ 20 do crédito e deixa R$ 10 de saldo.
INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivery_method)
VALUES('smoke_sale_2','SMOKE-002','smoke_customer','Separando','Pendente','Pix',60,0,20,60,30,30,datetime('now'),datetime('now'),'Retirada');
INSERT INTO customer_credit_movements(id,customer_id,sale_id,type,amount,note,created_at)
VALUES('smoke_credit_use','smoke_customer','smoke_sale_2','Uso',-20,'Uso smoke',datetime('now'));
INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at)
VALUES('smoke_receivable','smoke_sale_2','Saldo smoke',40,date('now'),'Pendente',datetime('now'),datetime('now'));
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT SUM(amount) FROM customer_credit_movements WHERE customer_id='smoke_customer')=10 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT amount FROM accounts_receivable WHERE id='smoke_receivable')=40 THEN 1 ELSE 0 END;

-- Capital dos sócios permanece separado do resultado operacional.
INSERT INTO owner_transactions(id,type,amount,transaction_date,notes,created_at) VALUES('smoke_owner_1','Aporte',1000,date('now'),'Aporte smoke',datetime('now'));
INSERT INTO owner_transactions(id,type,amount,transaction_date,notes,created_at) VALUES('smoke_owner_2','Pró-labore',200,date('now'),'Pró-labore smoke',datetime('now'));
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT SUM(CASE WHEN type='Aporte' THEN amount ELSE 0 END) FROM owner_transactions WHERE id LIKE 'smoke_%')=1000 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT SUM(CASE WHEN type='Pró-labore' THEN amount ELSE 0 END) FROM owner_transactions WHERE id LIKE 'smoke_%')=200 THEN 1 ELSE 0 END;

-- Soft delete não remove a trilha histórica, mas permite tirá-la da operação ativa.
UPDATE sales SET deleted_at=datetime('now') WHERE id='smoke_sale_2';
INSERT INTO smoke_assertions SELECT CASE WHEN (SELECT COUNT(*) FROM sales WHERE id='smoke_sale_2' AND deleted_at IS NULL)=0 THEN 1 ELSE 0 END;

DROP TABLE smoke_assertions;
