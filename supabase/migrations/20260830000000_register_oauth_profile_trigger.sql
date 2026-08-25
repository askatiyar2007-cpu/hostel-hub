-- Migration: Re-register Missing OAuth Profile Trigger
-- Date: 2026-08-30
-- Purpose: Production hotfix for missing on_auth_user_created trigger
--
-- Root Cause:
-- The on_auth_user_created trigger that should invoke provision_authorized_new_user()
-- after INSERT on auth.users is missing from production. This causes Google OAuth
-- signups to create auth.users records without corresponding public.profiles records.
--
-- Fix:
-- Re-register the trigger to ensure all future Google OAuth signups automatically
-- create profile and user_roles records as designed.
--
-- Safety:
-- - Uses DROP TRIGGER IF EXISTS for idempotent execution
-- - References existing provision_authorized_new_user() function (no changes)
-- - Preserves all existing provisioning logic
-- - No impact on existing users or data
--
-- Validates Requirements:
-- - 2.2: Trigger properly registered → automatic profile creation
-- - 3.5: Normal Google OAuth signup flow unchanged

BEGIN;

-- Idempotent trigger registration
-- Safe to run multiple times without errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_authorized_new_user();

-- Verify trigger was created successfully
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
  ) INTO v_trigger_exists;
  
  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: Trigger was not created';
  END IF;
  
  RAISE NOTICE 'SUCCESS: Trigger on_auth_user_created registered on auth.users';
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Migration Complete
-- Future Google OAuth signups will now automatically create:
-- 1. auth.users record (via OAuth callback)
-- 2. public.profiles record (via this trigger → provision_authorized_new_user)
-- 3. public.user_roles record (via provision_authorized_new_user)
