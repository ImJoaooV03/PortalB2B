-- Add payment_terms and notes columns to price_tables
ALTER TABLE price_tables 
ADD COLUMN IF NOT EXISTS payment_terms text,
ADD COLUMN IF NOT EXISTS notes text;
