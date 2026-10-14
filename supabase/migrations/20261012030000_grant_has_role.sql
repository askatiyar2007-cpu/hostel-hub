-- Migration: Grant EXECUTE on has_role to authenticated, anon, public
-- Prevents RLS evaluation from failing with 42501 permission denied for function has_role

DO $$
BEGIN
  -- Grant on has_role(UUID, public.app_role) if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon, public';
  END IF;
END $$;
