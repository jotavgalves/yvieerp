-- Teste de fumaça executado somente no D1 local do CI.
-- Exercita os invariantes centrais de estoque, devolução, crédito, A receber, compras e estornos.

DELETE FROM customer_credit_movements WHERE id LIKE 'smoke_%';
DELETE FROM accounts_receivable WHERE id LIKE 'smoke_%';
DELETE FROM return_items WHERE id LIKE 'smoke_%';
DELETE FROM returns WHERE id LIKE 'smoke_%';
DELETE FROM inventory_movements WHERE id LIKE 'smoke_%';
DELETE FROM sale_items WHERE id LIKE 'smoke_%';
DELETE FROM sales WHERE id LIKE 'smoke_%';
DELETE FROM stock_entry_items WHERE id LIKE 'smoke_%';
DELETE FROM stock_entries WHERE id LIKE 'smoke_%';
DELETE FROM purchase_items WHERE id LIKE 'smoke_%';
DELETE FROM purchases WHERE id LIKE 'smoke_%';
DELETE FROM suppliers WHERE id LIKE 'smoke_%';
DELETE FROM owner_transactions WHERE id LIKE 'smoke_%';
DELETE FROM product_variants WHERE id LIKE 'smoke_%';
DELETE FROM products WHERE id LIKE 'smoke_%';
DELETE FROM customers WHERE id LIKE 'smoke_%';
DROP TABLE IF EXISTS smoke_assertions_ci;
CREATE TABLE smoke_assertions_ci(ok INTEGER NOT NULL CHECK(ok = 1));

INSERT INTO customers(id,name,phone,tags,created_at) VALUES('smoke_customer','Cliente Smoke','5581999999999','[]',datetime('now'));
INSERT INTO products(id,name,category,status,created_at,updated_at) VALUES('smoke_product','Produto Smoke','Teste','Ativo',datetime('now'),datetime('now'));
INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_variant','smoke_product','Preto','M','SMOKE-SKU',10,1,30,60,60,65,1,datetime('now'),datetime('now'));
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at)
VALUES('smoke_mov_initial','smoke_product','smoke_variant','Ajuste',10,30,'Estoque inicial',datetime('now'));

-- Venda de 2 peças baixa estoque e guarda custo histórico.
INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivery_method)
VALUES('smoke_sale_1','SMOKE-001','smoke_customer','Separando','Pago','Pix',120,0,0,120,60,60,datetime('now'),datetime('now'),'Retirada');
INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost)
VALUES('smoke_sale_item_1','smoke_sale_1','smoke_product','smoke_variant',2,60,30);
UPDATE product_variants SET stock=stock-2 WHERE id='smoke_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_mov_sale','smoke_product','smoke_variant','Venda',-2,30,'sale','smoke_sale_1','SMOKE-001',datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_variant')=8 THEN 1 ELSE 0 END;

-- Entrada posterior muda o custo médio; a devolução deve voltar pelo custo histórico de R$ 30.
UPDATE product_variants SET average_cost=((stock*average_cost)+(2*50))/(stock+2),stock=stock+2 WHERE id='smoke_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_mov_later_entry','smoke_product','smoke_variant','Entrada',2,50,'stock_entry','smoke_later_entry','Entrada posterior',datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_variant')-34)<0.001 THEN 1 ELSE 0 END;

