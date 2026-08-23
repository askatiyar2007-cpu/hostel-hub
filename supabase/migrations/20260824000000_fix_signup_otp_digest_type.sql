-- Migration: Fix unresolved digest() overload in verify_signup_otp
--
-- Production error (confirmed):
--   POST /api/auth/signup/verify-otp -> 400
--   Signup OTP verification failed { code: '42883', message: 'function digest(text, unknown) does not exist' }
--
-- Postgres error 42883 is "undefined_function": no candidate overload of
-- digest(...) could be resolved for the argument types Postgres saw at this
-- call site (a TEXT value plus the untyped string literal 'sha256', which
-- Postgres reports as "unknown" in this exact error shape whenever overload
-- resolution/function-name visibility fails). This is the standard
-- "function not found" message, not evidence that a different hashing
-- algorithm is involved.
--
-- request_signup_otp() in the currently deployed schema successfully calls
-- gen_random_bytes() and digest(v_otp, 'sha256') (proven by the fact that real
-- OTP emails are being generated and delivered), using the exact same
-- untyped-literal pattern. That means the ambiguity is specific to the
-- currently-deployed verify_signup_otp(), most likely because the live
-- production function body/search_path differs from what is in the local
-- migration file (schema drift from an earlier partial deployment) -- not
-- because of any difference in the SHA-256 algorithm itself.
--
-- Fix: redeploy verify_signup_otp via CREATE OR REPLACE FUNCTION (this
-- atomically overwrites whatever is currently live, regardless of drift)
-- with the ambiguity removed by:
--   (a) explicit ::text casts on both arguments of every digest(...) call
--       inside this one function, and
--   (b) adding `extensions` to this one function's search_path (Supabase
--       installs pgcrypto into the `extensions` schema by default; adding it
--       is a safe, purely additive change with zero risk of collision since
--       only digest/gen_random_bytes/hmac/gen_random_uuid live there and none
--       of those names are shadowed anywhere in this function).
--
-- Only public.verify_signup_otp is modified by this migration. No other
-- function (request_signup_otp, claim_signup_completion,
-- invalidate_signup_challenge, complete_existing_signup, get_account_state,
-- etc.) is touched. The hashing algorithm (SHA-256), expiry logic,
-- attempt-limit logic, challenge-selection WHERE/ORDER BY logic, and the
-- returned JSON shape are unchanged from the existing function -- only the
-- two digest(...) call sites and the search_path clause are modified.

BEGIN;

-- Idempotent safety net; a no-op if pgcrypto is already installed anywhere.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify one active signup challenge under the same per-email lock as issuance.
-- The completion secret is intentionally returned only to the service-role route,
-- which writes it to an HttpOnly cookie; only its hash is persisted here.
CREATE OR REPLACE FUNCTION public.verify_signup_otp(
  p_email TEXT,
  p_otp TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_normalized_email TEXT := lower(trim(p_email));
  v_now TIMESTAMPTZ;
  v_otp_hash TEXT;
  v_challenge public.email_verifications%ROWTYPE;
  v_completion_secret TEXT;
  v_completion_secret_hash TEXT;
  v_completion_expires_at TIMESTAMPTZ;
BEGIN
  -- Request-shape validation belongs to the server route. Invalid direct calls
  -- are non-mutating and never expose challenge or account-state information.
  IF v_normalized_email IS NULL
     OR v_normalized_email = ''
     OR p_otp IS NULL
     OR p_otp !~ '^[0-9]{6}$' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('signup:' || v_normalized_email));
  v_now := clock_timestamp();
  v_otp_hash := encode(digest(p_otp::text, 'sha256'::text), 'hex');

  -- Select the only eligible challenge regardless of OTP value so a failed
  -- verification can advance exactly that signup challenge's attempt count.
  -- expires_at > v_now makes an OTP invalid exactly at its expiry boundary.
  SELECT challenge.*
  INTO v_challenge
  FROM public.email_verifications AS challenge
  WHERE challenge.email = v_normalized_email
    AND challenge.purpose = 'signup'
    AND challenge.expires_at > v_now
    AND challenge.verified_at IS NULL
    AND challenge.used_at IS NULL
    AND challenge.consumed_at IS NULL
  ORDER BY challenge.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- A challenge with four prior failures is invalidated by the next mismatch.
  -- The defensive >= branch also retires malformed historical state without
  -- ever issuing a completion authority.
  IF v_challenge.otp_hash IS DISTINCT FROM v_otp_hash THEN
    IF v_challenge.attempts >= 4 THEN
      UPDATE public.email_verifications
      SET attempts = 5,
          used_at = v_now
      WHERE id = v_challenge.id
        AND purpose = 'signup';
    ELSE
      UPDATE public.email_verifications
      SET attempts = attempts + 1
      WHERE id = v_challenge.id
        AND purpose = 'signup';
    END IF;

    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- Matching codes are accepted only after zero through four prior failures.
  -- This should be unreachable for normal rows at five attempts because the
  -- failing attempt above consumes the challenge, but it preserves the limit
  -- if malformed historical state is encountered.
  IF v_challenge.attempts >= 5 THEN
    UPDATE public.email_verifications
    SET attempts = 5,
        used_at = v_now
    WHERE id = v_challenge.id
      AND purpose = 'signup';

    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- A 32-byte random value provides 256 bits of completion authority. The
  -- plaintext leaves this function only to the service-role caller; the client
  -- route must place it exclusively in the HttpOnly completion cookie.
  v_completion_secret := encode(gen_random_bytes(32), 'hex');
  v_completion_secret_hash := encode(digest(v_completion_secret::text, 'sha256'::text), 'hex');
  v_completion_expires_at := v_now + INTERVAL '10 minutes';

  UPDATE public.email_verifications
  SET verified = TRUE,
      verified_at = v_now,
      completion_token_hash = v_completion_secret_hash,
      completion_expires_at = v_completion_expires_at
  WHERE id = v_challenge.id
    AND purpose = 'signup'
    AND verified_at IS NULL
    AND used_at IS NULL
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'status', 'verified',
    'completion_secret', v_completion_secret,
    'completion_expires_at', v_completion_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_signup_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_signup_otp(TEXT, TEXT) TO service_role;
ALTER FUNCTION public.verify_signup_otp(TEXT, TEXT) SET search_path = public, extensions, auth;

NOTIFY pgrst, 'reload schema';

COMMIT;
