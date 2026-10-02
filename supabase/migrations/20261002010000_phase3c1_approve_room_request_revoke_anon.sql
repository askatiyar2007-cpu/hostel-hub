-- ============================================================================
-- Migration: 20261002010000_phase3c1_approve_room_request_revoke_anon.sql
-- Description: Phase 3C-1 - Revoke anonymous and public execution from approve_room_request
-- Target: public.approve_room_request(uuid)
-- ============================================================================

-- Revoke execute from public and anon
REVOKE EXECUTE ON FUNCTION public.approve_room_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_room_request(uuid) FROM public;

-- Grant execute explicitly to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.approve_room_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_room_request(uuid) TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
