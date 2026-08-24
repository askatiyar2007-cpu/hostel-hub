# Requirements Document

## Introduction

This feature improves the visual design and completes the backend integration of six existing Owner Dashboard areas in HostelHub: Hostel Management, Room Management, Room Requests/Approve Allocation, Student Management/Assign Student, Complaints (student and owner sides), and Settings (Notifications and Change Password). The Owner Dashboard shell (sidebar, header, routing, authentication/authorization) is explicitly out of scope and must not be modified. All changes must reuse existing Supabase tables, RPCs, hooks, and RLS policies wherever they already provide the required behavior; new backend surface area (columns, policies, RPCs) is added only where investigation confirmed no existing mechanism satisfies a requirement.

## Glossary

- **Owner Dashboard Shell**: The persistent sidebar, header, and route-level authentication/authorization wrapper (`app/owner/layout.tsx`, `components/dashboard-layout.tsx`) shared by every owner page. Out of scope for this feature.
- **Hostel**: A row in `public.hostels`, owned by an authenticated user with role `owner`/`hostel_owner` via `owner_id`.
- **Room**: A row in `public.rooms`, belonging to one Hostel via `hostel_id`.
- **Room Request**: A row in `public.room_requests` representing a student's request for a Room, with status `pending`, `approved`, or `rejected`.
- **Room Allocation**: A row in `public.room_allocations` representing an active or historical assignment of a Student to a Room, created when a Room Request is approved or when an owner performs a manual assignment.
- **Booking Type**: The `public.booking_type` enum value on a Room Request or Room Allocation, with underlying values `shared_bed` and `entire_room`.
- **Entire Shared Room Booking**: The user-facing label for `booking_type = 'shared_bed'`. The underlying enum value is unchanged; only the displayed label changes from "Shared Bed" to "Entire Shared Room" in the Assign Student and Room Request UIs.
- **Entire Room Booking**: The user-facing label for `booking_type = 'entire_room'`, already displayed as "Entire Room" throughout the codebase.
- **Assign Student Flow**: The owner-initiated manual student assignment page (`app/owner/students/new/page.tsx`) and its backing endpoint (`/api/owner/students/assign`) and RPC (`create_manual_assignment_with_invite`).
- **Complaint**: A row in `public.complaints`, linked to a Student via `student_id` and to a Hostel via `hostel_id`.
- **Notification Preference**: A per-owner setting controlling whether the Owner Dashboard surfaces new-room-request and new-complaint notifications. Persisted via Supabase Auth `user_metadata`, matching the existing pattern already used on the Student Settings page.
- **Rejected Room Request Deletion**: A hard database deletion of a Room Request row whose `status = 'rejected'`, initiated only by the owner of the associated Hostel.

## Requirements

### Requirement 1: Hostel section visual and UX improvements

**User Story:** As a hostel owner, I want the Hostel management pages to look and feel professional and production-ready, so that I can manage my properties with confidence and clarity.

#### Acceptance Criteria

1. WHEN an owner views the Hostels list, Add Hostel, Edit Hostel, or Hostel Details pages THEN the Production Application SHALL render each page using the application's existing design tokens (colors, typography, spacing, border radius, card, button, and input styles) without introducing a new visual language.
2. WHEN an owner views the Hostels list with zero hostels THEN the Production Application SHALL display an empty state with guidance to add the first hostel, without any placeholder or mock hostel data.
3. WHEN an owner views the Hostels list while data is loading THEN the Production Application SHALL display a loading state distinct from the empty state.
4. WHEN a hostel create, update, or delete operation fails THEN the Production Application SHALL display an error state derived from the actual Supabase error, without exposing raw stack traces.
5. WHEN a hostel create, update, or delete operation succeeds THEN the Production Application SHALL display success feedback and SHALL reflect the change after a data refresh from Supabase.
6. WHEN an owner deletes a hostel THEN the Production Application SHALL require an explicit confirmation step before the deletion request is sent to Supabase.
7. WHEN an owner views the Hostels list with two or more hostels THEN the Production Application SHALL render each hostel in a visually separated container so hostels are not visually merged.

### Requirement 2: Add Hostel form field accuracy

**User Story:** As a hostel owner, I want the Add Hostel form to only ask for fields that are actually used, so that I am not confused by irrelevant inputs.

#### Acceptance Criteria

