-- Adiciona os valores 'entregue' e 'cancelado' ao tipo ENUM order_status
-- O erro 22P02 ocorre porque o banco não reconhece esses textos como válidos para o tipo.

-- Nota: 'IF NOT EXISTS' evita erros se o valor já tiver sido adicionado manualmente.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'entregue';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelado';
