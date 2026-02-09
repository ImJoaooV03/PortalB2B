-- Enable RLS on order_items just to be safe
ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts and ensure clean slate
DROP POLICY IF EXISTS "Users can view own order items" ON "public"."order_items";
DROP POLICY IF EXISTS "Admins can view all order items" ON "public"."order_items";
DROP POLICY IF EXISTS "Sellers can view portfolio order items" ON "public"."order_items";
DROP POLICY IF EXISTS "Clients can insert order items" ON "public"."order_items";

-- 1. Admins: Can view ALL items
CREATE POLICY "Admins can view all order items"
ON "public"."order_items"
FOR SELECT
USING ( is_admin() );

-- 2. Sellers: Can view items from orders belonging to their clients
CREATE POLICY "Sellers can view portfolio order items"
ON "public"."order_items"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN clients c ON o.client_id = c.id
    WHERE o.id = order_items.order_id
    AND c.vendedor_id = auth.uid()
  )
);

-- 3. Clients: Can view items from their own orders
CREATE POLICY "Clients can view own order items"
ON "public"."order_items"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.client_id = o.client_id
    WHERE o.id = order_items.order_id
    AND p.id = auth.uid()
  )
);

-- 4. Insert Policy (Essential for Checkout)
CREATE POLICY "Clients can insert order items"
ON "public"."order_items"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.client_id = o.client_id
    WHERE o.id = order_items.order_id
    AND p.id = auth.uid()
  )
);