INSERT INTO returns(id,number,sale_id,type,refund_amount,credit_amount,returned_value,exchange_value,debt_offset,additional_amount,created_at)
VALUES('smoke_return','SMOKE-TR','smoke_sale_1','Devolução',30,30,60,0,0,0,datetime('now'));
INSERT INTO return_items(id,return_id,sale_item_id,product_id,variant_id,quantity,direction,unit_cost,unit_price)
VALUES('smoke_return_item','smoke_return','smoke_sale_item_1','smoke_product','smoke_variant',1,'Entrada',30,60);
UPDATE sale_items SET returned_quantity=returned_quantity+1 WHERE id='smoke_sale_item_1';
UPDATE product_variants SET average_cost=((stock*average_cost)+(1*30))/(stock+1),stock=stock+1 WHERE id='smoke_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_mov_return','smoke_product','smoke_variant','Devolução',1,30,'return','smoke_return','Devolução smoke',datetime('now'));
INSERT INTO customer_credit_movements(id,customer_id,sale_id,return_id,type,amount,note,created_at)
VALUES('smoke_credit_in','smoke_customer','smoke_sale_1','smoke_return','Crédito',30,'Crédito smoke',datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_variant')=11 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_variant')-(370.0/11.0))<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT returned_quantity FROM sale_items WHERE id='smoke_sale_item_1')=1 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT SUM(amount) FROM customer_credit_movements WHERE customer_id='smoke_customer')=30 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_variant')=(SELECT SUM(quantity) FROM inventory_movements WHERE variant_id='smoke_variant') THEN 1 ELSE 0 END;

-- Novo pedido usa R$ 20 do crédito e gera só R$ 40 a receber.
INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivery_method)
VALUES('smoke_sale_2','SMOKE-002','smoke_customer','Separando','Pendente','Pix',60,0,20,60,30,30,datetime('now'),datetime('now'),'Retirada');
INSERT INTO customer_credit_movements(id,customer_id,sale_id,type,amount,note,created_at)
VALUES('smoke_credit_use','smoke_customer','smoke_sale_2','Uso',-20,'Uso smoke',datetime('now'));
INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at)
VALUES('smoke_receivable','smoke_sale_2','Saldo smoke',40,date('now'),'Pendente',datetime('now'),datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT SUM(amount) FROM customer_credit_movements WHERE customer_id='smoke_customer')=10 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT amount FROM accounts_receivable WHERE id='smoke_receivable')=40 THEN 1 ELSE 0 END;

-- Venda pendente de R$ 100: devolução de R$ 40 deve abater a dívida para R$ 60 sem gerar dinheiro/crédito.
INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivery_method)
VALUES('smoke_sale_3','SMOKE-003','smoke_customer','Separando','Pendente','Pix',100,0,0,100,50,50,datetime('now'),datetime('now'),'Retirada');
INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost)
VALUES('smoke_sale_item_3','smoke_sale_3','smoke_product','smoke_variant',1,40,20);
INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at)
VALUES('smoke_receivable_3_old','smoke_sale_3','Saldo original',100,date('now'),'Cancelado',datetime('now'),datetime('now'));
INSERT INTO returns(id,number,sale_id,type,refund_amount,credit_amount,returned_value,exchange_value,debt_offset,additional_amount,created_at)
VALUES('smoke_return_3','SMOKE-TR3','smoke_sale_3','Devolução',0,0,40,0,40,0,datetime('now'));
INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at)
VALUES('smoke_receivable_3_new','smoke_sale_3','Saldo após SMOKE-TR3',60,date('now'),'Pendente',datetime('now'),datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT amount FROM accounts_receivable WHERE id='smoke_receivable_3_new')=60 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT debt_offset FROM returns WHERE id='smoke_return_3')=40 THEN 1 ELSE 0 END;

