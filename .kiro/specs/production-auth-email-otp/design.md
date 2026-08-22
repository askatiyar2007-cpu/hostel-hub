# Design Document: Production Auth Email OTP

## Overview

Add a server-enforced email OTP gate to the existing email signup tab at `/auth/login?tab=signup`. The browser may request and submit a code, but it can never create an `auth.users` identity, a profile, a role, or a student row directly. A verified signup OTP yields a short-lived, HttpOnly completion authorization; the server consumes that authorization before any provisioning attempt.

The design deliberately extends the existing `public.email_verifications` storage, existing purpose-separated OTP RPC approach, and `lib/email/brevo.ts` delivery path. It does not add a signup page: `app/signup/page.tsx` remains the existing redirect alias. Password-reset and room-request OTP behavior remain separate by purpose.

The existing Google completion logic is consolidated in one place: `app/auth/callback/route.ts`. The callback is the sole authority for Google account-state classification, onboarding routing, existing-account signup rejection, and callback-session sign-out. `AuthProvider` becomes session/profile synchronization only; it no longer interprets Google signup intent, rejects accounts, signs a Google session out, redirects after Google events, or creates student rows.

## Goals and non-goals

- Require proof of control of a normalized email before email account activation/provisioning.
- Preserve the current login/signup tab and Google entry points; do not add a new signup page.
- Reuse `email_verifications`, Brevo, and the established server/service-role API pattern.
- Define one account-completion predicate for email signup, Google callback routing, protected navigation, and multitab refresh.
- Keep password-reset and room-request OTP data and code paths purpose-isolated.
- Do not change invitation, room-request business behavior, unrelated dashboard behavior, or introduce a client-accessible service-role capability.

## Existing implementation constraints

- `app/auth/login/page.tsx` currently submits email signup through `AuthProvider.signUp`, which calls `supabase.auth.signUp` and writes profile/student records from the client. That is the bypass to remove.
- `lib/auth/context.tsx` currently stores `googleAuthIntent`, performs account-state routing/rejection and sign-out, and creates missing student rows. Those responsibilities are unsafe or non-authoritative in a client provider.
- `app/auth/callback/route.ts` currently has server routing, but trusts `isSignup` in the callback URL and uses a weaker completion check.
- `supabase/migrations/20260816_unified_secure_otp_system.sql` already adds hash, purpose, attempts, `verified_at`, `used_at`, secure RPCs, and a no-client-access RLS policy. Its earlier base migration still makes `email` the primary key, so a forward migration must first make challenge rows historical/multiple-per-email before signup rate limiting can be correct.
- `public.handle_new_user()` currently auto-provisions `profiles` and `user_roles` for every inserted `auth.users` row. That trigger must become an authorization gate, not a default provisioning path.

## Canonical terms and completion classifier

### Email normalization

Every server route and SQL function uses `lower(trim(email))`; client normalization is presentation-only and never authoritative. All signup rate-limit, challenge, account-state, verification, and completion lookups use this value.

### Complete account

`get_account_state(normalized_email)` is the canonical server-side classifier. It produces `complete` plus the earliest `missing_step` from this ordered list:

1. `identity` — no matching `auth.users` identity.
2. `profile` — identity exists but no matching `profiles.user_id` record with the normalized email.
3. `role` — profile exists but lacks exactly one valid `public.app_role` assignment consistent with `profiles.role` in `user_roles`.
4. `password` — a password is required for this flow and `profiles.password_set`/the corresponding trusted auth metadata is not true. Email signup always requires it; the existing Google onboarding policy also requires it before dashboard access, so Google accounts without one go to setup-password.
5. `student_onboarding` — role is `student` but `students.profile_id = profiles.id` is absent.
6. `complete` — an auth identity, profile, valid role assignment, required password state, and, for students, a student row are all present.

This single ordered predicate replaces ad hoc checks of just `profiles.role`, metadata flags, or `students` in the provider and callback. For a verified incomplete account, the completion API resumes at this earliest missing step and preserves all existing identity/profile/role rows. A complete account is never eligible for a signup OTP or completion mutation.

## Architecture and flows

### Components

