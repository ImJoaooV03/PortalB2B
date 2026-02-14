-- Atualiza a restrição de verificação de status para garantir que 'entregue' seja permitido
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'faturado', 'entregue', 'cancelado'));
