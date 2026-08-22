-- Migration: Production signup OTP storage foundation
-- Purpose: make email_verifications historical/multi-challenge storage and add
--          server-only provisioning grant state. Signup RPCs and the provisioning
--          trigger are introduced in subsequent migration tasks.

BEGIN;

-- Preserve the legacy purpose-specific challenge populations while the table is
-- reshaped. The end-of-migration assertion makes a failed preservation check
-- roll back every schema and data change in this transaction.
CREATE TEMP TABLE production_signup_otp_legacy_counts ON COMMIT DROP AS
SELECT purpose, COUNT(*)::bigint AS row_count
FROM public.email_verifications
WHERE purpose IN ('password_reset', 'room_request_verification')
GROUP BY purpose;

-- Give every historical challenge a stable identity before removing the old
-- one-row-per-email primary key. This deliberately keeps every old challenge.
ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS id UUID;

UPDATE public.email_verifications
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.email_verifications
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Hash any plaintext values before dropping the legacy column. A row that
-- cannot be safely converted stops the transaction instead of losing evidence
-- or weakening password-reset/room-request verification history.
UPDATE public.email_verifications
SET otp_hash = encode(digest(otp, 'sha256'), 'hex')
WHERE otp_hash IS NULL
  AND otp IS NOT NULL;

-- Canonicalize retained challenge namespaces now that duplicate normalized
-- addresses can coexist as separate historical rows.
UPDATE public.email_verifications
SET email = lower(trim(email))
WHERE email IS DISTINCT FROM lower(trim(email));

-- Preserve the legacy verified state when an earlier migration only populated
-- the boolean flag.
UPDATE public.email_verifications
SET verified_at = COALESCE(verified_at, created_at)
WHERE verified = true
  AND verified_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.email_verifications
    WHERE otp_hash IS NULL OR btrim(otp_hash) = ''
  ) THEN
    RAISE EXCEPTION
      'Cannot remove public.email_verifications.otp: one or more historical rows have no safe OTP hash';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_verifications
    WHERE purpose NOT IN ('password_reset', 'room_request_verification')
  ) THEN
    RAISE EXCEPTION
      'Cannot add signup purpose constraint: unsupported legacy OTP purpose exists';
  END IF;
END;
$$;

-- Replace the legacy email primary key with a row primary key. Future signup
-- challenges can now keep issuance history and invalidated rows per email.
DO $$
DECLARE
  v_primary_key_name name;
BEGIN
  SELECT conname
  INTO v_primary_key_name
  FROM pg_constraint
  WHERE conrelid = 'public.email_verifications'::regclass
    AND contype = 'p';

  IF v_primary_key_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.email_verifications DROP CONSTRAINT %I',
      v_primary_key_name
    );
  END IF;
END;
$$;

ALTER TABLE public.email_verifications
  ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id),
  ALTER COLUMN otp_hash SET NOT NULL;

-- Signup completion authority is stored only as a hash and is structurally
-- unavailable to password-reset and room-request challenges.
ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS completion_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS completion_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

ALTER TABLE public.email_verifications
  DROP CONSTRAINT IF EXISTS email_verifications_purpose_check,
  DROP CONSTRAINT IF EXISTS email_verifications_normalized_email_check,
  DROP CONSTRAINT IF EXISTS email_verifications_otp_hash_check,
  DROP CONSTRAINT IF EXISTS email_verifications_completion_fields_check,
  DROP CONSTRAINT IF EXISTS email_verifications_completion_lifetime_check,
  ADD CONSTRAINT email_verifications_purpose_check
    CHECK (purpose IN ('password_reset', 'room_request_verification', 'signup')),
  ADD CONSTRAINT email_verifications_normalized_email_check
    CHECK (email = lower(trim(email)) AND email <> ''),
  ADD CONSTRAINT email_verifications_otp_hash_check
    CHECK (btrim(otp_hash) <> ''),
  ADD CONSTRAINT email_verifications_completion_fields_check
    CHECK (
      purpose = 'signup'
      OR (
        completion_token_hash IS NULL
        AND completion_expires_at IS NULL
        AND consumed_at IS NULL
      )
    ),
  ADD CONSTRAINT email_verifications_completion_lifetime_check
    CHECK (
      (completion_token_hash IS NULL AND completion_expires_at IS NULL)
      OR (completion_token_hash IS NOT NULL AND completion_expires_at IS NOT NULL)
    );

