-- 1. Create helper functions as SECURITY DEFINER to bypass RLS recursion loops

CREATE OR REPLACE FUNCTION public.is_super_admin(usr_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = usr_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_profile_id_for_user(usr_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = usr_id;
$$;

CREATE OR REPLACE FUNCTION public.get_student_id_for_user(usr_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM public.students s
  JOIN public.profiles p ON s.profile_id = p.id
  WHERE p.user_id = usr_id;
$$;

CREATE OR REPLACE FUNCTION public.get_student_id_for_profile(prof_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.students WHERE profile_id = prof_id;
$$;

CREATE OR REPLACE FUNCTION public.get_student_user_id(student_uuid UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id FROM public.profiles p
  JOIN public.students s ON s.profile_id = p.id
  WHERE s.id = student_uuid;
$$;

-- 2. Drop broken policies and recreate them correctly

-- User Roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
  );

-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners view resident profiles" ON public.profiles;

CREATE POLICY "Profiles select policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = public.get_student_id_for_profile(public.profiles.id)
      AND h.owner_id = auth.uid()
      AND ra.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.room_requests rr
      JOIN public.hostels h ON h.id = rr.hostel_id
      WHERE rr.student_id = public.get_student_id_for_profile(public.profiles.id)
      AND h.owner_id = auth.uid()
      AND rr.status = 'pending'
    )
  );

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

-- Students
DROP POLICY IF EXISTS "Students view own record" ON public.students;
DROP POLICY IF EXISTS "Owners view hostel students" ON public.students;
DROP POLICY IF EXISTS "Owners view student records" ON public.students;

CREATE POLICY "Students select policy" ON public.students
  FOR SELECT TO authenticated
  USING (
    profile_id = public.get_profile_id_for_user(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = public.students.id
      AND h.owner_id = auth.uid()
      AND ra.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.room_requests rr
      JOIN public.hostels h ON h.id = rr.hostel_id
      WHERE rr.student_id = public.students.id
      AND h.owner_id = auth.uid()
      AND rr.status = 'pending'
    )
  );

DROP POLICY IF EXISTS "Students manage policy" ON public.students;
CREATE POLICY "Students manage policy" ON public.students
  FOR ALL TO authenticated
  USING (profile_id = public.get_profile_id_for_user(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (profile_id = public.get_profile_id_for_user(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Hostels
DROP POLICY IF EXISTS "Approved hostels public" ON public.hostels;
CREATE POLICY "Approved hostels public" ON public.hostels
  FOR SELECT USING (
    status = 'approved'
    OR auth.uid() = owner_id
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners manage own hostels" ON public.hostels;
CREATE POLICY "Owners manage own hostels" ON public.hostels
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_super_admin(auth.uid())
  );

-- Rooms
DROP POLICY IF EXISTS "Owners manage rooms" ON public.rooms;
CREATE POLICY "Owners manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Beds
DROP POLICY IF EXISTS "Owners manage beds" ON public.beds;
CREATE POLICY "Owners manage beds" ON public.beds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      JOIN public.hostels h ON h.id = r.hostel_id
      WHERE r.id = room_id AND h.owner_id = auth.uid()
    )
    OR public.is_super_admin(auth.uid())
  );

-- Room Requests
DROP POLICY IF EXISTS "Students can insert own requests" ON public.room_requests;
CREATE POLICY "Students can insert own requests" ON public.room_requests
  FOR INSERT TO authenticated
  WITH CHECK (student_id = public.get_student_id_for_user(auth.uid()));

DROP POLICY IF EXISTS "Students can read own requests" ON public.room_requests;
DROP POLICY IF EXISTS "Owners can read hostel requests" ON public.room_requests;
DROP POLICY IF EXISTS "Room requests select policy" ON public.room_requests;

CREATE POLICY "Room requests select policy" ON public.room_requests
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_student_id_for_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners can update hostel requests" ON public.room_requests;
CREATE POLICY "Owners can update hostel requests" ON public.room_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Room Allocations
DROP POLICY IF EXISTS "View allocations" ON public.room_allocations;
CREATE POLICY "View allocations" ON public.room_allocations
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_student_id_for_user(auth.uid())
    OR public.is_parent_of(auth.uid(), public.get_student_user_id(student_id))
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners manage allocations" ON public.room_allocations;
CREATE POLICY "Owners manage allocations" ON public.room_allocations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Bills
DROP POLICY IF EXISTS "Bills visibility" ON public.bills;
CREATE POLICY "Bills visibility" ON public.bills
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_parent_of(auth.uid(), student_id)
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Complaints
DROP POLICY IF EXISTS "Complaint visibility" ON public.complaints;
CREATE POLICY "Complaint visibility" ON public.complaints
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_parent_of(auth.uid(), student_id)
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Notices
DROP POLICY IF EXISTS "View notices" ON public.notices;
CREATE POLICY "View notices" ON public.notices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      WHERE ra.hostel_id = notices.hostel_id
      AND ra.student_id = public.get_student_id_for_user(auth.uid())
      AND ra.active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id
      AND h.owner_id = auth.uid()
    )
    OR public.is_super_admin(auth.uid())
  );

-- Student Fees
DROP POLICY IF EXISTS "Students can read their own fees" ON public.student_fees;
CREATE POLICY "Students can read their own fees" ON public.student_fees
  FOR SELECT TO authenticated
  USING (
    student_id = public.get_student_id_for_user(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners can read/write fees for their hostels" ON public.student_fees;
CREATE POLICY "Owners can read/write fees for their hostels" ON public.student_fees
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Payments
DROP POLICY IF EXISTS "Students can read/write their own payments" ON public.payments;
CREATE POLICY "Students can read/write their own payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    student_id = public.get_student_id_for_user(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owners can read/write payments for their hostels" ON public.payments;
CREATE POLICY "Owners can read/write payments for their hostels" ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.student_fees sf JOIN public.hostels h ON h.id = sf.hostel_id WHERE sf.id = fee_id AND h.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Payment Methods
DROP POLICY IF EXISTS "Students can read hostel owner payment methods" ON public.payment_methods;
CREATE POLICY "Students can read hostel owner payment methods" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = public.get_student_id_for_user(auth.uid())
      AND h.owner_id = owner_id
      AND ra.active = true
    )
    OR public.is_super_admin(auth.uid())
  );

-- Cache Refresh
NOTIFY pgrst, 'reload schema';