1. WHERE the "Starting Rent" input is not read by any Edit Hostel form, public hostel listing, or booking calculation other than the owner's own dashboard summary card, THE Production Application SHALL remove the "Starting Rent" input from the Add Hostel form.
2. WHEN an owner submits the Add Hostel form after the "Starting Rent" input is removed THEN the Production Application SHALL persist the new hostel row without supplying `starting_price` in the insert payload, relying on the existing database default.
3. THE Production Application SHALL NOT remove, rename, or alter the `hostels.starting_price` column, and SHALL NOT alter any existing hostel row's `starting_price` value.
4. THE Production Application SHALL NOT remove the display of `starting_price` on the owner dashboard summary card that already reads it.

### Requirement 3: Hostel and Room zero-value display accuracy

**User Story:** As a hostel owner, I want to see meaningful numbers in the Hostel and Room views, so that zero values are only shown when they are actually informative.

#### Acceptance Criteria

1. WHEN a hostel's `rating` or `total_reviews` is its unset default of zero AND the hostel has never received a review THEN the Production Application SHALL omit the rating/review-count display on that hostel's card rather than showing "0".
2. WHEN a room's real committed occupancy (active, non-cancelled allocations) is genuinely zero THEN the Production Application SHALL display "0 occupied" as accurate, informative data, not omit it.
3. THE Production Application SHALL NOT alter the underlying numeric value of `rooms.capacity`, `rooms.occupied_count`, `rooms.occupancy`, `rooms.rent`, `rooms.security_deposit`, or `hostels.starting_price` as part of any display-only change.

### Requirement 4: Room section visual and UX improvements

**User Story:** As a hostel owner, I want the Room management pages to look and feel professional, so that I can manage rooms across hostels with clarity.

#### Acceptance Criteria

1. WHEN an owner views the Rooms list, Add Room, or Edit Room pages THEN the Production Application SHALL render each page using the application's existing design tokens, matching Requirement 1's visual consistency rule.
2. WHEN an owner opens the Add Room form THEN the Production Application SHALL render the Hostel selector as a visually prominent, clearly labeled control, not a visually minor or easily overlooked element.
3. WHEN an owner views the Rooms list with zero rooms for the selected hostel filter THEN the Production Application SHALL display an empty state distinct from the loading state.
4. WHEN a room create, update, or delete operation fails or succeeds THEN the Production Application SHALL display feedback consistent with Requirement 1's error/success feedback rules.

### Requirement 5: Room capacity field retention

**User Story:** As a hostel owner, I want room capacity to remain an explicit, reliable input, so that bed records are generated correctly.

#### Acceptance Criteria

1. WHERE `rooms.capacity` directly determines the number of `beds` rows created on room insert AND no existing database trigger, function, or derivation rule computes capacity from room type or any other field, THE Production Application SHALL retain the Capacity input as a required field on the Add Room and Edit Room forms.
2. WHEN an owner selects a Room Type on the Add Room form THEN the Production Application MAY visually group the Capacity input adjacent to the Room Type input for improved layout, but SHALL NOT remove, hide, or auto-submit a capacity value without owner-visible confirmation.

### Requirement 6: Room Requests visual separation and detail completeness

**User Story:** As a hostel owner, I want each room request to be clearly separated and show complete applicant information, so that I can make accurate approval decisions.

#### Acceptance Criteria

1. WHEN an owner views Pending Requests, Approved Allocations, or Rejected Requests THEN the Production Application SHALL render each request or allocation in its own visually distinct card or row, never merged with another request's content.
2. WHEN an owner views a room request's details THEN the Production Application SHALL display the student's name, contact information, requested hostel, requested room and booking type, request date, and current status.
3. WHEN a room request or allocation record has emergency contact data available from `room_requests.emergency_contact`, `emergency_contact_name`, or `emergency_contact_phone` THEN the Production Application SHALL display that emergency contact information in the request/allocation details without hardcoding a placeholder value.
4. WHEN a room request or allocation record has parent/guardian data available from `room_requests.parent_name`, `parent_phone`, or `parent_email` THEN the Production Application SHALL continue to display that information in the Student Details/request details view.
5. THE Production Application SHALL NOT duplicate the same field (for example emergency contact) twice within a single details view when a single combined representation already exists.

### Requirement 7: Placeholder QR removal from Room Requests workflow

