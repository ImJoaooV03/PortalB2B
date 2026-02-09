-- Adiciona a coluna total_amount na tabela orders para corresponder ao frontend
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;

-- Opcional: Se existir uma coluna antiga com outro nome (ex: valor_total), você pode migrar os dados:
-- UPDATE orders SET total_amount = valor_total WHERE total_amount = 0 AND valor_total IS NOT NULL;
