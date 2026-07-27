-- Add student snapshot columns to room_requests table
ALTER TABLE public.room_requests
ADD COLUMN IF NOT EXISTS student_name TEXT,
ADD COLUMN IF NOT EXISTS student_email TEXT,
ADD COLUMN IF NOT EXISTS student_phone TEXT;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
