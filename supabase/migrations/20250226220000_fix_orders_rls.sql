-- Adiciona política para permitir que Vendedores vejam pedidos de seus clientes
-- A lógica é: Permitir SELECT na tabela 'orders' SE o 'client_id' do pedido
-- pertencer a um cliente cujo 'vendedor_id' é igual ao ID do usuário logado.

CREATE POLICY "Vendedores podem ver pedidos de seus clientes"
ON orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = orders.client_id
    AND clients.vendedor_id = auth.uid()
  )
);

-- Garante que Vendedores também possam atualizar status desses pedidos (se necessário)
CREATE POLICY "Vendedores podem atualizar pedidos de seus clientes"
ON orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = orders.client_id
    AND clients.vendedor_id = auth.uid()
  )
);
