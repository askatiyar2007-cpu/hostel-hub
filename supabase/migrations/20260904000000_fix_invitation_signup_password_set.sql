-- Migration: Fix Invitation Signup password_set and user_roles
-- Date: 2026-09-04
-- Purpose: Fix Owner-assigned student authentication bug
--
-- Root Cause:
-- The complete_invitation_signup RPC creates a profile for invited students
-- but does NOT set password_set = TRUE, even though the auth user was created
-- with a password via supabase.auth.admin.createUser. This causes successful
-- authentication to be treated as an incomplete account, leaving the student
-- on /auth/login instead of redirecting to /student/dashboard.
--
-- Additionally, the RPC does not create a user_roles entry, which is required
-- by get_account_state for role completeness verification.
--
-- Fix:
-- 1. Update complete_invitation_signup to set password_set = TRUE
-- 2. Update complete_invitation_signup to create user_roles entry
-- 3. Backfill existing invited students with password_set = FALSE
-- 4. Backfill existing invited students missing user_roles entries
--
-- Safety:
-- - Only affects students who came through the manual assignment/invitation flow
-- - Identified via student_invitations table relationship
-- - Idempotent: uses ON CONFLICT DO NOTHING for user_roles
-- - Preserves normal signup flow behavior
-- - No changes to auth.users, profiles table structure, or other tables
--
-- Validates Requirements:
-- - Owner-assigned students get password_set = TRUE
-- - Owner-assigned students get user_roles entry
-- - Normal signup flow unchanged
-- - Existing affected accounts fixed

BEGIN;

-- ============================================================
-- 1. Fix complete_invitation_signup RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_invitation_signup(
    p_student_id UUID,
    p_profile_user_id UUID,
    p_phone_number TEXT,
    p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_student_name TEXT;
    v_student_email TEXT;
BEGIN
    -- a) Fetch student details for profile creation if needed
    SELECT student_name, student_email INTO v_student_name, v_student_email
    FROM public.students
    WHERE id = p_student_id;

    -- b) Try to fetch existing profile_id for user_id
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_profile_user_id;

    -- c) If profile doesn't exist, create it (handles trigger race condition/missing trigger)
    IF v_profile_id IS NULL THEN
        INSERT INTO public.profiles (user_id, full_name, email, role)
        VALUES (
            p_profile_user_id,
            v_student_name,
            v_student_email,
            'student'
        )
        RETURNING id INTO v_profile_id;
    END IF;

    -- d) Update profile phone number if provided and currently empty
    IF p_phone_number IS NOT NULL AND p_phone_number <> '' THEN
        UPDATE public.profiles
        SET phone_number = COALESCE(phone_number, p_phone_number)
        WHERE id = v_profile_id;
    END IF;

    -- e) Set password_set = TRUE since auth user was created with a password
    -- This is critical: the auth user has a password, so the profile must reflect that
    UPDATE public.profiles
    SET password_set = TRUE
    WHERE id = v_profile_id;

    -- f) Create user_roles entry to match normal signup flow
    -- get_account_state requires exactly one user_roles entry matching the profile role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_profile_user_id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- g) Update student record (link profile and activate)
    UPDATE public.students
    SET profile_id = v_profile_id,
        status = 'active'
    WHERE id = p_student_id;

    -- h) Mark invitation as used (ensure it hasn't been used yet)
    UPDATE public.student_invitations
    SET used_at = NOW()
    WHERE id = p_invitation_id AND used_at IS NULL;

    -- i) Verify the invitation was successfully marked as used
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation has already been used';
    END IF;
END;
$$;

-- ============================================================
-- 2. Backfill: Fix password_set for existing invited students
-- ============================================================

-- Update profiles for students who:
-- - Came through the manual assignment/invitation flow (have student_invitations)
-- - Have auth users with passwords (encrypted_password is not null)
-- - Have password_set = FALSE (the bug condition)
-- - Have an active student record linked to the profile

UPDATE public.profiles AS profile
SET password_set = TRUE
FROM auth.users AS auth_user
WHERE profile.user_id = auth_user.id
  AND profile.password_set = FALSE
  AND NULLIF(auth_user.encrypted_password, '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.profile_id = profile.id
      AND student.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.student_invitations AS invitation
        WHERE invitation.student_id = student.id
          AND invitation.used_at IS NOT NULL
      )
  );

-- ============================================================
-- 3. Backfill: Create missing user_roles for existing invited students
-- ============================================================

-- Create user_roles entries for students who:
-- - Came through the manual assignment/invitation flow (have student_invitations)
-- - Have a profile with role = 'student'
-- - Are missing the user_roles entry
-- - Have an active student record

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT profile.user_id, 'student'::public.app_role
FROM public.profiles AS profile
WHERE profile.role = 'student'
  AND EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.profile_id = profile.id
      AND student.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM public.student_invitations AS invitation
        WHERE invitation.student_id = student.id
          AND invitation.used_at IS NOT NULL
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS user_role
    WHERE user_role.user_id = profile.user_id
      AND user_role.role = 'student'::public.app_role
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 4. Refresh schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Migration Complete
-- complete_invitation_signup now:
-- - Sets password_set = TRUE for invited students
-- - Creates user_roles entry for invited students
-- Existing invited students with the bug have been backfilled