-- No application code may read plaintext OTPs after this point.
ALTER TABLE public.email_verifications
  DROP COLUMN IF EXISTS otp;

-- Historical lookup, active challenge mutation, and hashed completion-secret
-- lookup indexes. The active index avoids volatile time expressions; expiry is
-- still evaluated by the locked SQL functions.
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_purpose_created_at
  ON public.email_verifications (email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verifications_active_challenges
  ON public.email_verifications (email, purpose, expires_at, created_at DESC)
  WHERE verified_at IS NULL AND used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_verifications_signup_completion_token_hash
  ON public.email_verifications (completion_token_hash)
  WHERE purpose = 'signup' AND completion_token_hash IS NOT NULL;

-- Private, one-per-consumed-challenge state used later by SECURITY DEFINER
-- claim functions and the auth.users BEFORE INSERT provisioning gate.
CREATE TABLE IF NOT EXISTS public.signup_provisioning_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE
    REFERENCES public.email_verifications(id) ON DELETE RESTRICT,
  normalized_email TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  auth_user_id UUID UNIQUE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signup_provisioning_grants_normalized_email_check
    CHECK (normalized_email = lower(trim(normalized_email)) AND normalized_email <> ''),
  CONSTRAINT signup_provisioning_grants_nonce_hash_check
    CHECK (btrim(nonce_hash) <> ''),
  CONSTRAINT signup_provisioning_grants_status_check
    CHECK (status IN ('pending', 'consumed', 'failed')),
  CONSTRAINT signup_provisioning_grants_consumed_user_check
    CHECK (
      (status = 'consumed' AND auth_user_id IS NOT NULL)
      OR (status IN ('pending', 'failed') AND auth_user_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_signup_provisioning_grants_pending_expiry
  ON public.signup_provisioning_grants (expires_at, normalized_email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_signup_provisioning_grants_normalized_email
  ON public.signup_provisioning_grants (normalized_email, created_at DESC);

ALTER TABLE public.signup_provisioning_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signup_provisioning_grants FROM PUBLIC, anon, authenticated;

-- Account completion is determined from one canonical, server-side predicate.
-- Existing password accounts are backfilled from Supabase Auth's server-managed
-- credential column; future provisioning/password APIs must keep this flag in
-- sync whenever a password is created or removed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.profiles AS profile
SET password_set = TRUE
FROM auth.users AS auth_user
WHERE profile.user_id = auth_user.id
  AND profile.password_set = FALSE
  AND NULLIF(auth_user.encrypted_password, '') IS NOT NULL;

-- Classify one normalized email address without relying on client metadata or
-- partial UI checks. The function always emits exactly one row and returns the
-- first incomplete state in the required setup order.
CREATE OR REPLACE FUNCTION public.get_account_state(p_email TEXT)
RETURNS TABLE (
  normalized_email TEXT,
  user_id UUID,
  profile_id UUID,
  role public.app_role,
  password_set BOOLEAN,
  missing_step TEXT,
  is_complete BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_email TEXT := lower(trim(p_email));
  v_user auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_role_count INTEGER;
  v_matching_role_count INTEGER;
  v_password_set BOOLEAN;
BEGIN
  normalized_email := v_normalized_email;
  user_id := NULL;
  profile_id := NULL;
  role := NULL;
  password_set := FALSE;
  is_complete := FALSE;

  SELECT auth_user.*
  INTO v_user
  FROM auth.users AS auth_user
  WHERE lower(trim(auth_user.email)) = v_normalized_email
  ORDER BY auth_user.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    missing_step := 'identity';
    RETURN NEXT;
    RETURN;
  END IF;

  user_id := v_user.id;

  SELECT profile.*
  INTO v_profile
  FROM public.profiles AS profile
  WHERE profile.user_id = v_user.id
    AND lower(trim(profile.email)) = v_normalized_email
  LIMIT 1;

  IF NOT FOUND THEN
    missing_step := 'profile';
    RETURN NEXT;
    RETURN;
  END IF;

  profile_id := v_profile.id;
  role := v_profile.role;

  -- A profile is role-complete only when it has one and only one assignment,
  -- and that assignment agrees with the profile role. Multiple assignments are
  -- intentionally incomplete rather than silently choosing an arbitrary role.
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE user_role.role = v_profile.role)::INTEGER
  INTO v_role_count, v_matching_role_count
  FROM public.user_roles AS user_role
  WHERE user_role.user_id = v_user.id;

  IF v_role_count <> 1 OR v_matching_role_count <> 1 THEN
    missing_step := 'role';
    RETURN NEXT;
    RETURN;
  END IF;

  v_password_set := COALESCE(v_profile.password_set, FALSE);
  password_set := v_password_set;

  IF NOT v_password_set THEN
    missing_step := 'password';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_profile.role = 'student'::public.app_role
     AND NOT EXISTS (
       SELECT 1
       FROM public.students AS student
       WHERE student.profile_id = v_profile.id
     ) THEN
    missing_step := 'student_onboarding';
    RETURN NEXT;
    RETURN;
  END IF;

  missing_step := 'complete';
  is_complete := TRUE;
  RETURN NEXT;
END;
$$;

-- The classifier is authoritative for server APIs and the callback. It must
-- not become a browser-accessible account-enumeration API.
REVOKE ALL ON FUNCTION public.get_account_state(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_state(TEXT) TO service_role;

-- Issue a signup-only OTP under a per-email transaction lock. The advisory
-- lock also serializes the empty-set case, while the row lock protects every
-- existing signup challenge for this normalized email. This function is only
-- callable by the Next.js server's service-role client; its raw OTP must never
-- be forwarded past that server boundary.
CREATE OR REPLACE FUNCTION public.request_signup_otp(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_email TEXT := lower(trim(p_email));
  v_issued_at TIMESTAMPTZ;
  v_latest_issued_at TIMESTAMPTZ;
  v_recent_issue_count INTEGER;
  v_is_complete BOOLEAN;
  v_otp TEXT := '';
  v_otp_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_challenge_id UUID;
  v_random_byte INTEGER;
  v_index INTEGER;
BEGIN
  -- Request-shape validation belongs to the server route. Keep an invalid SQL
  -- argument non-mutating and free of account-state details if called directly.
  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- A transaction-scoped lock serializes every request for this exact signup
  -- namespace, including when no challenge row exists yet.
  PERFORM pg_advisory_xact_lock(hashtext('signup:' || v_normalized_email));

  PERFORM 1
  FROM public.email_verifications AS challenge
  WHERE challenge.email = v_normalized_email
    AND challenge.purpose = 'signup'
  FOR UPDATE;

  v_issued_at := clock_timestamp();

  -- Complete accounts must not reveal their state or alter any challenge.
  SELECT account_state.is_complete
  INTO v_is_complete
  FROM public.get_account_state(v_normalized_email) AS account_state;

  IF COALESCE(v_is_complete, FALSE) THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- The cooldown is strict: exactly one minute after issuance is allowed. Both
  -- rate-limit exits occur before an invalidation or insert, preserving the
  -- active challenge set exactly as it was.
  SELECT MAX(challenge.created_at)
  INTO v_latest_issued_at
  FROM public.email_verifications AS challenge
  WHERE challenge.email = v_normalized_email
    AND challenge.purpose = 'signup';

  IF v_latest_issued_at IS NOT NULL
     AND v_latest_issued_at > v_issued_at - INTERVAL '1 minute' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_recent_issue_count
  FROM public.email_verifications AS challenge
  WHERE challenge.email = v_normalized_email
    AND challenge.purpose = 'signup'
    AND challenge.created_at > v_issued_at - INTERVAL '15 minutes';

  IF v_recent_issue_count >= 5 THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- Generate a uniformly distributed six-digit code from pgcrypto bytes. The
  -- rejection sampling avoids modulo bias; the first digit is never zero.
  FOR v_index IN 1..6 LOOP
    LOOP
      v_random_byte := get_byte(gen_random_bytes(1), 0);
      EXIT WHEN (v_index = 1 AND v_random_byte < 252)
             OR (v_index > 1 AND v_random_byte < 250);
    END LOOP;

    IF v_index = 1 THEN
      v_otp := v_otp || (1 + (v_random_byte % 9))::TEXT;
    ELSE
      v_otp := v_otp || (v_random_byte % 10)::TEXT;
    END IF;
  END LOOP;

  v_otp_hash := encode(digest(v_otp, 'sha256'), 'hex');
  v_expires_at := v_issued_at + INTERVAL '10 minutes';

  -- Only earlier active, unverified signup challenges are invalidated. Other
  -- purposes, expired records, verified records, and consumed records remain
  -- untouched for their independent flows and audit history.
  UPDATE public.email_verifications AS challenge
  SET used_at = v_issued_at
  WHERE challenge.email = v_normalized_email
    AND challenge.purpose = 'signup'
    AND challenge.verified_at IS NULL
    AND challenge.used_at IS NULL
    AND challenge.consumed_at IS NULL
    AND challenge.expires_at > v_issued_at;

  INSERT INTO public.email_verifications (
    email,
    purpose,
    otp_hash,
    attempts,
    verified,
    created_at,
    expires_at
  ) VALUES (
    v_normalized_email,
    'signup',
    v_otp_hash,
    0,
    FALSE,
    v_issued_at,
    v_expires_at
  )
  RETURNING id INTO v_challenge_id;

  -- challenge_id, recipient, and expiry are server-only delivery metadata.
  -- No hash or completion authority leaves this function.
  RETURN json_build_object(
    'success', TRUE,
    'status', 'issued',
    'challenge_id', v_challenge_id,
    'email', v_normalized_email,
    'expires_at', v_expires_at,
    'otp', v_otp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_signup_otp(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_signup_otp(TEXT) TO service_role;

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
SET search_path = public, auth
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
  v_otp_hash := encode(digest(p_otp, 'sha256'), 'hex');

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
  v_completion_secret_hash := encode(digest(v_completion_secret, 'sha256'), 'hex');
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

-- Delivery failure invalidates exactly the just-issued signup challenge by ID.
-- It cannot touch another signup challenge for the same email or either legacy
-- purpose, and it never invalidates a verified/consumed challenge.
CREATE OR REPLACE FUNCTION public.invalidate_signup_challenge(p_challenge_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_challenge_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  UPDATE public.email_verifications AS challenge
  SET used_at = v_now
  WHERE challenge.id = p_challenge_id
    AND challenge.purpose = 'signup'
    AND challenge.verified_at IS NULL
    AND challenge.used_at IS NULL
    AND challenge.consumed_at IS NULL;

  RETURN json_build_object('success', FOUND, 'status', 'invalidated');
END;
$$;

REVOKE ALL ON FUNCTION public.invalidate_signup_challenge(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_signup_challenge(UUID) TO service_role;

-- Verify that changing keys/indexes and removing plaintext storage did not
-- remove or reclassify existing password-reset or room-request challenges.
DO $$
DECLARE
  v_expected record;
  v_actual_count bigint;
BEGIN
  FOR v_expected IN
    SELECT purpose, row_count
    FROM pg_temp.production_signup_otp_legacy_counts
  LOOP
    SELECT COUNT(*)::bigint
    INTO v_actual_count
    FROM public.email_verifications
    WHERE purpose = v_expected.purpose;

    IF v_actual_count <> v_expected.row_count THEN
      RAISE EXCEPTION
        'Legacy % OTP row count changed during signup migration (expected %, found %)',
        v_expected.purpose, v_expected.row_count, v_actual_count;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.email_verifications
    WHERE purpose IN ('password_reset', 'room_request_verification')
      AND (id IS NULL OR otp_hash IS NULL OR btrim(otp_hash) = '')
  ) THEN
    RAISE EXCEPTION
      'Legacy password-reset or room-request OTP data is incomplete after signup migration';
  END IF;
END;
$$;

-- Atomically turn a verified completion cookie into exactly one private
-- provisioning grant. The completion secret is the only retry authority: the
-- deterministic, challenge-bound nonce lets a server retry the same pending
-- grant without persisting a plaintext nonce.
CREATE OR REPLACE FUNCTION public.claim_signup_completion(p_completion_secret TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  v_completion_secret_hash := encode(digest(p_completion_secret, 'sha256'), 'hex');

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
  v_grant_nonce := encode(hmac(p_completion_secret, v_challenge.id::TEXT, 'sha256'), 'hex');
  v_nonce_hash := encode(digest(v_grant_nonce, 'sha256'), 'hex');

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

-- The BEFORE INSERT gate validates and consumes a private grant before the
-- auth identity can exist. Dependent public rows are inserted by the following
-- AFTER INSERT trigger in the same transaction because their foreign keys need
-- the auth.users parent row to be visible first.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_normalized_email TEXT := lower(trim(NEW.email));
  v_app_metadata JSONB := COALESCE(NEW.raw_app_meta_data, '{}'::JSONB);
  v_grant_id_text TEXT := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'signup_grant_id', '')), '');
  v_grant_nonce TEXT := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'signup_grant_nonce', '')), '');
  v_grant_id UUID;
  v_nonce_hash TEXT;
  v_grant public.signup_provisioning_grants%ROWTYPE;
  v_challenge public.email_verifications%ROWTYPE;
  v_is_authorized_google BOOLEAN;
BEGIN
  IF v_normalized_email IS NULL OR v_normalized_email = '' THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  -- raw_app_meta_data is provider-controlled. Google identities are the sole
  -- separate onboarding path and cannot carry an email-signup grant.
  v_is_authorized_google := v_app_metadata->>'provider' = 'google'
    AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE);

  IF v_is_authorized_google THEN
    IF v_grant_id_text IS NOT NULL OR v_grant_nonce IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized account provisioning';
    END IF;

    RETURN NEW;
  END IF;

  -- All non-Google identities are email signup attempts. Validate the claimed
  -- values before casting so an unauthorized path never inserts auth.users.
  IF v_grant_id_text IS NULL
     OR v_grant_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_grant_nonce IS NULL
     OR v_grant_nonce !~ '^[A-Fa-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  v_grant_id := v_grant_id_text::UUID;
  v_nonce_hash := encode(digest(v_grant_nonce, 'sha256'), 'hex');

  SELECT grant_row.*
  INTO v_grant
  FROM public.signup_provisioning_grants AS grant_row
  WHERE grant_row.id = v_grant_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_grant.status <> 'pending'
     OR v_grant.expires_at <= v_now
     OR v_grant.auth_user_id IS NOT NULL
     OR v_grant.normalized_email IS DISTINCT FROM v_normalized_email
     OR v_grant.nonce_hash IS DISTINCT FROM v_nonce_hash THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  SELECT challenge.*
  INTO v_challenge
  FROM public.email_verifications AS challenge
  WHERE challenge.id = v_grant.challenge_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.purpose <> 'signup'
     OR v_challenge.email IS DISTINCT FROM v_normalized_email
     OR v_challenge.verified_at IS NULL
     OR v_challenge.consumed_at IS NULL
     OR v_challenge.used_at IS NULL
     OR v_challenge.completion_token_hash IS NULL THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  -- Binding NEW.id before identity insertion is safe because this transaction
  -- owns the UUID; any later error rolls this update and the identity back.
  UPDATE public.signup_provisioning_grants
  SET status = 'consumed',
      auth_user_id = NEW.id,
      updated_at = v_now
  WHERE id = v_grant.id
    AND status = 'pending'
    AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  RETURN NEW;
END;
$$;

-- Provision only identities that have already passed handle_new_user in this
-- transaction. This remains atomic with the auth insert: any profile/role/
-- student failure aborts the entire transaction and restores the grant state.
CREATE OR REPLACE FUNCTION public.provision_authorized_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_email TEXT := lower(trim(NEW.email));
  v_metadata JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
  v_app_metadata JSONB := COALESCE(NEW.raw_app_meta_data, '{}'::JSONB);
  v_grant_id_text TEXT := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'signup_grant_id', '')), '');
  v_grant_nonce TEXT := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'signup_grant_nonce', '')), '');
  v_grant_id UUID;
  v_nonce_hash TEXT;
  v_grant public.signup_provisioning_grants%ROWTYPE;
  v_challenge public.email_verifications%ROWTYPE;
  v_full_name TEXT;
  v_phone_number TEXT;
  v_role public.app_role;
  v_profile_id UUID;
  v_is_authorized_google BOOLEAN;
