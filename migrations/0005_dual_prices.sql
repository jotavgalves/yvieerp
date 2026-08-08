ALTER TABLE product_variants ADD COLUMN cash_price REAL NOT NULL DEFAULT 0 CHECK (cash_price >= 0);
ALTER TABLE product_variants ADD COLUMN card_price REAL NOT NULL DEFAULT 0 CHECK (card_price >= 0);

UPDATE product_variants
SET cash_price = sale_price,
    card_price = sale_price
WHERE cash_price = 0 AND card_price = 0;
