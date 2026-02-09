-- Migration to fix the handle_new_user trigger function
-- Makes it robust against duplicate keys and invalid metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    -- Fallback to email part if full_name is missing
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    -- Safe cast for role, defaulting to 'cliente' if missing or invalid
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'cliente'::user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
    
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error details to Postgres logs for debugging
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  -- Re-raise a user-friendly error
  RAISE EXCEPTION 'Erro interno ao criar perfil de usuário. Por favor, tente novamente.';
END;
$$;

-- Ensure the trigger is correctly attached (re-creating just to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
