-- Room Requests table
CREATE TABLE IF NOT EXISTS public.room_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text NOT NULL,
  address text NOT NULL,
  emergency_contact text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  student_name text,
  student_email text,
  student_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert own requests"
  ON public.room_requests FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM public.students WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Students can read own requests"
  ON public.room_requests FOR SELECT
  USING (student_id IN (
    SELECT id FROM public.students WHERE profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Owners can read hostel requests"
  ON public.room_requests FOR SELECT
  USING (hostel_id IN (
    SELECT id FROM public.hostels WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Owners can update hostel requests"
  ON public.room_requests FOR UPDATE
  USING (hostel_id IN (
    SELECT id FROM public.hostels WHERE owner_id = auth.uid()
  ));