| Component | Responsibility |
| --- | --- |
| `app/auth/login/page.tsx` | Keeps the existing signup tab and form. It renders draft-details and OTP stages, calls only server APIs, never exposes OTP/auth tokens, and resumes the returned next step. |
| Signup API routes | Validate request shapes, normalize email, call service-role RPCs, call Brevo, own the HttpOnly completion cookie, and make account provisioning server-only. |
| `email_verifications` + SQL RPCs | Store hashed purpose-separated challenges, enforce issue/attempt/rate/expiry/consumption rules under row locks, and produce a short-lived opaque completion authority. |
| `signup_provisioning_grants` | Server-only, one-per-consumed-challenge handoff used to bind a completion claim to one `auth.users` insert and make retry idempotent. |
| `handle_new_user` trigger | A `BEFORE INSERT` gate on `auth.users`: validates the private grant, atomically creates profile/role/student data, or raises so the complete transaction rolls back. |
| `lib/email/brevo.ts` | Existing server-only Brevo transport, extended with `sendSignupOtpEmail`; it is the only delivery implementation. |
| `app/auth/callback/route.ts` | Authoritative server-side Google exchange, account-state classification, rejection/session cleanup, and destination selection. |
| `AuthProvider` | Observes auth session changes, fetches profile state, exposes refresh and user-initiated session actions. It does not provision, infer OAuth intent, or route/reject Google users. |

### Email signup OTP sequence

1. The existing signup tab validates its local fields, then calls `POST /api/auth/signup/request-otp` with only `email`. It keeps full name, phone, role, and password only in component memory; password is never placed in `sessionStorage`, an OTP request body after issuance, logs, URL parameters, or a cookie.
2. The route validates email syntax, normalizes it, and calls `request_signup_otp(p_email)`, using `supabaseServer`. The SQL function locks the email/purpose challenge set, first evaluates the canonical account state, enforces one-minute cooldown and fewer than five issuances in fifteen minutes, invalidates earlier active unverified **signup** challenges, generates a cryptographic six-digit code, hashes it with `digest`, and stores expiry exactly `now() + interval '10 minutes'`.
3. The function returns the plaintext code only to this server route. The route calls `sendSignupOtpEmail({ email: normalizedEmail, otp })`. No response, log, or client state includes the code/hash/authority. If Brevo cannot deliver, the route calls a server-only invalidation RPC for that newly issued challenge and still emits a generic response.
4. `POST /api/auth/signup/verify-otp` accepts `email` and six-digit `otp`, calls `verify_signup_otp`, and on a valid unexpired challenge with 0–4 prior failures marks it verified and creates a random 256-bit completion secret. Only its hash and a short completion expiry are persisted. The raw secret is written as `signup_completion` in a Secure, HttpOnly, SameSite=Lax, path-scoped cookie and is never JSON-returned.
5. The UI enters its final confirmation step and sends the original form details to `POST /api/auth/signup/complete`. That route reads the HttpOnly cookie; it does not accept an authorization token from JSON.
6. `claim_signup_completion` locks the verified signup challenge by completion-secret hash. Its first successful call records `used_at`/`consumed_at` **before** permitting provisioning and creates exactly one private provisioning grant. Concurrent/replayed calls cannot get a second grant. The same cookie may retry the already-created pending grant after a transient server/Auth failure, preserving idempotency while still prohibiting another completion authorization.
7. For `identity`, the route calls `supabaseServer.auth.admin.createUser` with `email_confirm: true`, the supplied password, and trusted metadata containing only the grant ID and a random grant nonce plus needed profile fields. `email_confirm: true` is never set before a verified, consumed signup authorization. The `BEFORE INSERT` trigger validates and consumes that grant in the same database transaction as the identity insert; it writes profile, one role assignment, `password_set = true`, and the student row when role is student. Invalid/missing/expired/reused/wrong-email grants raise before insertion, leaving no auth identity or public records.
8. For an already-existing incomplete identity, the complete route calls a service-role-only `complete_existing_signup` RPC using that same consumed challenge/grant. It locks the classified account state, fills only the earliest missing step (and may advance through already-supplied, required data), and preserves pre-existing records. It never creates a duplicate identity. Any password set is performed server-side with the service role only after the claim; public-table updates are in the RPC transaction.
9. On completed provisioning, the route clears the completion cookie, returns only `{ success: true, next }`, and the client refreshes session/profile state before navigating. On a resumable server failure, the route returns a generic retry result without minting another authority.

### OTP state rules

