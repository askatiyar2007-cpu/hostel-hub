-- Migration: Fix Student Announcements Notices RLS Policy - Correct Profiles Relationship
-- Date: 2026-09-06
-- Purpose: Fix notices RLS policy to correctly resolve students.id from auth.uid() through profiles
--
-- Root Cause:
-- The previous migration 20260905000000_fix_student_announcements_notices_rls.sql had an incorrect
-- relationship. It used:
-- SELECT id FROM public.students WHERE profile_id = auth.uid()
--
-- This is incorrect because:
-- - auth.uid() returns auth.users.id
-- - students.profile_id references profiles.id (NOT auth.users.id)
-- - The correct path is: auth.users.id → profiles.user_id → profiles.id → students.profile_id → students.id
--
-- Fix:
-- Update the "View notices" RLS policy to correctly resolve students.id from auth.uid()
-- using the profiles table relationship:
-- SELECT id FROM public.students WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())

BEGIN;

-- Drop and recreate the notices RLS policy with the correct student_id resolution
DROP POLICY IF EXISTS "View notices" ON public.notices;

CREATE POLICY "View notices" ON public.notices
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      WHERE ra.hostel_id = notices.hostel_id
        AND ra.student_id IN (
          SELECT id FROM public.students WHERE profile_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()
          )
        )
        AND ra.active = true
    )
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
