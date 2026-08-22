# Requirements Document

## Introduction

Production Authentication System shall add email one-time-password (OTP) verification to Signup without changing unrelated authentication or room-request behavior. A person must prove control of an email address before Signup creates or completes an account. The feature must retain the existing secure unified OTP capabilities while adding a purpose isolated from password-reset and room-request verification.

## Glossary

- **Production Authentication System**: The application services, database functions, and account-creation logic that process Signup and email OTP verification.
- **Signup**: The registration flow initiated with an email address to create or resume an application account.
- **Signup OTP**: A cryptographically generated, six-digit verification code associated with one normalized email address and the `signup` OTP purpose.
- **OTP Challenge**: The server-side record of one Signup OTP, including the normalized email address, purpose, hash, issue time, expiry time, failed-attempt count, verification state, and consumption state.
- **Normalized Email Address**: An email address after leading and trailing whitespace removal and lowercase conversion.
- **Complete Account**: An account whose authentication identity, profile, role assignment, and required onboarding data are present.
- **Incomplete Account**: An account with an authentication identity or application records for a Normalized Email Address that lacks one or more elements required for a Complete Account.
- **Missing Setup Step**: The earliest required onboarding action whose data is absent for an Incomplete Account.
- **Account-Creation Trigger**: The database trigger that currently creates profile and role records when an authentication identity is inserted.
- **OTP Purpose**: A value that separates OTP Challenges and verification authority by use case, including `password_reset`, `room_request_verification`, and `signup`.

## Requirements

### Requirement 1: Issue Signup OTPs

**User Story:** As a prospective account holder, I want a verification code sent to my email address during Signup, so that Signup can confirm email control before account creation.

#### Acceptance Criteria

1. WHEN Signup receives a valid Normalized Email Address for an email address without a Complete Account, THE Production Authentication System SHALL create one active Signup OTP Challenge with a cryptographically generated six-digit Signup OTP, a hashed Signup OTP, and an expiry time exactly 10 minutes after issuance.
2. WHEN the Production Authentication System creates a Signup OTP Challenge, THE Production Authentication System SHALL deliver the Signup OTP exclusively to the Normalized Email Address associated with the Signup OTP Challenge and SHALL return an issuance status to the client.
3. WHEN Signup receives a request for a Signup OTP less than 1 minute after the most recent Signup OTP issuance for the same Normalized Email Address, THE Production Authentication System SHALL reject the request and preserve the active Signup OTP Challenge set.
4. WHEN Signup receives a request that would create a sixth Signup OTP Challenge for the same Normalized Email Address during the preceding 15 minutes, THE Production Authentication System SHALL reject the request and preserve the active Signup OTP Challenge set.
5. WHEN the Production Authentication System creates a new Signup OTP Challenge for a Normalized Email Address, THE Production Authentication System SHALL invalidate every earlier unverified active Signup OTP Challenge for that Normalized Email Address.
6. WHEN Signup receives a request for a Complete Account, THE Production Authentication System SHALL reject Signup and preserve the existing authentication identity, profile, role assignment, and OTP Challenge set.

### Requirement 2: Verify Signup OTPs

**User Story:** As a prospective account holder, I want to verify a received code, so that I can securely continue Signup.

#### Acceptance Criteria

1. WHEN Signup submits a Signup OTP that matches an active Signup OTP Challenge for the same Normalized Email Address before the expiry time and after fewer than five failed verification attempts, THE Production Authentication System SHALL mark the Signup OTP Challenge verified and authorize exactly one Signup completion for that Normalized Email Address.
2. WHEN Signup submits a Signup OTP that does not match an active Signup OTP Challenge with fewer than four failed verification attempts for the same Normalized Email Address, THE Production Authentication System SHALL increment the failed-attempt count by one and reject the verification.
3. WHEN Signup submits a Signup OTP that does not match an active Signup OTP Challenge with four failed verification attempts for the same Normalized Email Address, THE Production Authentication System SHALL set the failed-attempt count to five, invalidate the active Signup OTP Challenge, and reject the verification.
4. WHEN Signup submits a Signup OTP at or after the expiry time of the active Signup OTP Challenge, THE Production Authentication System SHALL reject the verification and require a new Signup OTP Challenge.
5. WHEN a Signup OTP Challenge has authorized one Signup completion, THE Production Authentication System SHALL consume the Signup OTP Challenge before allowing another Signup completion for the same Signup OTP Challenge.
6. THE Production Authentication System SHALL match, verify, invalidate, and consume Signup OTP Challenges only within the `signup` OTP Purpose.
7. THE Production Authentication System SHALL retain purpose isolation for `password_reset` and `room_request_verification` OTP Challenges.