- Challenge queries and mutations always include `purpose = 'signup'`; they neither read nor write `password_reset` or `room_request_verification` rows.
- A code at expiry is invalid (`expires_at <= now()`). A wrong code against an active challenge at attempts 0–3 increments exactly once. A wrong code at attempts 4 sets attempts to 5 and invalidates/uses the challenge in the same locked update.
- Verification marks the challenge verified but does not expose a reusable token. Completion claim atomically consumes it before a provisioning grant is made.
- Issuance cooldown is strict for requests made less than one minute after the latest signup issue. The fifteen-minute cap rejects the would-be sixth issue; both rejection cases leave active challenge rows unchanged. A successful newer issuance invalidates all earlier active/unverified signup rows for that normalized email.
- Full completion status is evaluated before issuance and completion. A complete account is logically rejected and left entirely unchanged.

### Server responses and account-enumeration safety

Request issuance uses a uniform `202 { "status": "accepted", "message": "If signup can continue, a verification code will be sent." }` for valid syntactic emails, including complete-account, cooldown, rate-limit, and delivery-failure cases. It must not disclose whether an identity exists or whether an email was sent. Invalid request syntax can return a normal `400` because it reveals no account state.

Verification and completion use generic client messages such as `"The code is invalid, expired, or cannot be used."` and `"Signup could not be completed. Please try again or sign in."` for account-state/authority failures. Routes never include OTP, OTP hash, completion secret, provisioning-grant ID/nonce, service errors, or a differentiating `user_exists` field. Server logs use challenge IDs/correlation IDs, not code or token values.

## OAuth routing and session synchronization

### Authoritative callback contract

Google buttons call a new server endpoint `POST /api/auth/oauth-intent` with `intent: 'login' | 'signup'`. It returns a short-lived, signed, opaque callback transaction URL; the value contains an expiry and nonce, is integrity-protected with a server secret, and carries no account data. `signInWithOAuth` uses that URL as `redirectTo`; it does not append/trust `?isSignup=`, and the client does not use `sessionStorage` for intent. This avoids query tampering and lets concurrent tabs carry distinct callback transactions.

`app/auth/callback/route.ts` is the only location that:

1. verifies callback transaction authenticity/expiry and clears the one-time intent;
2. exchanges the authorization code and reads the authenticated identity;
3. obtains canonical account state from `get_account_state`;
4. for signup intent plus a complete account, signs out the callback session server-side, clears callback cookies, and redirects to generic `/auth/login?tab=login&reason=signin`;
5. for incomplete/no-profile Google accounts, routes to the server-derived earliest missing step (normally `/auth/select-role`, then `/auth/setup-password`, with student provisioned server-side when role is chosen);
6. for a complete login, routes to the role dashboard; and
7. for invalid callback state or exchange failure, redirects to a generic login error.

The callback does not trust role/password flags supplied by the browser. The same `get_account_state` predicate determines all branches, including the student-row requirement. If the current product keeps password setup mandatory for Google accounts, a Google identity with no password deterministically goes to `/auth/setup-password`; otherwise that requirement can be turned off in one classifier policy, not scattered in UI logic.

### AuthProvider boundary and multitab refresh

`AuthProvider` subscribes to Supabase session changes and fetches the current profile/derived account state. It may expose `refreshAuthState()` and user-initiated `signOut()`, but it has no Google intent state, no `existingGoogleSignupRejected`, no rejection refs, no Google-triggered sign-out, no automatic onboarding/dashboard routing, no `signUp`, and no `ensureStudentRecord` or direct profile/role/student writes. Page actions and the callback own explicit navigation; all provisioning remains server-side.

A `TOKEN_REFRESHED`, `SIGNED_IN`, or focus/reload event fetches fresh canonical profile state. The UI treats a session with incomplete state as onboarding-only and never creates missing rows locally. A second tab observing a consumed completion cookie/auth state only refreshes; it cannot replay provisioning. Callback transactions are nonce-bound, and completion claims are row-locked/idempotent, so competing tabs can result in one completion winner without duplicated identities/roles/students.

## Database design and security

### `email_verifications` extension

The new migration evolves the existing table rather than making a second OTP table.

- Backfill a generated `id uuid` for existing rows, replace the legacy `email` primary key with `PRIMARY KEY (id)`, and retain a non-unique email index. This is necessary because signup needs issuance history and invalidated prior challenges.
- Retain/complete existing fields: `email`, `purpose`, `otp_hash`, `attempts`, `created_at`, `expires_at`, `verified_at`, and `used_at`. Drop the obsolete plaintext `otp` column after the existing hash backfill; no new code reads or writes it.
- Add `completion_token_hash`, `completion_expires_at`, and `consumed_at` (or consistently use `used_at` as the consumed timestamp) solely for `signup`; add constraints so these are absent for other purposes and a `CHECK`/enum-style purpose allowlist includes `signup`, `password_reset`, and `room_request_verification`.
- Add `(email, purpose, created_at desc)`, a partial active-challenge index, and a completion-token hash index. The locked SQL functions remain the source of truth rather than client-side uniqueness assumptions.

