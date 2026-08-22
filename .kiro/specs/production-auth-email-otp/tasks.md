# Implementation Plan: Production Auth Email OTP

## Overview

Implement a server-enforced email signup OTP flow in the existing `/auth/login?tab=signup` tab. Start with a forward-safe Supabase migration that establishes canonical account state, purpose-isolated OTP RPCs, private provisioning grants, and a `BEFORE INSERT` provisioning gate. Then add server-only email/OAuth APIs, update the existing client tab and canonical callback, simplify `AuthProvider`, and validate the safety-critical state transitions. No separate signup page is created.

## Tasks

- [x] 1. Deliver the forward-safe database authorization foundation
  - [x] 1.1 Evolve OTP and grant storage in `supabase/migrations/20260817_production_signup_otp.sql`
    - Backfill a UUID row ID, replace the legacy email primary key, retain historical rows, complete hashed OTP fields, add the `signup` purpose and signup-only completion fields, and remove the legacy plaintext OTP column only after safe backfill.
    - Add private `signup_provisioning_grants`, active/history/completion indexes, constraints, and transactional migration checks that preserve password-reset and room-request data.
    - _Requirements: 1.1, 1.5, 2.6, 2.7, 5.1_
  - [x] 1.2 Implement the canonical `get_account_state(normalized_email)` SQL classifier
    - Normalize with `lower(trim(email))` and return the earliest missing step: identity, profile, role, password, student onboarding, or complete.
    - Use one valid, matching role assignment and the student-row requirement in the complete predicate so later server APIs and the callback have one source of truth.
    - _Requirements: 3.2, 4.1, 4.3, 4.4, 4.5_
  - [x] 1.3 Implement the service-role-only `request_signup_otp` RPC
    - Lock the normalized email/signup challenge set; reject complete accounts, enforce the strict one-minute cooldown and five-in-fifteen-minute cap without mutation, invalidate prior active unverified signup challenges only, create a hashed cryptographic six-digit code, and set database expiry to exactly ten minutes.
    - Return the raw OTP only to the invoking server route and safe challenge metadata for server-side delivery handling.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 5.1, 5.3, 5.4_
  - [x] 1.4 Implement the service-role-only `verify_signup_otp` and invalidation RPCs
    - Match only `purpose = 'signup'`; enforce expiry and the zero-through-four attempt boundary, verify a matching active challenge, and create a short-lived hashed completion secret without returning it to the browser.
    - Ensure invalidation after a Brevo failure affects only the newly issued signup challenge and legacy password-reset/room-request functions retain their purpose filters.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 5.3_
  - [x] 1.5 Implement atomic completion claims, grants, and the `handle_new_user` `BEFORE INSERT` gate
    - Have `claim_signup_completion` lock and consume a verified signup challenge before creating/reusing exactly one pending private grant.
    - Replace unconditional trigger provisioning with a `SECURITY DEFINER` gate that validates grant status, expiry, nonce, normalized email, and linked consumed challenge before atomically creating the identity's profile, matching role, password state, and student row; reject every unauthorized email path before insert.
    - Preserve the separately marked, explicitly authorized Google onboarding path without permitting it to reuse an email-signup grant.
    - _Requirements: 2.1, 2.5, 3.1, 3.3, 3.4, 3.5_
  - [x] 1.6 Implement idempotent incomplete-account completion and database access lockdown
    - Add `complete_existing_signup` to lock canonical state, preserve existing identity/profile/role records, fill only the earliest missing setup step using an authorized consumed grant, and never create a duplicate identity.
    - Enable/retain deny-all client RLS and revoke direct table/function access for OTP challenges and grants; pin `SECURITY DEFINER` search paths and return safe fields only.
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.4_