BEGIN
  v_is_authorized_google := v_app_metadata->>'provider' = 'google'
    AND COALESCE((v_app_metadata->'providers') ? 'google', FALSE);

  IF v_is_authorized_google THEN
    IF v_grant_id_text IS NOT NULL OR v_grant_nonce IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized account provisioning';
    END IF;

    -- Preserve the separately marked Google path without granting it access
    -- to email-signup authority. It stays password-incomplete for onboarding.
    v_full_name := NULLIF(btrim(COALESCE(
      v_metadata->>'full_name',
      v_metadata->>'name',
      split_part(v_normalized_email, '@', 1)
    )), '');

    IF v_full_name IS NULL THEN
      RAISE EXCEPTION 'Unauthorized account provisioning';
    END IF;

    INSERT INTO public.profiles (user_id, full_name, email, role, password_set)
    VALUES (NEW.id, v_full_name, v_normalized_email, 'student'::public.app_role, FALSE)
    RETURNING id INTO v_profile_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::public.app_role);

    RETURN NEW;
  END IF;

  IF v_grant_id_text IS NULL
     OR v_grant_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_grant_nonce IS NULL
     OR v_grant_nonce !~ '^[A-Fa-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  v_grant_id := v_grant_id_text::UUID;
  v_nonce_hash := encode(digest(v_grant_nonce, 'sha256'), 'hex');

  SELECT grant_row.*
  INTO v_grant
  FROM public.signup_provisioning_grants AS grant_row
  WHERE grant_row.id = v_grant_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_grant.status <> 'consumed'
     OR v_grant.auth_user_id IS DISTINCT FROM NEW.id
     OR v_grant.normalized_email IS DISTINCT FROM v_normalized_email
     OR v_grant.nonce_hash IS DISTINCT FROM v_nonce_hash THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  SELECT challenge.*
  INTO v_challenge
  FROM public.email_verifications AS challenge
  WHERE challenge.id = v_grant.challenge_id
  FOR SHARE;

  IF NOT FOUND
     OR v_challenge.purpose <> 'signup'
     OR v_challenge.email IS DISTINCT FROM v_normalized_email
     OR v_challenge.verified_at IS NULL
     OR v_challenge.consumed_at IS NULL
     OR v_challenge.used_at IS NULL THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(v_metadata->>'full_name', '')), '');
  v_phone_number := NULLIF(btrim(COALESCE(v_metadata->>'phone', '')), '');

  -- Only roles supplied by the controlled email signup route may be created.
  IF v_full_name IS NULL
     OR v_metadata->>'role' NOT IN ('student', 'hostel_owner') THEN
    RAISE EXCEPTION 'Unauthorized account provisioning';
  END IF;

  v_role := (v_metadata->>'role')::public.app_role;

  INSERT INTO public.profiles (
    user_id, full_name, email, phone_number, role, password_set
  ) VALUES (
    NEW.id, v_full_name, v_normalized_email, v_phone_number, v_role, TRUE
  )
  RETURNING id INTO v_profile_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role);

  IF v_role = 'student'::public.app_role THEN
    INSERT INTO public.students (profile_id, status)
    VALUES (v_profile_id, 'active');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.provision_authorized_new_user() FROM PUBLIC, anon, authenticated;

