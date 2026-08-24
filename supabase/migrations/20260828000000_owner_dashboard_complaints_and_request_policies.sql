-- ===============================================================
-- Migration: Owner Dashboard - Complaints RLS fix & Rejected
--            Room Request deletion policy
-- Target Project: HostelHub
-- Date: 2026-08-28
-- Description:
-- 1. Restores INSERT (student, own complaint) and UPDATE (owner,
--    own hostel's complaints) policies on public.complaints that
--    were dropped by 20260726000000_fix_recursive_rls_final.sql
--    and never recreated. The existing SELECT policy
--    ("Complaint visibility") is NOT modified, dropped, or
--    replaced by this migration.
-- 2. Adds a DELETE policy on public.room_requests scoped to:
--    the request's status = 'rejected' AND the request's hostel
--    is owned by the requesting user. No existing SELECT/INSERT/
--    UPDATE policy on room_requests is modified.
-- This migration is purely additive and idempotent.
-- ===============================================================

-- ===============================================================
-- 1) COMPLAINTS: INSERT policy (student inserts own complaint)
-- ===============================================================

DROP POLICY IF EXISTS "Students can insert own complaints" ON public.complaints;

CREATE POLICY "Students can insert own complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- ===============================================================
-- 2) COMPLAINTS: UPDATE policy (owner updates complaints for
--    hostels they own)
-- ===============================================================

DROP POLICY IF EXISTS "Owners can update complaints for their hostels" ON public.complaints;

CREATE POLICY "Owners can update complaints for their hostels" ON public.complaints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = complaints.hostel_id AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = complaints.hostel_id AND h.owner_id = auth.uid()
    )
  );

-- ===============================================================
-- 3) ROOM_REQUESTS: DELETE policy (owner deletes their own
--    hostel's rejected requests only)
-- ===============================================================

DROP POLICY IF EXISTS "Owners can delete rejected hostel requests" ON public.room_requests;

CREATE POLICY "Owners can delete rejected hostel requests" ON public.room_requests
  FOR DELETE TO authenticated
  USING (
    status = 'rejected'
    AND hostel_id IN (
      SELECT id FROM public.hostels WHERE owner_id = auth.uid()
    )
  );

-- ===============================================================
-- 4) SCHEMA CACHE RELOAD
-- ===============================================================
NOTIFY pgrst, 'reload schema';