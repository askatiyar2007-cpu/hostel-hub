-- Create booking_type custom enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type') THEN
        CREATE TYPE public.booking_type AS ENUM ('shared_bed', 'entire_room');
    END IF;
END$$;

-- Add booking_type column to room_requests table
ALTER TABLE public.room_requests
ADD COLUMN IF NOT EXISTS booking_type public.booking_type NOT NULL DEFAULT 'shared_bed';
