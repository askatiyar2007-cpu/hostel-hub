-- ===============================================================
-- Migration: Fix RLS Infinite Recursion (Minimal & Clean)
-- Target Project: HostelHub
-- Date: 2026-07-23
-- Description:
-- Resolves the "infinite recursion detected in policy for relation students" error
-- by replacing recursive EXISTS/JOIN expressions with SECURITY DEFINER helper functions.
-- All other RLS policies are restored to their original definitions.
-- ===============================================================

-- ===============================================================
-- 1️⃣ DROP INVASIVE HELPER FUNCTIONS AND POLICIES FIRST
-- ===============================================================

-- Drop helper functions from the previous invasive migration
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_profile_id_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_id_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_id_for_profile(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_user_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_room_hostel_owner(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_bed_hostel_owner(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_fee_hostel_owner(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_student_read_payment_method(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_active_allocation_for_notices(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_hostel_owner(UUID, UUID) CASCADE;

-- Drop combined/invasive policies created by the previous migration
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Students select policy" ON public.students;
DROP POLICY IF EXISTS "Students manage policy" ON public.students;
DROP POLICY IF EXISTS "Room requests select policy" ON public.room_requests;
DROP POLICY IF EXISTS "Owners can read/write bills for their hostels" ON public.bills;
DROP POLICY IF EXISTS "Students can insert own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Owners can update complaints for their hostels" ON public.complaints;
DROP POLICY IF EXISTS "Owners can read/write notices for their hostels" ON public.notices;

-- Drop the original policies of the recursive tables to recreate them clean
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners view resident profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students view own record" ON public.students;
DROP POLICY IF EXISTS "Owners view hostel students" ON public.students;
DROP POLICY IF EXISTS "Owners view student records" ON public.students;
DROP POLICY IF EXISTS "View allocations" ON public.room_allocations;
DROP POLICY IF EXISTS "Owners manage allocations" ON public.room_allocations;
DROP POLICY IF EXISTS "Students can insert own requests" ON public.room_requests;
DROP POLICY IF EXISTS "Students can read own requests" ON public.room_requests;
DROP POLICY IF EXISTS "Owners can read hostel requests" ON public.room_requests;
DROP POLICY IF EXISTS "Owners can update hostel requests" ON public.room_requests;

-- Drop original policies of other tables to restore them cleanly
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Approved hostels public" ON public.hostels;
DROP POLICY IF EXISTS "Owners manage own hostels" ON public.hostels;
DROP POLICY IF EXISTS "Rooms public read" ON public.rooms;
DROP POLICY IF EXISTS "Owners manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Beds public read" ON public.beds;
DROP POLICY IF EXISTS "Owners manage beds" ON public.beds;
DROP POLICY IF EXISTS "Bills visibility" ON public.bills;
DROP POLICY IF EXISTS "Complaint visibility" ON public.complaints;
DROP POLICY IF EXISTS "View notices" ON public.notices;
DROP POLICY IF EXISTS "Students can read their own fees" ON public.student_fees;
DROP POLICY IF EXISTS "Owners can read/write fees for their hostels" ON public.student_fees;
DROP POLICY IF EXISTS "Students can read/write their own payments" ON public.payments;
DROP POLICY IF EXISTS "Owners can read/write payments for their hostels" ON public.payments;
DROP POLICY IF EXISTS "Owners manage their own payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Students can read hostel owner payment methods" ON public.payment_methods;

-- ===============================================================
-- 2️⃣ CREATE RECURSION-BREAKING SECURITY DEFINER HELPERS
-- ===============================================================

-- Helper to check if a profile belongs to a user (bypasses profiles RLS)
CREATE OR REPLACE FUNCTION public.is_user_profile(p_user_id UUID, p_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = p_user_id
  );
$$;

-- Helper to check if user is the hostel owner for a profile (bypasses profiles, students, allocations, requests RLS)
CREATE OR REPLACE FUNCTION public.is_hostel_owner_for_profile(p_owner_id UUID, p_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.room_allocations ra ON ra.student_id = s.id
    JOIN public.hostels h ON h.id = ra.hostel_id
    WHERE s.profile_id = p_profile_id AND h.owner_id = p_owner_id
  ) OR EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.room_requests rr ON rr.student_id = s.id
    JOIN public.hostels h ON h.id = rr.hostel_id
    WHERE s.profile_id = p_profile_id AND h.owner_id = p_owner_id
  );
$$;

-- Helper to check if user is the hostel owner for a student (bypasses students, allocations, requests RLS)
CREATE OR REPLACE FUNCTION public.is_hostel_owner_for_student(p_owner_id UUID, p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_allocations ra
    JOIN public.hostels h ON h.id = ra.hostel_id
    WHERE ra.student_id = p_student_id AND h.owner_id = p_owner_id
  ) OR EXISTS (
    SELECT 1 FROM public.room_requests rr
    JOIN public.hostels h ON h.id = rr.hostel_id
    WHERE rr.student_id = p_student_id AND h.owner_id = p_owner_id
  );
$$;

-- Helper to check if a user corresponds to a student record (bypasses students, profiles RLS)
CREATE OR REPLACE FUNCTION public.is_student_user(p_user_id UUID, p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.profiles p ON s.profile_id = p.id
    WHERE s.id = p_student_id AND p.user_id = p_user_id
  );
$$;

-- Helper to check parent-student link status (bypasses parent_links, profiles, students RLS)
CREATE OR REPLACE FUNCTION public.is_parent_of_student(p_parent_id UUID, p_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_links pl
    JOIN public.profiles p ON pl.student_id = p.user_id
    JOIN public.students s ON s.profile_id = p.id
    WHERE pl.parent_id = p_parent_id AND s.id = p_student_id
  );
$$;

-- Revoke public execution of these helper functions
REVOKE EXECUTE ON FUNCTION public.is_user_profile(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hostel_owner_for_profile(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_hostel_owner_for_student(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_student_user(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of_student(UUID, UUID) FROM PUBLIC, anon;

-- Grant execution to authenticated & service_role
GRANT EXECUTE ON FUNCTION public.is_user_profile(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_hostel_owner_for_profile(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_hostel_owner_for_student(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_student_user(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_of_student(UUID, UUID) TO authenticated, service_role;


-- ===============================================================
-- 3️⃣ RECREATE THE 4 RECURSIVE TABLES' SELECT & INSERT POLICIES
-- ===============================================================

-- 1. profiles SELECT policies
CREATE POLICY "Users view own profile" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners view resident profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_hostel_owner_for_profile(auth.uid(), id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 2. students SELECT policies
CREATE POLICY "Students view own record" ON public.students 
  FOR SELECT TO authenticated 
  USING (
    public.is_user_profile(auth.uid(), profile_id) 
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Owners view student records" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_user_profile(auth.uid(), profile_id)
    OR public.is_hostel_owner_for_student(auth.uid(), id)
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 3. room_allocations SELECT & WRITE policies
CREATE POLICY "View allocations" ON public.room_allocations 
  FOR SELECT TO authenticated 
  USING (
    public.is_student_user(auth.uid(), student_id)
    OR public.is_parent_of_student(auth.uid(), student_id)
    OR EXISTS (
      SELECT 1 FROM public.hostels h 
      WHERE h.id = hostel_id AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Owners manage allocations" ON public.room_allocations
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h 
      WHERE h.id = hostel_id AND h.owner_id = auth.uid()
    )
  );

-- 4. room_requests INSERT, SELECT & UPDATE policies
CREATE POLICY "Students can insert own requests" ON public.room_requests 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_student_user(auth.uid(), student_id));

CREATE POLICY "Students can read own requests" ON public.room_requests 
  FOR SELECT TO authenticated 
  USING (public.is_student_user(auth.uid(), student_id));

CREATE POLICY "Owners can read hostel requests" ON public.room_requests 
  FOR SELECT TO authenticated 
  USING (
    hostel_id IN (
      SELECT id FROM public.hostels WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update hostel requests" ON public.room_requests 
  FOR UPDATE TO authenticated 
  USING (
    hostel_id IN (
      SELECT id FROM public.hostels WHERE owner_id = auth.uid()
    )
  );


-- ===============================================================
-- 4️⃣ RESTORE ALL UNRELATED WORKING POLICIES FOR OTHER TABLES
-- ===============================================================

-- 1. user_roles
CREATE POLICY "Users view own roles" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

-- 2. hostels
CREATE POLICY "Approved hostels public" ON public.hostels 
  FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners manage own hostels" ON public.hostels 
  FOR ALL TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

-- 3. rooms
CREATE POLICY "Rooms public read" ON public.rooms 
  FOR SELECT USING (true);

CREATE POLICY "Owners manage rooms" ON public.rooms 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 4. beds
CREATE POLICY "Beds public read" ON public.beds 
  FOR SELECT USING (true);

CREATE POLICY "Owners manage beds" ON public.beds 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.rooms r JOIN public.hostels h ON h.id = r.hostel_id WHERE r.id = room_id AND h.owner_id = auth.uid()) 
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 5. bills
CREATE POLICY "Bills visibility" ON public.bills 
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR public.is_parent_of(auth.uid(), student_id)
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 6. complaints
CREATE POLICY "Complaint visibility" ON public.complaints 
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
    OR public.is_parent_of(auth.uid(), student_id)
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 7. notices
CREATE POLICY "View notices" ON public.notices 
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.room_allocations ra WHERE ra.hostel_id = notices.hostel_id AND ra.student_id = auth.uid() AND ra.active = true)
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 8. student_fees
CREATE POLICY "Students can read their own fees" ON public.student_fees
  FOR SELECT TO authenticated USING (
    student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
  );

CREATE POLICY "Owners can read/write fees for their hostels" ON public.student_fees
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = hostel_id AND h.owner_id = auth.uid()
    )
  );

-- 9. payments
CREATE POLICY "Students can read/write their own payments" ON public.payments
  FOR ALL TO authenticated USING (
    student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
  );

CREATE POLICY "Owners can read/write payments for their hostels" ON public.payments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.student_fees sf
      JOIN public.hostels h ON h.id = sf.hostel_id
      WHERE sf.id = fee_id AND h.owner_id = auth.uid()
    )
  );

-- 10. payment_methods
CREATE POLICY "Owners manage their own payment methods" ON public.payment_methods
  FOR ALL TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Students can read hostel owner payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE ra.student_id = (SELECT id FROM public.students WHERE profile_id = auth.uid())
      AND h.owner_id = owner_id
    )
  );

-- ===============================================================
-- 5️⃣ SCHEMA CACHE RELOAD
-- ===============================================================
NOTIFY pgrst, 'reload schema';