-- Replace the legacy automatic AFTER trigger with an authorization gate followed
-- by same-transaction dependent-row provisioning. Both paths are atomic: an
-- error in either function leaves no auth identity or public account records.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_authorized ON auth.users;
CREATE TRIGGER on_auth_user_authorized
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_authorized_new_user();

-- Resume an already-created identity without manufacturing another auth.users
-- row. The grant is consumed and bound to that identity before the first public
-- record mutation, while retries accept only the same already-bound grant.
-- Exactly one canonical missing step is filled per call; existing account
-- records are never rewritten or repaired by this signup-only function.
CREATE OR REPLACE FUNCTION public.complete_existing_signup(
  p_grant_id UUID,
  p_grant_nonce TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_role public.app_role DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_nonce_hash TEXT;
  v_grant public.signup_provisioning_grants%ROWTYPE;
  v_challenge public.email_verifications%ROWTYPE;
  v_user auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_state RECORD;
  v_full_name TEXT;
  v_phone_number TEXT;
  v_next_step TEXT;
BEGIN
  IF p_grant_id IS NULL
     OR p_grant_nonce IS NULL
     OR p_grant_nonce !~ '^[A-Fa-f0-9]{64}$' THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  v_nonce_hash := encode(digest(p_grant_nonce, 'sha256'), 'hex');

  -- Serialize this completion with the signup challenge and the authenticated
  -- onboarding RPCs. This also protects the no-profile/no-role empty-row cases
  -- where a row-level lock alone would not serialize concurrent callers.
  SELECT grant_row.*
  INTO v_grant
  FROM public.signup_provisioning_grants AS grant_row
  WHERE grant_row.id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_grant.nonce_hash IS DISTINCT FROM v_nonce_hash
     OR v_grant.expires_at <= v_now
     OR v_grant.status NOT IN ('pending', 'consumed') THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('signup:' || v_grant.normalized_email));

  SELECT auth_user.*
  INTO v_user
  FROM auth.users AS auth_user
  WHERE lower(trim(auth_user.email)) = v_grant.normalized_email
  ORDER BY auth_user.created_at ASC
  LIMIT 1
  FOR UPDATE;

  -- This RPC is only for incomplete accounts that already have an identity.
  -- It never calls auth.users INSERT and therefore cannot create a duplicate.
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || v_user.id::TEXT));

  SELECT challenge.*
  INTO v_challenge
  FROM public.email_verifications AS challenge
  WHERE challenge.id = v_grant.challenge_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.purpose <> 'signup'
     OR v_challenge.email IS DISTINCT FROM v_grant.normalized_email
     OR v_challenge.verified_at IS NULL
     OR v_challenge.consumed_at IS NULL
     OR v_challenge.used_at IS NULL
     OR v_challenge.completion_token_hash IS NULL THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- Lock every record contributing to the classifier before observing the
  -- canonical state. No existing row is changed except the one corresponding
  -- to the returned earliest missing step.
  PERFORM 1
  FROM public.profiles AS profile
  WHERE profile.user_id = v_user.id
  FOR UPDATE;

  PERFORM 1
  FROM public.user_roles AS user_role
  WHERE user_role.user_id = v_user.id
  FOR UPDATE;

  PERFORM 1
  FROM public.students AS student
  JOIN public.profiles AS profile ON profile.id = student.profile_id
  WHERE profile.user_id = v_user.id
  FOR UPDATE OF student;

  SELECT *
  INTO v_state
  FROM public.get_account_state(v_grant.normalized_email);

  IF NOT FOUND
     OR v_state.user_id IS DISTINCT FROM v_user.id
     OR v_state.normalized_email IS DISTINCT FROM v_grant.normalized_email
     OR v_state.missing_step IN ('identity', 'complete') THEN
    -- Complete accounts remain wholly non-mutating, including the grant.
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  -- The authorized pending grant is consumed before any public account write.
  -- A retry can proceed only when it is already bound to this same identity.
  IF v_grant.status = 'pending' THEN
    UPDATE public.signup_provisioning_grants
    SET status = 'consumed',
        auth_user_id = v_user.id,
        updated_at = v_now
    WHERE id = v_grant.id
      AND status = 'pending'
      AND auth_user_id IS NULL;

    IF NOT FOUND THEN
      RETURN json_build_object('success', FALSE, 'status', 'rejected');
    END IF;
  ELSIF v_grant.auth_user_id IS DISTINCT FROM v_user.id THEN
    RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END IF;

  CASE v_state.missing_step
    WHEN 'profile' THEN
      v_full_name := NULLIF(btrim(COALESCE(p_full_name, '')), '');
      v_phone_number := NULLIF(btrim(COALESCE(p_phone_number, '')), '');

      -- Only the supported email-signup roles can be created through a grant.
      IF v_full_name IS NULL
         OR p_role IS NULL
         OR p_role NOT IN ('student'::public.app_role, 'hostel_owner'::public.app_role)
         OR EXISTS (
           SELECT 1 FROM public.profiles AS profile WHERE profile.user_id = v_user.id
         ) THEN
        RETURN json_build_object('success', FALSE, 'status', 'rejected');
      END IF;

      INSERT INTO public.profiles (
        user_id, full_name, email, phone_number, role, password_set
      ) VALUES (
        v_user.id,
        v_full_name,
        v_grant.normalized_email,
        v_phone_number,
        p_role,
        NULLIF(v_user.encrypted_password, '') IS NOT NULL
      );

    WHEN 'role' THEN
      SELECT profile.*
      INTO v_profile
      FROM public.profiles AS profile
      WHERE profile.id = v_state.profile_id
        AND profile.user_id = v_user.id
      FOR UPDATE;

      -- Do not repair or replace pre-existing role data. Only an account with
      -- zero assignments may receive the one assignment its profile requests.
      IF NOT FOUND
         OR EXISTS (
           SELECT 1 FROM public.user_roles AS user_role WHERE user_role.user_id = v_user.id
         ) THEN
        RETURN json_build_object('success', FALSE, 'status', 'rejected');
      END IF;

      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user.id, v_profile.role);

    WHEN 'password' THEN
      -- The server-side completion route changes auth.users credentials. This
      -- RPC trusts only Auth's credential state, never a client boolean.
      IF NULLIF(v_user.encrypted_password, '') IS NULL THEN
        RETURN json_build_object('success', TRUE, 'next', 'password');
      END IF;

      UPDATE public.profiles
      SET password_set = TRUE
      WHERE id = v_state.profile_id
        AND user_id = v_user.id
        AND password_set = FALSE;

      IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'status', 'rejected');
      END IF;

    WHEN 'student_onboarding' THEN
      IF v_state.role <> 'student'::public.app_role
         OR EXISTS (
           SELECT 1 FROM public.students AS student WHERE student.profile_id = v_state.profile_id
         ) THEN
        RETURN json_build_object('success', FALSE, 'status', 'rejected');
      END IF;

      INSERT INTO public.students (profile_id, status)
      VALUES (v_state.profile_id, 'active');

    ELSE
      RETURN json_build_object('success', FALSE, 'status', 'rejected');
  END CASE;

  SELECT account_state.missing_step
  INTO v_next_step
  FROM public.get_account_state(v_grant.normalized_email) AS account_state;

  -- Do not expose grants, IDs, addresses, codes, hashes, or completion secrets.
  RETURN json_build_object('success', TRUE, 'next', v_next_step);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_existing_signup(UUID, TEXT, TEXT, TEXT, public.app_role)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_existing_signup(UUID, TEXT, TEXT, TEXT, public.app_role)
  TO service_role;