-- Compra recebida e estornada retorna exatamente ao estoque/custo anterior e ao razão.
INSERT INTO suppliers(id,name,active,created_at,updated_at) VALUES('smoke_supplier','Fornecedor Smoke',1,datetime('now'),datetime('now'));
INSERT INTO products(id,name,category,status,created_at,updated_at) VALUES('smoke_purchase_product','Produto Compra Smoke','Teste','Ativo',datetime('now'),datetime('now'));
INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_purchase_variant','smoke_purchase_product','Azul','G','SMOKE-PUR-SKU',5,1,20,50,50,55,1,datetime('now'),datetime('now'));
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at)
VALUES('smoke_purchase_initial','smoke_purchase_product','smoke_purchase_variant','Ajuste',5,20,'Estoque inicial',datetime('now'));
INSERT INTO purchases(id,number,supplier_id,purchase_date,status,items_subtotal,freight_cost,other_cost,total_cost,total_units,received_at,created_at,updated_at)
VALUES('smoke_purchase','SMOKE-CMP','smoke_supplier',date('now'),'Recebido',90,0,0,90,3,datetime('now'),datetime('now'),datetime('now'));
INSERT INTO purchase_items(id,purchase_id,product_id,variant_id,quantity,unit_cost)
VALUES('smoke_purchase_item','smoke_purchase','smoke_purchase_product','smoke_purchase_variant',3,30);
UPDATE product_variants SET stock=8,average_cost=23.75 WHERE id='smoke_purchase_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_purchase_move','smoke_purchase_product','smoke_purchase_variant','Entrada',3,30,'purchase','smoke_purchase','SMOKE-CMP',datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_purchase_variant')-23.75)<0.001 THEN 1 ELSE 0 END;
UPDATE product_variants SET stock=5,average_cost=20 WHERE id='smoke_purchase_variant';
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
VALUES('smoke_purchase_reverse','smoke_purchase_product','smoke_purchase_variant','Cancelamento',-3,30,'purchase_reversal','smoke_purchase','Estorno SMOKE-CMP',datetime('now'));
UPDATE purchases SET status='Cancelado',reversed_at=datetime('now'),reversal_reason='Recebimento estornado',updated_at=datetime('now') WHERE id='smoke_purchase';
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_purchase_variant')=5 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN ABS((SELECT average_cost FROM product_variants WHERE id='smoke_purchase_variant')-20)<0.001 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT stock FROM product_variants WHERE id='smoke_purchase_variant')=(SELECT SUM(quantity) FROM inventory_movements WHERE variant_id='smoke_purchase_variant') THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT reversed_at IS NOT NULL FROM purchases WHERE id='smoke_purchase')=1 THEN 1 ELSE 0 END;

-- Produto sem histórico documental pode ser removido por completo sem órfãos.
INSERT INTO products(id,name,category,status,created_at,updated_at) VALUES('smoke_delete_product','Produto Excluir Smoke','Teste','Ativo',datetime('now'),datetime('now'));
INSERT INTO product_variants(id,product_id,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,created_at,updated_at)
VALUES('smoke_delete_variant','smoke_delete_product','SMOKE-DELETE-SKU',2,1,10,20,20,22,1,datetime('now'),datetime('now'));
INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at)
VALUES('smoke_delete_move','smoke_delete_product','smoke_delete_variant','Ajuste',2,10,'Estoque inicial',datetime('now'));
DELETE FROM inventory_movements WHERE product_id='smoke_delete_product';DELETE FROM product_variants WHERE product_id='smoke_delete_product';DELETE FROM products WHERE id='smoke_delete_product';
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT COUNT(*) FROM products WHERE id='smoke_delete_product')=0 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT COUNT(*) FROM product_variants WHERE id='smoke_delete_variant')=0 THEN 1 ELSE 0 END;

-- Capital dos sócios fica separado da movimentação comercial.
INSERT INTO owner_transactions(id,type,amount,transaction_date,notes,created_at) VALUES('smoke_owner_1','Aporte',1000,date('now'),'Aporte smoke',datetime('now'));
INSERT INTO owner_transactions(id,type,amount,transaction_date,notes,created_at) VALUES('smoke_owner_2','Pró-labore',200,date('now'),'Pró-labore smoke',datetime('now'));
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT SUM(CASE WHEN type='Aporte' THEN amount ELSE 0 END) FROM owner_transactions WHERE id LIKE 'smoke_%')=1000 THEN 1 ELSE 0 END;
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT SUM(CASE WHEN type='Pró-labore' THEN amount ELSE 0 END) FROM owner_transactions WHERE id LIKE 'smoke_%')=200 THEN 1 ELSE 0 END;

-- Soft delete tira o pedido do conjunto ativo sem apagar trilha relacional.
UPDATE sales SET deleted_at=datetime('now') WHERE id='smoke_sale_2';
INSERT INTO smoke_assertions_ci SELECT CASE WHEN (SELECT COUNT(*) FROM sales WHERE id='smoke_sale_2' AND deleted_at IS NULL)=0 THEN 1 ELSE 0 END;

DROP TABLE smoke_assertions_ci;
