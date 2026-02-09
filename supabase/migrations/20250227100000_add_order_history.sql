-- Add status_history column to orders table to track timeline
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Comment: This column will store an array of objects: { status: string, updated_at: string }