-- The original email_verifications migration granted every browser role table
-- access. Reassert RLS and remove every policy before installing a single
-- deny-all policy, so no stale policy can restore direct challenge access.
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_provisioning_grants ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER functions use public only after it has been made
-- non-writable to browser roles, preventing search-path object shadowing.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('email_verifications', 'signup_provisioning_grants')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY email_verifications_deny_direct_client_access
  ON public.email_verifications
  FOR ALL TO PUBLIC
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY signup_provisioning_grants_deny_direct_client_access
  ON public.signup_provisioning_grants
  FOR ALL TO PUBLIC
  USING (FALSE)
  WITH CHECK (FALSE);

REVOKE ALL ON TABLE public.email_verifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.signup_provisioning_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.email_verifications TO service_role;
GRANT ALL ON TABLE public.signup_provisioning_grants TO service_role;

-- OTP/grant operations are a Next.js service-role boundary. Keep even legacy
-- password-reset and room-request RPCs server-only, because several return
-- transient OTP or reset authority for server-side email delivery.
REVOKE ALL ON FUNCTION public.get_account_state(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_signup_otp(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_signup_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_signup_challenge(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_signup_completion(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_otp(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_password_with_token(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_password_reset_otp(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_password_reset_otp(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_password_with_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_password_reset_otps() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_account_state(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_signup_otp(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_signup_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_signup_challenge(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_signup_completion(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_otp(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps() TO service_role;
GRANT EXECUTE ON FUNCTION public.request_password_reset_otp(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password_reset_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_password_reset_otps() TO service_role;

-- Pin every OTP-related SECURITY DEFINER function to trusted schemas. This
-- prevents caller-controlled search_path objects from affecting privileged SQL.
ALTER FUNCTION public.get_account_state(TEXT) SET search_path = public, auth;
ALTER FUNCTION public.request_signup_otp(TEXT) SET search_path = public, auth;
ALTER FUNCTION public.verify_signup_otp(TEXT, TEXT) SET search_path = public, auth;
ALTER FUNCTION public.invalidate_signup_challenge(UUID) SET search_path = public, auth;
ALTER FUNCTION public.claim_signup_completion(TEXT) SET search_path = public, auth;
ALTER FUNCTION public.complete_existing_signup(UUID, TEXT, TEXT, TEXT, public.app_role)
  SET search_path = public, auth;
ALTER FUNCTION public.request_otp(TEXT, TEXT, UUID) SET search_path = public, auth;
ALTER FUNCTION public.verify_otp(TEXT, TEXT, TEXT) SET search_path = public, auth;
ALTER FUNCTION public.reset_password_with_token(TEXT) SET search_path = public, auth;
ALTER FUNCTION public.cleanup_expired_otps() SET search_path = public, auth;
ALTER FUNCTION public.request_password_reset_otp(TEXT) SET search_path = public, auth;
ALTER FUNCTION public.verify_password_reset_otp(TEXT, TEXT) SET search_path = public, auth;
ALTER FUNCTION public.reset_password_with_token(TEXT, TEXT) SET search_path = public, auth;
ALTER FUNCTION public.cleanup_expired_password_reset_otps() SET search_path = public, auth;

NOTIFY pgrst, 'reload schema';

COMMIT;