### Provisioning gate

`signup_provisioning_grants` is private operational state with `id`, `challenge_id UNIQUE`, `normalized_email`, `nonce_hash`, `status` (`pending`, `consumed`, `failed`), `expires_at`, `auth_user_id UNIQUE NULL`, and timestamps. Only `SECURITY DEFINER` RPCs and the trigger access it. The browser never receives its ID or nonce.

`handle_new_user` changes from an unconditional `AFTER INSERT` provisioner to a `BEFORE INSERT` `SECURITY DEFINER` gate:

- A regular Google creation follows the existing explicitly allowed Google onboarding path, marked by a separate server-created trusted flow marker if needed; it must not accidentally reuse email signup grants.
- An email signup must have `raw_user_meta_data.signup_grant_id` and nonce supplied only by the server-side admin route. The trigger locks the grant, verifies pending status, unexpired time, normalized email match, nonce hash, and the linked verified/consumed `signup` challenge, then marks the grant consumed by `NEW.id`.
- It creates the profile, one matching `user_roles` row, and a `students` row for a student in the same transaction. The email/password completion writes `password_set = true` consistently to trusted metadata/profile.
- Any non-Google/non-authorized new identity raises an exception before insert. This is stronger than post-insert cleanup: the identity, profile, role, and student rows never commit. The service API additionally reconciles a rare post-claim Auth response by re-reading the bound grant/user rather than issuing a second grant.

### RLS and privileges

Keep RLS enabled on `email_verifications` and use a deny-all policy for `anon` and `authenticated`; revoke direct table grants and all public/anonymous execution on signup/password-reset/room-request OTP functions. The Next.js server calls them through `SUPABASE_SERVICE_ROLE_KEY` only. `signup_provisioning_grants` has no client policies/grants. `SECURITY DEFINER` functions pin `search_path = public, auth` (or fully qualify every relation), validate all parameters, and return only safe JSON fields. Public profile/role/student RLS policies must not grant the client a path to create account records; role selection/password setup changes are moved to authenticated server endpoints/RPCs that first confirm the session's derived missing step.

## API contracts

| Endpoint | Request | Server work | Response |
| --- | --- | --- | --- |
| `POST /api/auth/signup/request-otp` | `{ email }` | Validate/normalize; `request_signup_otp`; Brevo delivery; invalidate undelivered challenge | Generic 202 accepted, never secret fields |
| `POST /api/auth/signup/verify-otp` | `{ email, otp }` | `verify_signup_otp`; set short-lived HttpOnly `signup_completion` cookie on success | `{ success: true }` or generic error |
| `POST /api/auth/signup/complete` | `{ fullName, phone, password, role }` | Read completion cookie; claim once; create/resume only via service-role API/RPC; clear cookie when terminal | `{ success, next }`, never grant/token/OTP fields |
| `POST /api/auth/oauth-intent` | `{ intent }` | Issue signed, expiring nonce-bound callback URL | `{ redirectTo }` |
| Existing callback `GET /auth/callback` | Supabase code plus signed callback transaction | Exchange session, derive canonical state, server-route/possibly sign out | Redirect only |

Relevant SQL APIs are `get_account_state(p_email)`, `request_signup_otp(p_email)`, `verify_signup_otp(p_email, p_otp)`, `claim_signup_completion(p_completion_secret)`, `complete_existing_signup(...)`, and `invalidate_signup_challenge(p_challenge_id)`. Existing `request_otp`, `verify_otp`, and `reset_password_with_token` remain compatible for password reset and room request; they must retain their existing purpose filters and must not accept `signup` except through the dedicated server functions.

## Exact file changes

The five existing files changed by this feature are:

1. **`app/auth/login/page.tsx`** — keep the current tabs and fields; replace `useAuth().signUp` submission with a staged request-code/verify-code/complete flow. Keep Google buttons, but obtain a server-issued callback URL first. Remove client display/state for Google signup rejection; show generic server/callback messages instead. Do not create another signup page.
2. **`app/auth/callback/route.ts`** — remove `isSignup` query trust and all duplicated partial-state checks. Verify the server-issued OAuth transaction, call the canonical account-state RPC, perform all Google signup/login routing and any rejection session sign-out here.
3. **`lib/auth/context.tsx`** — remove `signUp`, Google intent/sessionStorage logic, rejected-account refs/state, Google callback navigation, direct profile/role/student provisioning, and `ensureStudentRecord`. Retain session/profile subscription, refresh, and explicit user-initiated sign-out behavior only.
4. **`lib/email/brevo.ts`** — add a typed `sendSignupOtpEmail` built on the existing server-only Brevo API/key/sender/error pattern. The template contains the six-digit code, normalized recipient, 10-minute expiration, and no sensitive server authority.
5. **`supabase/migrations/20260817_production_signup_otp.sql`** — forward migration that evolves `email_verifications`, adds private grants and indexes, replaces/extends OTP RPCs, replaces `handle_new_user`, locks down grants/RLS/execution, and refreshes schema cache.

New, focused server routes are `app/api/auth/signup/request-otp/route.ts`, `app/api/auth/signup/verify-otp/route.ts`, `app/api/auth/signup/complete/route.ts`, and `app/api/auth/oauth-intent/route.ts`. If role/password pages currently write public account rows directly, add small authenticated server endpoints for those writes rather than restoring client provisioning. `app/signup/page.tsx` remains unchanged as the existing redirect alias.

## Migration sequencing and rollout

