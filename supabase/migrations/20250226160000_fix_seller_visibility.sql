-- 1. Create a secure function to check seller status (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_seller()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'vendedor'
  );
$$;

-- 2. Allow Sellers to view profiles that have the role 'cliente'
CREATE POLICY "Sellers can view client profiles"
ON profiles FOR SELECT
USING (
  is_seller() 
  AND 
  role = 'cliente'
);

-- 3. Allow Sellers to update profiles that are clients (e.g. fix typos)
CREATE POLICY "Sellers can update client profiles"
ON profiles FOR UPDATE
USING (
  is_seller() 
  AND 
  role = 'cliente'
);
