BEGIN;

-- Server-only onboarding transitions. The API derives the current user from the
-- authenticated request; these functions independently derive the canonical
-- missing step from that user's email before changing public account records.

CREATE OR REPLACE FUNCTION public.complete_onboarding_role(
  p_user_id UUID,
  p_role public.app_role
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_state RECORD;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_role NOT IN ('student'::public.app_role, 'hostel_owner'::public.app_role) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT auth_user.email
  INTO v_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND OR v_email IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || p_user_id::TEXT));

  SELECT *
  INTO v_state
  FROM public.get_account_state(v_email);

  IF v_state.user_id IS DISTINCT FROM p_user_id
     OR v_state.missing_step <> 'role' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.id = v_state.profile_id
    AND profile.user_id = p_user_id
  FOR UPDATE;

  -- A role transition may fill an unassigned profile once. Existing role rows
  -- are preserved rather than replaced or repaired through this endpoint.
  IF NOT FOUND
     OR EXISTS (
       SELECT 1
       FROM public.user_roles AS user_role
       WHERE user_role.user_id = p_user_id
     ) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE id = v_profile.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role);

  RETURN json_build_object('success', TRUE, 'next', 'password');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_password_state(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_state RECORD;
  v_next TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT auth_user.email
  INTO v_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND OR v_email IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || p_user_id::TEXT));

  SELECT *
  INTO v_state
  FROM public.get_account_state(v_email);

  IF v_state.user_id IS DISTINCT FROM p_user_id
     OR v_state.missing_step <> 'password' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  UPDATE public.profiles
  SET password_set = TRUE
  WHERE id = v_state.profile_id
    AND user_id = p_user_id
    AND password_set = FALSE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  v_next := CASE
    WHEN v_state.role = 'student'::public.app_role THEN 'student_onboarding'
    ELSE 'complete'
  END;

  RETURN json_build_object('success', TRUE, 'next', v_next);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_student(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_state RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT auth_user.email
  INTO v_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = p_user_id
  FOR SHARE;

  IF NOT FOUND OR v_email IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || p_user_id::TEXT));

  SELECT *
  INTO v_state
  FROM public.get_account_state(v_email);

  IF v_state.user_id IS DISTINCT FROM p_user_id
     OR v_state.missing_step <> 'student_onboarding'
     OR v_state.role <> 'student'::public.app_role THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.profile_id = v_state.profile_id
  ) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  INSERT INTO public.students (profile_id, status)
  VALUES (v_state.profile_id, 'active');

  RETURN json_build_object('success', TRUE, 'next', 'complete');
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_onboarding_password_state(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_onboarding_student(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_role(UUID, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_password_state(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_student(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