1. Deploy the forward SQL migration first in a transaction where possible: backfill/hash legacy OTP data; add a row ID before dropping the email primary key; preserve old password-reset/room-request rows and indexes; add `signup` purpose and new private grant state; then replace functions/trigger and revoke unsafe grants. Validate no duplicate/invalid legacy email keys before changing the primary key.
2. Verify, in a staging database, that existing password-reset and room-request APIs still call their purpose-specific functions successfully and direct client table access fails.
3. Deploy server routes and the Brevo helper. Ensure `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, and the OAuth intent-signing secret are server-only environment values; add the final callback URL to Supabase/Google allowlists.
4. Deploy client/context/callback changes together so the old client `signUp` path is gone before signup UI can call the new completion endpoint. Avoid a period where the trigger denies new email users but the old browser still calls `supabase.auth.signUp`.
5. Observe generic request/verification/claim failure metrics, delivery failures, trigger rejections, and incomplete-account resumes without logging codes/tokens. Rollback application code only after keeping the database gate in place; do not re-enable direct client account creation to roll back UI.

## Error handling and recovery

- Invalid fields get actionable validation errors; account existence, rate limits, delivery, expired/incorrect code, and bad authorities get generic, non-enumerating messages.
- The database clock, not the browser clock, decides cooldown and expiry. SQL functions serialize a same-email/purpose state transition with row/advisory locking to prevent concurrent resend/verify/claim races.
- Brevo failure invalidates the unsent challenge server-side. A delivery provider response is never passed through to the client.
- If the grant was claimed but Supabase Auth creation has a timeout, retry only with the same completion cookie. The server reuses the same pending grant and checks its bound `auth_user_id`/email rather than generating a second account or token.
- On successful completion the cookie is cleared and other tabs refresh profile state. On expiration or terminal rejection the cookie is cleared; the person must request/verify a new code.

## Correctness Properties

*A property is a behavior that holds across all valid executions. These properties are executable specifications for the pure SQL/state-machine layer; endpoint and provider integration behavior is covered by focused examples and integration tests.*

### Property 1: Issuance preserves the signup challenge invariant

For all valid normalized emails that do not have a complete account and all issuance histories that are outside the cooldown and fifteen-minute cap, issuing a signup OTP creates one new active `signup` challenge with a cryptographically generated six-digit code represented only by a hash, expiry exactly ten minutes after the database issue time, and no older active/unverified signup challenge for that email.

**Validates: Requirements 1.1, 1.5, 5.1**

### Property 2: Signup issuance rate limits are non-mutating

For all normalized emails and signup challenge histories, a request made less than one minute after the latest issuance or that would be the sixth issuance in fifteen minutes is rejected and leaves every active signup challenge unchanged.

**Validates: Requirements 1.3, 1.4**

### Property 3: Complete-account signup is non-mutating

For all account states satisfying the canonical complete predicate, signup issuance or completion is rejected without changing the authentication identity, profile, role assignment, student row, or OTP challenges.

**Validates: Requirements 1.6, 4.6**

### Property 4: OTP verification and claim are single-use state transitions

For all active unexpired signup challenges with fewer than five failures, a matching code verifies the challenge, and any number of concurrent or replayed completion claims authorize exactly one consumed provisioning grant before any account creation is permitted.

**Validates: Requirements 2.1, 2.5**

### Property 5: Incorrect codes progress toward invalidation

For all active unexpired signup challenges and any nonmatching code, verification increments attempts exactly once while the prior count is 0 through 3; when the prior count is 4, verification sets it to 5, invalidates the challenge, and never authorizes completion.

**Validates: Requirements 2.2, 2.3**

### Property 6: OTP purposes are isolated

For all mixed-purpose challenge histories sharing an email, signup issuance, verification, invalidation, and consumption modify only rows whose purpose is `signup` and preserve `password_reset` and `room_request_verification` rows.

**Validates: Requirements 2.6, 2.7**

### Property 7: Unauthorized provisioning cannot persist account records

For all absent, unverified, expired, consumed, wrong-purpose, wrong-email, or invalid-nonce signup grants, every identity/profile/role creation path is rejected and the resulting transaction contains no new authentication identity, profile, role assignment, or student record.

**Validates: Requirements 3.1, 3.4**

### Property 8: Missing-step classification and resume preserve existing records

For all internally consistent account-state snapshots, the classifier returns the earliest missing setup step from the canonical ordering; applying an authorized completion for that step preserves existing identity/profile/role data, creates no duplicates, and advances only toward completion.

**Validates: Requirements 4.1, 4.2**

### Property 9: Normalization selects one challenge namespace

For all email strings equivalent after leading/trailing whitespace removal and lowercase conversion, issuance, rate-limit, verification, and lookup operations address the same normalized signup challenge set.

**Validates: Requirements 5.3**

### Property 10: Public failure responses redact authority

For all failed signup issuance, verification, and completion outcomes, the serialized client response contains no OTP value, OTP hash, completion secret, grant nonce, or verification authority field/value.

**Validates: Requirements 5.4**

## Property reflection

The prework identified 1.6 and 4.6 as the same complete-account non-mutation rule; they are intentionally consolidated in Property 3. Requirements 2.6 and 2.7 are two sides of purpose isolation and are consolidated in Property 6. The related issuance/hash/expiry/invalidation facts are consolidated in Property 1, while cooldown/cap non-mutation remains independently valuable in Property 2. The profile/role/student resume examples remain example tests rather than duplicate properties because Property 8 already universally covers their classifier and preservation rule.

## Test strategy

### Unit and property tests

- Extract SQL-independent helpers for normalized-email validation, missing-step classification, callback transaction validation, and response redaction. Run each property above for at least 100 generated cases and tag tests as `Feature: production-auth-email-otp, Property N: <title>`.
- Property-test SQL RPC behavior with an isolated schema/database fixture and controllable database time where available: issuance history, exact expiry, retries, attempt boundaries, mixed purposes, concurrent claims, and trigger rollback.
- Add focused example tests for expiry exactly-at-boundary; attempt-four lockout; identity-without-profile -> profile setup; profile-without-role -> role setup; student profile/role without a students row -> student onboarding; and password-missing -> password setup.
- Unit-test route schemas and mocks: the request route calls `sendSignupOtpEmail` only with the normalized challenge email, never serializes secret fields, and invalidates a failed delivery challenge; completion reads the HttpOnly cookie instead of request JSON.

### Integration and smoke tests

- In a disposable Supabase test project, prove that a verified email completion creates one `auth.users` record with confirmed email, profile, matching `user_roles`, password state, and one student row for a student; prove service role retry is idempotent.
- Attempt direct client `auth.signUp`, direct profile/role/student inserts, trigger calls without grant, replayed completion, and cross-purpose OTP use. Each must fail with no persisted unauthorized records.
- Smoke-test RLS/grants as `anon` and `authenticated` against `email_verifications` and grants; both have no direct access, while server-service RPCs work. Smoke-test existing password reset and room request flows after the migration.
- Integration-test Brevo through a mocked transport for recipient/content/redaction and perform one controlled staging delivery before production.
- Exercise Google callback cases with signed transactions: login complete, signup complete (callback signs out and routes login), no profile, missing role, missing password, and student missing row. Refresh in a second tab after each case to verify the provider only synchronizes state and does not provision or reroute.