**User Story:** As a hostel owner, I want the room request and allocation workflow free of non-functional QR placeholders, so that the interface only shows real, working actions.

#### Acceptance Criteria

1. WHEN an owner views an Approved Allocation card or the Student Profile page's action list THEN the Production Application SHALL NOT display the placeholder "Digital Check-In QR" button or its associated modal.
2. THE Production Application SHALL NOT remove or alter the unrelated, functioning payment QR feature backed by `payment_methods.qr_code_url` on the Settings → Payment Methods page or the student billing pages.
3. WHEN the placeholder QR button and modal are removed from the Room Requests workflow AND the Student Profile page THEN the Production Application SHALL continue to render the Agreement, Payment History, and other existing actions on the same cards without regression.

### Requirement 8: Rejected room request deletion

**User Story:** As a hostel owner, I want to permanently remove rejected room requests I no longer need, so that my request list stays manageable.

#### Acceptance Criteria

1. WHEN an owner requests deletion of a room request whose `status = 'rejected'` AND the room request belongs to a hostel owned by that owner THEN the Production Application SHALL permanently delete the row from `public.room_requests` in Supabase.
2. WHEN an owner requests deletion of a room request that is not in `rejected` status THEN the Production Application SHALL reject the deletion and SHALL NOT delete the row.
3. WHEN an owner requests deletion of a room request belonging to a hostel that owner does not own THEN the Production Application SHALL reject the deletion at the database policy level, independent of any client-side check.
4. WHEN an owner confirms deletion of a rejected room request THEN the Production Application SHALL require an explicit confirmation step before sending the delete request.
5. WHEN a rejected room request deletion succeeds THEN the Production Application SHALL refresh the Rejected Requests list from Supabase so the deleted row no longer appears.
6. THE Production Application SHALL implement the deletion using a real Supabase delete operation gated by Row Level Security, not a client-side-only list filter.

### Requirement 9: Student Management hostel selector consistency

**User Story:** As a hostel owner, I want the hostel selector in Student Management to look and behave like other hostel selectors in the application, so the experience feels consistent.

#### Acceptance Criteria

1. WHEN an owner opens the Students list hostel filter or the Assign Student form's Hostel selector THEN the Production Application SHALL render it with the same visual treatment (labeling, sizing, focus state) as the improved Hostel selector used in the Add Room form.
2. THE Production Application SHALL NOT change which hostels are selectable or how the student-hostel relationship is queried as part of this visual consistency change.

### Requirement 10: Booking type terminology update in Assign Student and Room Request

**User Story:** As a hostel owner or student, I want booking option labels to say "Entire Room" and "Entire Shared Room" so the terminology matches the current business model.

#### Acceptance Criteria

1. WHEN an owner views the Assign Student form's Booking Option control THEN the Production Application SHALL label the `shared_bed` option as "Entire Shared Room" and the `entire_room` option as "Entire Room".
2. WHEN a student views the Room Request flow's Booking Option control THEN the Production Application SHALL label the `shared_bed`/`shared` option as "Entire Shared Room" and the `entire_room` option as "Entire Room".
3. WHEN any existing UI already displays a booking type value (for example on Room Request cards, Approved Allocation cards, or the Details modal) THEN the Production Application SHALL display "Entire Shared Room" wherever the underlying value is `shared_bed`, and "Entire Room" wherever the underlying value is `entire_room`.
4. THE Production Application SHALL NOT rename, add, or remove any value in the `public.booking_type` enum.
5. THE Production Application SHALL NOT change the parameter names, types, or accepted values of `create_manual_assignment_with_invite`, `approve_room_request`, or any other existing RPC as part of this labeling change.
6. WHEN an owner assigns a student using either booking option THEN the Production Application SHALL continue to persist the correct underlying `shared_bed` or `entire_room` enum value to `room_allocations.booking_type` and `room_requests.booking_type`, unchanged from current behavior.

### Requirement 11: Complaints shared backend integrity

**User Story:** As a student or hostel owner, I want complaints to flow reliably between the Student Dashboard and Owner All Complaints view, so that issues are tracked accurately.

#### Acceptance Criteria

