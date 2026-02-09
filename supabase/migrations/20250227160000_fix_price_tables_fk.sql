-- Fix Foreign Key relationship for Price Tables to allow joining with Profiles
DO $$ 
BEGIN
  -- 1. Ensure column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_tables' AND column_name = 'vendedor_id') THEN
    ALTER TABLE price_tables ADD COLUMN vendedor_id UUID;
  END IF;

  -- 2. Drop existing constraint if it exists (to ensure we have the correct one)
  BEGIN
    ALTER TABLE price_tables DROP CONSTRAINT IF EXISTS price_tables_vendedor_id_fkey;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  -- 3. Add correct constraint pointing to public.profiles
  -- This enables PostgREST to resolve: select('..., profiles:vendedor_id(full_name)')
  ALTER TABLE price_tables
  ADD CONSTRAINT price_tables_vendedor_id_fkey
  FOREIGN KEY (vendedor_id)
  REFERENCES public.profiles(id);

END $$;