### Requirement 3: Gate account creation on verified Signup authority

**User Story:** As an application operator, I want account records created only after Signup email verification, so that email verification cannot be bypassed by automatic database provisioning.

#### Acceptance Criteria

1. WHEN Signup receives an unverified request to create an authentication identity, profile, or role assignment, THE Production Authentication System SHALL reject the request.
2. WHEN Signup completes with a consumed verified Signup OTP Challenge for an email address without an Incomplete Account, THE Production Authentication System SHALL create the authentication identity and all account records required for the first Missing Setup Step after verification succeeds.
3. WHEN the Account-Creation Trigger processes an authentication identity created by Signup, THE Production Authentication System SHALL create profile and role records only for a Signup completion authorized by a consumed verified Signup OTP Challenge.
4. IF the Account-Creation Trigger or another account-creation path creates a profile or role assignment without a consumed verified Signup OTP Challenge, THEN THE Production Authentication System SHALL reject the Signup completion and remove the authentication identity, profile, and role assignment created by that unauthorized Signup completion.
5. WHEN Signup completes after successful Signup OTP verification, THE Production Authentication System SHALL preserve the existing profile and role data required by password reset and room-request features.

### Requirement 4: Resume incomplete accounts and reject complete accounts

**User Story:** As a person with an interrupted registration, I want Signup to continue from my actual missing setup step, so that I can finish registration without duplicate account records.

#### Acceptance Criteria

1. WHEN Signup successfully verifies a Signup OTP for an Incomplete Account, THE Production Authentication System SHALL determine the Missing Setup Step from the existing authentication identity, profile, role assignment, and required onboarding data for the Normalized Email Address.
2. WHEN Signup successfully verifies a Signup OTP for an Incomplete Account, THE Production Authentication System SHALL resume Signup at the determined Missing Setup Step and preserve the existing authentication identity, profile, and role assignment.
3. WHEN Signup successfully verifies a Signup OTP for an Incomplete Account with a missing profile, THE Production Authentication System SHALL resume Signup at profile setup.
4. WHEN Signup successfully verifies a Signup OTP for an Incomplete Account with a profile and no role assignment, THE Production Authentication System SHALL resume Signup at role setup.
5. WHEN Signup successfully verifies a Signup OTP for an Incomplete Account with an authentication identity, profile, and role assignment but missing required onboarding data, THE Production Authentication System SHALL resume Signup at the required onboarding-data setup step.
6. WHEN Signup receives a request for a Complete Account, THE Production Authentication System SHALL reject Signup and preserve the existing authentication identity, profile, role assignment, and OTP Challenge set.

### Requirement 5: Protect OTP challenge data

**User Story:** As an application operator, I want Signup OTP data protected from direct access and cross-flow use, so that verification authority remains secure.

#### Acceptance Criteria

1. THE Production Authentication System SHALL store each Signup OTP as a cryptographic hash in persistent OTP Challenge storage.
2. THE Production Authentication System SHALL restrict direct OTP Challenge record access to the Production Authentication System service role.
3. WHEN the Production Authentication System processes a Signup OTP request or verification, THE Production Authentication System SHALL use the Normalized Email Address for rate-limit, challenge, and verification lookups.
4. WHEN the Production Authentication System returns a failed Signup OTP request or verification result, THE Production Authentication System SHALL return an error result that excludes the Signup OTP value, OTP hash, and verification authority token.
