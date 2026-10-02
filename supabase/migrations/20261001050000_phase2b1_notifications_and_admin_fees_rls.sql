-- Migration: 20261001050000_phase2b1_notifications_and_admin_fees_rls.sql
-- Description:
--   1. Enable Row Level Security and scoped user policies on public.notifications.
--   2. Revoke table access from anon and public on public.notifications.
--   3. Add additive SELECT policy for super_admin on public.student_fees.

BEGIN;

-- ============================================================================
-- 1. NOTIFICATIONS RLS HARDENING
-- ============================================================================

-- Ensure table has Row Level Security enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Revoke direct permissions from anon and public roles
REVOKE ALL ON TABLE public.notifications FROM anon, public;

-- Grant required table privileges to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- Drop preexisting policies if any exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

-- 1.1 SELECT policy: Users can only read their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 1.2 INSERT policy: Users can only create notifications for their own user_id
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 1.3 UPDATE policy: Users can only update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 1.4 DELETE policy: Users can only delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================================
-- 2. STUDENT_FEES: ADDITIVE SUPER_ADMIN SELECT POLICY
-- ============================================================================

-- Drop if already exists to ensure idempotent application
DROP POLICY IF EXISTS "Super admins can read all student fees" ON public.student_fees;

-- Additive SELECT policy for super_admin role without touching existing student/owner policies
CREATE POLICY "Super admins can read all student fees" ON public.student_fees
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

COMMIT;
