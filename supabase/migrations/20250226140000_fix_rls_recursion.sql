/*
  # Fix RLS Infinite Recursion on Profiles Table

  ## Query Description:
  This migration resolves a critical "infinite recursion" error in Row Level Security policies.
  It replaces direct table queries in policies with a SECURITY DEFINER function to safely check admin status without triggering policy loops.

  ## Metadata:
  - Schema-Category: "Security"
  - Impact-Level: "High" (Fixes database crash on profile access)
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Creates function public.is_admin()
  - Drops existing policies on public.profiles
  - Recreates policies using the new safe function
*/

-- 1. Create a secure function to check admin status
-- SECURITY DEFINER allows this function to bypass RLS, breaking the recursion loop
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. Clean up existing policies on 'profiles' to remove the recursive one
-- We drop all policies on 'profiles' to ensure a clean slate and remove the buggy one
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname); 
    END LOOP; 
END $$;

-- 3. Re-create policies using the safe is_admin() function

-- Allow users to view/edit their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING ( auth.uid() = id );

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING ( auth.uid() = id );

CREATE POLICY "Users can insert own profile" 
ON profiles FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- Allow Admins to view/edit ALL profiles (using the safe function)
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING ( is_admin() );

CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE 
USING ( is_admin() );

CREATE POLICY "Admins can delete profiles" 
ON profiles FOR DELETE 
USING ( is_admin() );
