-- Migration: Add admission_date column to students table
-- Target: public
-- Reason: Manual student assignment RPC requires admission_date column

-- Add admission_date column if it doesn't exist
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS admission_date DATE;

-- Set default value for existing null records to current date
UPDATE public.students 
SET admission_date = CURRENT_DATE 
WHERE admission_date IS NULL;

-- Add a default constraint for future inserts
ALTER TABLE public.students 
ALTER COLUMN admission_date SET DEFAULT CURRENT_DATE;

-- Grant necessary permissions (if needed)
-- Note: RLS policies should already handle access control
