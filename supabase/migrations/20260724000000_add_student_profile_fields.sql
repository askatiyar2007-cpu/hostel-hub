-- 1. Add demographic columns to profiles and students tables
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS college TEXT,
ADD COLUMN IF NOT EXISTS course TEXT,
ADD COLUMN IF NOT EXISTS year TEXT;

-- 2. Allow hostel owners to view profiles of students who are resident in or requested their hostels
DROP POLICY IF EXISTS "Owners view resident profiles" ON public.profiles;
CREATE POLICY "Owners view resident profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.room_allocations ra ON ra.student_id = s.id
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE s.profile_id = public.profiles.id AND h.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.room_requests rr ON rr.student_id = s.id
      JOIN public.hostels h ON h.id = rr.hostel_id
      WHERE s.profile_id = public.profiles.id AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 3. Allow hostel owners to view student records of their residents or requestors
DROP POLICY IF EXISTS "Owners view student records" ON public.students;
CREATE POLICY "Owners view student records" ON public.students
  FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = public.students.id AND h.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.room_requests rr
      JOIN public.hostels h ON h.id = rr.hostel_id
      WHERE rr.student_id = public.students.id AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 4. CACHE REFRESH
NOTIFY pgrst, 'reload schema';
