/*
  # Initial Schema for B2B Order Management System
  
  ## Query Description:
  Este script configura a estrutura inicial do banco de dados, incluindo tabelas, enums, relacionamentos e políticas de segurança (RLS).
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "High"
  - Requires-Backup: false
  - Reversible: false
  
  ## Structure Details:
  1. Enums: user_role, order_status, price_type
  2. Tables: profiles, clients, products, price_tables, price_table_items, orders, order_items, audit_logs
  3. Security: RLS enabled on all tables with specific policies for Admin, Vendedor, and Cliente
  4. Automation: Triggers for updated_at, profile creation, and single active price table constraint
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'vendedor', 'cliente');
CREATE TYPE order_status AS ENUM ('rascunho', 'enviado', 'aprovado', 'faturado', 'cancelado');
CREATE TYPE price_type AS ENUM ('base', 'desconto', 'fixo');

-- 2. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. CLIENTS (Empresas/Compradores)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT,
  vendedor_id UUID REFERENCES public.profiles(id), -- Quem atende este cliente
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Link Profile to Client (For user type 'cliente')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  attributes JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'ativo', -- ativo, inativo
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. PRICE TABLES
CREATE TABLE IF NOT EXISTS public.price_tables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  vendedor_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: Only one active price table per client
CREATE UNIQUE INDEX IF NOT EXISTS one_active_table_per_client 
ON public.price_tables (client_id) 
WHERE active = true;

ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;

-- 6. PRICE TABLE ITEMS
CREATE TABLE IF NOT EXISTS public.price_table_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  price_table_id UUID REFERENCES public.price_tables(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  type_price price_type DEFAULT 'fixo',
  value DECIMAL(10,2) NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(price_table_id, product_id)
);

ALTER TABLE public.price_table_items ENABLE ROW LEVEL SECURITY;

-- 7. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  vendedor_id UUID REFERENCES public.profiles(id), -- Snapshot of who was the seller at the time
  user_id UUID REFERENCES public.profiles(id), -- Who placed the order
  status order_status DEFAULT 'rascunho',
  total_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 8. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES -------------------------------------------------------

-- PROFILES
-- Admin sees all, Users see themselves
CREATE POLICY "Admin sees all profiles" ON public.profiles FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT USING (
  auth.uid() = id
);

-- CLIENTS
-- Admin sees all. Vendedor sees assigned clients. Cliente sees own company.
CREATE POLICY "Admin sees all clients" ON public.clients FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
CREATE POLICY "Vendedor sees assigned clients" ON public.clients FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'vendedor' and vendedor_id = auth.uid())
);
CREATE POLICY "Cliente sees own company" ON public.clients FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'cliente' and client_id = public.clients.id)
);

-- PRODUCTS
-- Admin/Vendedor manage products. Cliente sees products only via Price Table logic (handled in app or specific view, but base table access needed for joins)
-- Simplification: Cliente can read products, but UI filters by Price Table. 
-- Strict: Cliente can only read products that exist in an active price table for their client_id.
CREATE POLICY "Admin/Vendedor manage products" ON public.products FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'vendedor'))
);
CREATE POLICY "Cliente reads active products" ON public.products FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'cliente')
  -- In a real strict scenario, we would join with price_tables, but for performance we often allow reading the product catalog table and filter prices in the query.
);

-- PRICE TABLES
-- Admin sees all. Vendedor sees tables for their clients. Cliente sees ACTIVE table for their company.
CREATE POLICY "Admin sees all price tables" ON public.price_tables FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
CREATE POLICY "Vendedor manages own client tables" ON public.price_tables FOR ALL USING (
  exists (select 1 from public.profiles p 
          join public.clients c on c.vendedor_id = p.id 
          where p.id = auth.uid() and p.role = 'vendedor' and c.id = public.price_tables.client_id)
);
CREATE POLICY "Cliente sees active table" ON public.price_tables FOR SELECT USING (
  active = true AND
  exists (select 1 from public.profiles where id = auth.uid() and role = 'cliente' and client_id = public.price_tables.client_id)
);

-- PRICE TABLE ITEMS
-- Inherits access from Price Table essentially
CREATE POLICY "Admin/Vendedor manage items" ON public.price_table_items FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role IN ('admin', 'vendedor'))
);
CREATE POLICY "Cliente sees items from active table" ON public.price_table_items FOR SELECT USING (
  exists (
    select 1 from public.price_tables pt
    join public.profiles p on p.client_id = pt.client_id
    where pt.id = public.price_table_items.price_table_id
    and pt.active = true
    and p.id = auth.uid()
  )
);

-- ORDERS
-- Admin sees all. Vendedor sees orders from their clients. Cliente sees own orders.
CREATE POLICY "Admin sees all orders" ON public.orders FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
CREATE POLICY "Vendedor sees own client orders" ON public.orders FOR ALL USING (
  vendedor_id = auth.uid()
);
CREATE POLICY "Cliente manages own orders" ON public.orders FOR ALL USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'cliente' and client_id = public.orders.client_id)
);

-- ORDER ITEMS
CREATE POLICY "Order items access" ON public.order_items FOR ALL USING (
  exists (select 1 from public.orders o where o.id = public.order_items.order_id) -- Relies on RLS of orders table? No, RLS is row-by-row.
  -- Better to duplicate logic or join:
  AND (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') OR
    exists (select 1 from public.orders o where o.id = public.order_items.order_id and o.vendedor_id = auth.uid()) OR
    exists (select 1 from public.orders o join public.profiles p on p.client_id = o.client_id where o.id = public.order_items.order_id and p.id = auth.uid())
  )
);

-- AUDIT LOGS
CREATE POLICY "Admin sees logs" ON public.audit_logs FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
CREATE POLICY "System insert logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- TRIGGERS & FUNCTIONS -----------------------------------------------

-- 1. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'cliente')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_clients_modtime BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_price_tables_modtime BEFORE UPDATE ON public.price_tables FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
