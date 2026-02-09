/*
  # Promote User to Admin
  
  Updates the profile of 'joaovicrengel@gmail.com' to have the 'admin' role.
  
  ## Query Description:
  1. Updates public.profiles table
  2. Sets role = 'admin' where email matches
  
  ## Metadata:
  - Schema-Category: "Data"
  - Impact-Level: "Low"
  - Reversible: true
*/

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'joaovicrengel@gmail.com';
