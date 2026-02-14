-- Add base_price column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0;
