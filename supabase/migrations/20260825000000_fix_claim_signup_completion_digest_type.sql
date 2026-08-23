-- Migration: Fix unresolved digest()/hmac() overload in claim_signup_completion
--
-- Production evidence (confirmed):
--   POST /api/auth/signup/verify-otp -> 200 (already fixed by
--     20260824000000_fix_signup_otp_digest_type.sql)
--   POST /api/auth/signup/complete -> 503, server log "Signup completion claim failed"
--     immediately afterward, with the failure originating from the
--     claim_signup_completion RPC call in app/api/auth/signup/complete/route.ts.
--
-- Root-cause theory: claim_signup_completion() (defined in
-- supabase/migrations/20260817000000_production_signup_otp.sql) contains the
-- exact same untyped-digest/hmac-literal pattern that caused Postgres error
-- 42883 ("function digest(text, unknown) does not exist") in
-- verify_signup_otp(). That earlier fix migration
-- (20260824000000_fix_signup_otp_digest_type.sql) modified only
-- verify_signup_otp() and did not touch claim_signup_completion(), even though
-- claim_signup_completion() is the very next RPC called after a successful
-- OTP verification -- exactly matching the reported symptom of a 200 on
-- verify-otp followed immediately by a 503 on complete.
--
-- Fix: redeploy claim_signup_completion via CREATE OR REPLACE FUNCTION (this
-- atomically overwrites whatever is currently live, regardless of drift)
-- with the ambiguity removed by:
--   (a) explicit ::text casts on both arguments of every digest(...) call and
--       the hmac(...) call inside this one function, and
--   (b) adding `extensions` to this one function's search_path (Supabase
--       installs pgcrypto into the `extensions` schema by default; this
--       mirrors the prior verify_signup_otp fix exactly).
--
-- Only public.claim_signup_completion is modified by this migration. No other
-- function (verify_signup_otp, request_signup_otp, invalidate_signup_challenge,
-- complete_existing_signup, get_account_state, handle_new_user,
-- provision_authorized_new_user, etc.), table, index, trigger, or RLS policy
-- is touched. The advisory-lock serialization, grant reuse/creation branching,
-- and the returned JSON shape (grant_id, grant_nonce, expires_at, email,
-- success, status) are unchanged from the existing function -- only the three
-- digest/hmac call sites and the search_path clause are modified.

BEGIN;

-- Idempotent safety net; a no-op if pgcrypto is already installed anywhere.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Atomically turn a verified completion cookie into exactly one private
-- provisioning grant. The completion secret is the only retry authority: the
-- deterministic, challenge-bound nonce lets a server retry the same pending
-- grant without persisting a plaintext nonce.
CREATE OR REPLACE FUNCTION public.claim_signup_completion(p_completion_secret TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_completion_secret_hash TEXT;
  v_challenge public.email_verifications%ROWTYPE;
  v_account_user_id UUID;
  v_is_complete BOOLEAN;
  v_grant public.signup_provisioning_grants%ROWTYPE;
  v_grant_nonce TEXT;
  v_nonce_hash TEXT;
BEGIN
  IF p_completion_secret IS NULL
     OR p_completion_secret !~ '^[A-Fa-f0-9]{64}$' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  v_completion_secret_hash := encode(digest(p_completion_secret::text, 'sha256'::text), 'hex');

  -- The row lock makes concurrent/replayed completion attempts serialize on
  -- the one verified signup challenge represented by this completion secret.
  SELECT challenge.*
  INTO v_challenge
  FROM public.email_verifications AS challenge
  WHERE challenge.purpose = 'signup'
    AND challenge.completion_token_hash = v_completion_secret_hash
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.verified_at IS NULL
     OR v_challenge.completion_expires_at IS NULL
     OR v_challenge.completion_expires_at <= v_now THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- Serialize state classification with the existing-account completion and
  -- authenticated onboarding mutations. A complete account must not consume a
  -- verified challenge or receive a provisioning grant.
  PERFORM pg_advisory_xact_lock(hashtext('signup:' || v_challenge.email));

  SELECT account_state.user_id, account_state.is_complete
  INTO v_account_user_id, v_is_complete
  FROM public.get_account_state(v_challenge.email) AS account_state;

  IF v_account_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || v_account_user_id::TEXT));

    SELECT account_state.is_complete
    INTO v_is_complete
    FROM public.get_account_state(v_challenge.email) AS account_state;
  END IF;

  IF COALESCE(v_is_complete, FALSE) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- A grant nonce is derived from the random completion secret and challenge
  -- identity. It is still unpredictable, but is reproducible only by the
  -- server holding the HttpOnly completion cookie, making a transient Auth API
  -- retry idempotent without storing a plaintext nonce.
  v_grant_nonce := encode(hmac(p_completion_secret::text, v_challenge.id::text, 'sha256'::text), 'hex');
  v_nonce_hash := encode(digest(v_grant_nonce::text, 'sha256'::text), 'hex');

  SELECT grant_row.*
  INTO v_grant
  FROM public.signup_provisioning_grants AS grant_row
  WHERE grant_row.challenge_id = v_challenge.id
  FOR UPDATE;

  IF FOUND THEN
    -- A claim may only reuse its original, still-pending grant. It must never
    -- mint a second grant for an already consumed challenge.
    IF v_challenge.consumed_at IS NULL
       OR v_grant.status <> 'pending'
       OR v_grant.expires_at <= v_now
       OR v_grant.nonce_hash IS DISTINCT FROM v_nonce_hash
       OR v_grant.normalized_email IS DISTINCT FROM v_challenge.email THEN
      RETURN json_build_object('success', FALSE, 'status', 'rejected');
    END IF;
  ELSE
    -- Consume first, then create the one handoff record in this transaction.
    -- Any insert failure rolls both operations back, so a challenge cannot be
    -- left consumed without its grant by this function.
    IF v_challenge.consumed_at IS NOT NULL THEN
      RETURN json_build_object('success', FALSE, 'status', 'rejected');
    END IF;

    UPDATE public.email_verifications
    SET consumed_at = v_now,
        used_at = COALESCE(used_at, v_now)
    WHERE id = v_challenge.id
      AND purpose = 'signup'
      AND consumed_at IS NULL;

    IF NOT FOUND THEN
      RETURN json_build_object('success', FALSE, 'status', 'rejected');
    END IF;

    INSERT INTO public.signup_provisioning_grants (
      challenge_id,
      normalized_email,
      nonce_hash,
      status,
      expires_at
    ) VALUES (
      v_challenge.id,
      v_challenge.email,
      v_nonce_hash,
      'pending',
      v_challenge.completion_expires_at
    )
    RETURNING * INTO v_grant;
  END IF;

  -- These fields are intentionally returned only to service_role. The browser
  -- receives neither the grant identifier nor the nonce.
  RETURN json_build_object(
    'success', TRUE,
    'status', 'pending',
    'grant_id', v_grant.id,
    'grant_nonce', v_grant_nonce,
    'expires_at', v_grant.expires_at,
    'email', v_grant.normalized_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_completion(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_completion(TEXT) TO service_role;
ALTER FUNCTION public.claim_signup_completion(TEXT) SET search_path = public, extensions, auth;

NOTIFY pgrst, 'reload schema';

COMMIT;
