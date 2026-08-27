-- ===============================================================
-- Migration: Owner Dashboard - Notices RLS insert/update/delete policies
-- Target Project: HostelHub
-- Date: 2026-09-01
-- Description:
-- Adds INSERT, UPDATE, and DELETE policies for authenticated owners 
-- on public.notices. The existing SELECT policy ("View notices") is 
-- NOT modified, dropped, or replaced by this migration.
-- ===============================================================

-- Ensure RLS is enabled on notices table
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 1) NOTICES: INSERT policy (owner inserts notice for hostels they own)
DROP POLICY IF EXISTS "Owners can insert notices for their hostels" ON public.notices;

CREATE POLICY "Owners can insert notices for their hostels" ON public.notices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id AND h.owner_id = auth.uid()
    )
  );

-- 2) NOTICES: UPDATE policy (owner updates notice for hostels they own)
DROP POLICY IF EXISTS "Owners can update notices for their hostels" ON public.notices;

CREATE POLICY "Owners can update notices for their hostels" ON public.notices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id AND h.owner_id = auth.uid()
    )
  );

-- 3) NOTICES: DELETE policy (owner deletes notices for hostels they own)
DROP POLICY IF EXISTS "Owners can delete notices for their hostels" ON public.notices;

CREATE POLICY "Owners can delete notices for their hostels" ON public.notices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = notices.hostel_id AND h.owner_id = auth.uid()
    )
  );

-- 4) SCHEMA CACHE RELOAD
NOTIFY pgrst, 'reload schema';
