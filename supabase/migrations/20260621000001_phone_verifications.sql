-- Create phone_verifications table if not exists
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  phone text PRIMARY KEY,
  otp text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);

-- Enable RLS for phone_verifications
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Policies for phone_verifications (ALLOW ALL OPERATIONS FOR DEVELOPMENT ONLY)
DROP POLICY IF EXISTS "Allow public management of phone verifications" ON public.phone_verifications;
CREATE POLICY "Allow public management of phone verifications" 
  ON public.phone_verifications FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Grants
GRANT ALL ON public.phone_verifications TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
