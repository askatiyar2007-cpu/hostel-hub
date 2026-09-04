-- Migration: Fix Student Announcements Notices RLS Policy
-- Date: 2026-09-05
-- Purpose: Fix notices RLS policy to work with room_allocations.student_id → students(id) relationship
--
-- Root Cause:
-- Migration 20260701000001_booking_system_upgrades.sql changed room_allocations.student_id
-- to reference students(id) instead of auth.users(id). However, the notices RLS policy
-- in 20260726000000_fix_recursive_rls_final.sql was not updated and still checks
-- ra.student_id = auth.uid(), which is now incorrect.
--
-- This causes the RLS policy to fail for students because:
-- - room_allocations.student_id is students.id (not auth.users.id)
-- - auth.uid() returns auth.users.id
-- - The comparison ra.student_id = auth.uid() will never match for students
--
-- Fix:
-- Update the "View notices" RLS policy to correctly resolve students.id from auth.uid()
-- using the students table relationship.

BEGIN;

-- Drop and recreate the notices RLS policy with the correct student_id resolution
DROP POLICY IF EXISTS "View notices" ON public.notices;

CREATE POLICY "View notices" ON public.notices
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      WHERE ra.hostel_id = notices.hostel_id
        AND ra.student_id IN (
          SELECT id FROM public.students WHERE profile_id = auth.uid()
        )
        AND ra.active = true
    )
    OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