1. WHEN a student submits a complaint THEN the Production Application SHALL insert exactly one row into `public.complaints` associated with that student's `auth.users.id` and the correct `hostel_id`.
2. WHEN a student views their complaints on the Student Dashboard/Complaints page THEN the Production Application SHALL retrieve complaints filtered by that same student identifier used at creation time, so newly created complaints are visible without ambiguity.
3. WHEN a hostel owner views All Complaints THEN the Production Application SHALL retrieve every complaint whose `hostel_id` belongs to a hostel owned by that owner.
4. WHEN an owner changes a complaint's status THEN the Production Application SHALL persist the status change to `public.complaints.status` via a real Supabase update operation.
5. WHEN a student reloads their Complaints page after an owner has changed a complaint's status THEN the Production Application SHALL display the updated status.
6. THE Production Application SHALL rely on Row Level Security policies granting exactly: a student INSERT/SELECT on their own complaints, an owner SELECT/UPDATE on complaints belonging to hostels they own, and no cross-student visibility beyond what already exists for parents via `is_parent_of`.
7. IF the currently active Row Level Security policy set on `public.complaints` does not already permit the INSERT and UPDATE operations described in this requirement THEN the Production Application SHALL add the minimum additional policies required to permit them, without weakening the existing SELECT policy's visibility boundaries.

### Requirement 12: Complaints visual improvements

**User Story:** As a student or hostel owner, I want complaint lists that are easy to scan and understand, so that I can track issues efficiently.

#### Acceptance Criteria

1. WHEN a student or owner views a complaint list THEN the Production Application SHALL render each complaint in its own visually distinct card, showing title, description, category, status badge, and creation date.
2. WHEN a student or owner views an empty complaint list THEN the Production Application SHALL display an empty state distinct from the loading state.
3. WHEN a complaint create or status-update operation fails or succeeds THEN the Production Application SHALL display feedback consistent with Requirement 1's error/success feedback rules.

### Requirement 13: Owner notification preferences persistence

**User Story:** As a hostel owner, I want my notification preferences to actually save, so that my choices are respected across sessions.

#### Acceptance Criteria

1. WHEN an owner toggles the "New Booking Alerts" (room request) or "Complaint Notifications" preference on the Settings page THEN the Production Application SHALL persist the new value using the same Supabase Auth `user_metadata` mechanism already used by the Student Settings page's notification preferences.
2. WHEN an owner reloads the Settings page after changing a notification preference THEN the Production Application SHALL display the previously saved value, not a hardcoded default.
3. THE Production Application SHALL NOT introduce a new notification-preferences table or duplicate an existing preferences mechanism.
4. THE Production Application SHALL NOT change the two existing decorative checkboxes' visual position without owner approval; only their persistence behavior is added.

### Requirement 14: Change Password UX improvements

**User Story:** As a hostel owner, I want a clear, professional Change Password flow, so that I can update my credentials with confidence.

#### Acceptance Criteria

1. WHEN an owner opens the Change Password form THEN the Production Application SHALL display Current Password, New Password, and Confirm New Password fields with independent show/hide visibility controls.
2. WHEN the New Password and Confirm New Password fields do not match THEN the Production Application SHALL display a mismatch validation message before submission succeeds.
3. WHEN an owner submits a password change THEN the Production Application SHALL verify the current password and update the password using the existing Supabase Auth calls already implemented, without modification to that verification mechanism.
4. WHEN a password change request is in flight THEN the Production Application SHALL display a loading state on the submit action.
5. WHEN a password change succeeds or fails THEN the Production Application SHALL display success or error feedback without exposing the entered password values in any error message, toast, or console output.
6. THE Production Application SHALL NOT store any submitted password value in a database table, and SHALL NOT log any submitted password value to the console.

### Requirement 15: Regression protection for the Owner Dashboard shell and unrelated features

**User Story:** As the application owner, I want this feature to touch only the specified areas, so that unrelated functionality and the dashboard shell remain stable.

#### Acceptance Criteria

1. THE Production Application SHALL NOT modify `app/owner/layout.tsx`, `components/dashboard-layout.tsx`, or `components/dashboard-shell.tsx` as part of this feature.
2. THE Production Application SHALL NOT modify authentication, authorization, session handling, or the existing `accountCompletionStep` gating logic as part of this feature.
3. THE Production Application SHALL NOT modify the payment/billing pages, the OTP signup flow, or the Google OAuth flow as part of this feature.
4. WHEN this feature's changes are complete THEN the Production Application SHALL pass a TypeScript compile check and a production build with no new errors introduced by this feature's changes.
