-- Create email_verifications table if not exists
CREATE TABLE IF NOT EXISTS public.email_verifications (
  email text PRIMARY KEY,
  otp text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);

-- Enable RLS for email_verifications
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Policies for email_verifications
DROP POLICY IF EXISTS "Allow public management of email verifications" ON public.email_verifications;
CREATE POLICY "Allow public management of email verifications" 
  ON public.email_verifications FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Ensure rooms table has the new fields: type and occupied_count
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS occupied_count integer DEFAULT 0;

-- Sync existing columns
UPDATE public.rooms SET type = room_type::text WHERE type IS NULL;
UPDATE public.rooms SET occupied_count = COALESCE(occupancy, 0) WHERE occupied_count = 0;

-- Grants
GRANT ALL ON public.email_verifications TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
