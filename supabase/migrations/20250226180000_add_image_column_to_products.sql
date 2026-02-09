/*
  # Add Image Column to Products

  ## Query Description:
  This migration adds the missing 'image' column to the products table.
  This is required to store the public URL of product images uploaded to Supabase Storage.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Table: products
  - Column: image (text, nullable)
*/

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image text;