- [x] 2. Add server-only email and OAuth entry points
  - [x] 2.1 Add typed signup OTP delivery to `lib/email/brevo.ts`
    - Implement `sendSignupOtpEmail` using the existing server-only Brevo transport, sender configuration, and error pattern; send only the six-digit code, normalized recipient, and ten-minute expiry.
    - Do not expose completion authority, hashes, or provider response details in the template or returned error.
    - _Requirements: 1.2, 5.4_
  - [x] 2.2 Implement `POST /api/auth/signup/request-otp`
    - Validate syntax, normalize on the server, call `request_signup_otp` through the service role, deliver only to the RPC-normalized recipient via Brevo, and invalidate the just-created challenge after delivery failure.
    - Return the uniform generic `202` response for all valid syntactic addresses without account, rate-limit, delivery, OTP, hash, or authority disclosure.
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 5.3, 5.4_
  - [x] 2.3 Implement `POST /api/auth/signup/verify-otp`
    - Validate the six-digit request shape, invoke the service-role verification RPC, set only a Secure, HttpOnly, SameSite=Lax, path-scoped `signup_completion` cookie on success, and return generic failure payloads.
    - Do not serialize the OTP, hash, completion secret, challenge identifier, or verification authority.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 5.4_
  - [x] 2.4 Implement `POST /api/auth/signup/complete`
    - Read—not JSON-accept—the completion cookie; claim/reuse its idempotent grant; create a new confirmed email identity through the service-role admin API or resume an existing incomplete account through the RPC.
    - Clear the completion cookie on success and terminal rejection, return only `{ success, next }` or a generic retry/error result, and never create public account records from the browser.
    - _Requirements: 2.5, 3.1, 3.2, 3.4, 4.1, 4.2, 4.6, 5.4_
  - [x] 2.5 Implement `POST /api/auth/oauth-intent`
    - Accept only `login` or `signup`, then issue a short-lived, signed, nonce-bound opaque callback transaction URL using a server-only signing secret.
    - Include no account data and do not permit the browser to append or later trust `isSignup` query state.
    - _Requirements: 3.1, 4.6, 5.4_

