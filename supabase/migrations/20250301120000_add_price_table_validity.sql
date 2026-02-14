/*
  # Add Validity Period to Price Tables
  
  1. New Columns:
    - `valid_from` (timestamptz): Start date/time for the table availability
    - `valid_until` (timestamptz): End date/time for the table availability
    
  2. Purpose:
    - Allows scheduling price tables (e.g., "Black Friday" or "2026 Pricing")
    - The Catalog will filter tables based on these dates.
*/

ALTER TABLE price_tables 
ADD COLUMN IF NOT EXISTS valid_from timestamptz,
ADD COLUMN IF NOT EXISTS valid_until timestamptz;
