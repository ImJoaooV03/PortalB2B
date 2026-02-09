/*
  # Add price_type column to price_table_items
  
  ## Query Description:
  Adds the missing 'price_type' column to the 'price_table_items' table.
  This is required because the frontend explicitly sends this field when creating items.
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true
*/

ALTER TABLE price_table_items 
ADD COLUMN IF NOT EXISTS price_type text DEFAULT 'fixo';