- [x] 3. Move remaining onboarding mutations behind authenticated server boundaries where needed
  - [x] 3.1 Audit current role-selection and password-setup writes and add focused authenticated server routes/RPCs for any direct profile, role, password-state, or student mutations
    - Each mutation must derive the caller's canonical missing step server-side, update only the permitted next state, preserve existing records, and reject bypasses.
    - Do not add an endpoint when the existing page already uses an equivalent server-only path; remove any discovered direct client provisioning capability instead.
    - _Requirements: 3.1, 3.2, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 3.2 Update affected onboarding pages to use the audited server endpoint/RPC contract
    - Keep client pages limited to user input, server responses, and explicit navigation; do not recreate profile, role, or student records locally.
    - _Requirements: 3.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Integrate the existing auth UI and canonical Google callback
  - [x] 4.1 Convert the signup tab in `app/auth/login/page.tsx` into request-code, verify-code, and complete stages
    - Preserve `/auth/login?tab=signup`, existing fields, and the `app/signup/page.tsx` redirect alias; keep draft full name, phone, role, and password in component memory only.
    - Call only the new server endpoints, resume the server-returned next step, display generic server errors, and obtain Google redirect URLs from the OAuth intent endpoint rather than client intent/session storage.
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 4.2, 5.4_
  - [x] 4.2 Make `app/auth/callback/route.ts` the sole authoritative Google completion handler
    - Verify and consume the signed callback transaction, exchange the authorization code, call `get_account_state`, and route from the canonical missing step.
    - For signup intent plus a complete account, sign out and clear callback session state before the generic login redirect; for login-complete accounts route to the role dashboard; handle invalid state/exchange failures generically.
    - _Requirements: 3.1, 4.1, 4.2, 4.5, 4.6, 5.4_
  - [x] 4.3 Simplify `lib/auth/context.tsx` to synchronization and user-initiated session actions
    - Retain session/profile refresh on auth, focus, and reload events, but remove email `signUp`, OAuth intent/session-storage state, Google redirects/rejection/sign-out, and all direct profile/role/student provisioning including `ensureStudentRecord`.
    - Treat incomplete sessions as onboarding-only state and leave explicit routing to pages and the callback.
    - _Requirements: 3.1, 3.5, 4.2, 4.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add focused automated coverage for security-critical behavior
  - [ ]* 6.1 Write the SQL/state-machine property harness and Property 1 test for signup challenge issuance
    - **Property 1: Issuance preserves the signup challenge invariant**
    - Build controllable-time fixtures and verify hashed six-digit issuance, exact ten-minute expiry, and replacement of earlier active unverified signup challenges.
    - **Validates: Requirements 1.1, 1.5, 5.1**
  - [ ]* 6.2 Write the Property 2 test for non-mutating signup issuance rate limits
    - **Property 2: Signup issuance rate limits are non-mutating**
    - Generate cooldown and fifteen-minute issuance histories and assert rejected requests preserve active signup challenges.
    - **Validates: Requirements 1.3, 1.4**
  - [ ]* 6.3 Write the Property 3 test for complete-account signup rejection
    - **Property 3: Complete-account signup is non-mutating**
    - Generate complete account snapshots and assert issuance and completion preserve identities, public records, student rows, and OTP challenges.
    - **Validates: Requirements 1.6, 4.6**
  - [ ]* 6.4 Write the Property 4 test for verified OTP claim single-use behavior
    - **Property 4: OTP verification and claim are single-use state transitions**
    - Exercise concurrent/replayed completion claims and assert one consumed provisioning grant before account creation.
    - **Validates: Requirements 2.1, 2.5**
  - [ ]* 6.5 Write the Property 5 test for incorrect-code attempt progression
    - **Property 5: Incorrect codes progress toward invalidation**
    - Cover prior attempt counts zero through four and assert exact increment, five-attempt invalidation, and no completion authorization.
    - **Validates: Requirements 2.2, 2.3**
  - [ ]* 6.6 Write the Property 6 test for OTP-purpose isolation
    - **Property 6: OTP purposes are isolated**
    - Generate mixed signup, password-reset, and room-request histories and assert signup operations modify only signup rows.
    - **Validates: Requirements 2.6, 2.7**
  - [ ]* 6.7 Write the Property 7 test for provisioning-gate rollback
    - **Property 7: Unauthorized provisioning cannot persist account records**
    - Generate invalid grant conditions and assert auth identity, profile, role, and student rows never commit.
    - **Validates: Requirements 3.1, 3.4**
  - [ ]* 6.8 Write the Property 8 test for classifier/resume preservation
    - **Property 8: Missing-step classification and resume preserve existing records**
    - Generate internally consistent account snapshots and assert earliest-step classification, no duplicates, and monotonic advancement after authorized completion.
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 6.9 Write the Property 9 test for normalized-email challenge namespaces
    - **Property 9: Normalization selects one challenge namespace**
    - Generate whitespace/case-equivalent email forms and assert issuance, throttling, verification, and lookup address one signup namespace.
    - **Validates: Requirements 5.3**
  - [ ]* 6.10 Write the Property 10 test for public-response redaction
    - **Property 10: Public failure responses redact authority**
    - Generate failed issuance, verification, and completion outcomes and assert serialized responses contain no OTP, hash, completion secret, grant nonce, or authority field.
    - **Validates: Requirements 5.4**
  - [ ]* 6.11 Add focused route and Brevo tests
    - Mock service-role RPCs and Brevo to verify normalized recipients, delivery-failure invalidation, cookie-only completion authority, generic error payloads, and no secret serialization.
    - _Requirements: 1.2, 2.1, 2.4, 5.3, 5.4_
  - [ ]* 6.12 Add disposable-database migration, RLS, trigger, and legacy-flow integration tests
    - Prove direct client signup/public inserts, grantless trigger paths, replay, and cross-purpose use fail without persisted records; verify service routes work and existing password-reset and room-request paths remain functional.
    - _Requirements: 2.6, 2.7, 3.1, 3.3, 3.4, 5.2_
  - [ ]* 6.13 Add Google callback and AuthProvider synchronization tests
    - Cover signed login/signup transactions, complete-account signup rejection/sign-out, each canonical missing step, second-tab refresh, and the absence of provider provisioning or automatic Google routing.
    - _Requirements: 3.1, 4.1, 4.2, 4.5, 4.6_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; all non-optional tasks establish the production security boundary.
- The SQL migration is deliberately ordered before server/client deployment because it removes unsafe account-creation paths while preserving legacy password-reset and room-request behavior.
- Property tests are isolated by property so each universal rule remains traceable to the design and requirements.
- The implementation retains the existing login/signup tab and `app/signup/page.tsx` redirect alias; it does not add a separate signup page.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.5"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "2.2", "3.1"] },
    { "id": 4, "tasks": ["1.5", "2.3", "3.2"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["2.4", "4.2"] },
    { "id": 7, "tasks": ["4.1", "4.3"] },
    { "id": 8, "tasks": ["6.1"] },
    { "id": 9, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10"] },
    { "id": 10, "tasks": ["6.11", "6.12", "6.13"] }
  ]
}
```
