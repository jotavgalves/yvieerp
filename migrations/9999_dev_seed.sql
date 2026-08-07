-- Somente para desenvolvimento local. Não aplique este arquivo em produção.
INSERT OR IGNORE INTO customers (id,name,phone,instagram,city,tags) VALUES
('cus_demo_1','Layssa Andrade','81999881122','@layssa.a','Recife','["VIP"]'),
('cus_demo_2','Roselita Gomes','81988772211','@roselitinha','Olinda','["Recorrente"]');

INSERT OR IGNORE INTO products (id,name,category,collection,status) VALUES
('prd_demo_1','Blusa Aura','Blusas','Essentials','Ativo'),
('prd_demo_2','Macacão Lux','Macacões','Noir','Ativo');

INSERT OR IGNORE INTO product_variants (id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price) VALUES
('var_demo_1','prd_demo_1','Preto','P','AURA-PT-P',6,2,42.50,89.90),
('var_demo_2','prd_demo_1','Preto','M','AURA-PT-M',2,2,42.50,89.90),
('var_demo_3','prd_demo_1','Vinho','G','AURA-VI-G',1,2,44.00,94.90),
('var_demo_4','prd_demo_2','Vinho','M','LUX-VI-M',4,1,96.00,179.90);
