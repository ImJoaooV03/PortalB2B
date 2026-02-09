/*
  # Add min_order column to price_tables

  ## Query Description:
  Adds the 'min_order' column to the 'price_tables' table to store the minimum order value required for a specific price table.
  This fixes the "Could not find the 'min_order' column" error when creating new price tables.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Table: price_tables
  - Column: min_order (numeric, default 0)

  ## Security Implications:
  - None. Existing RLS policies cover the table.
*/

ALTER TABLE price_tables 
ADD COLUMN IF NOT EXISTS min_order numeric DEFAULT 0;
