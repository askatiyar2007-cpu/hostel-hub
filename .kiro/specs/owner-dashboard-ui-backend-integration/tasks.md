# Implementation Plan: Owner Dashboard UI + Backend Integration

## Overview

Close the visual and backend gaps identified in `design.md` across six existing Owner Dashboard areas — Hostel Management, Room Management, Room Requests/Approve Allocation, Student Management/Assign Student, Complaints, and Settings — without touching the dashboard shell, authentication, or unrelated flows (payments, OTP signup, Google OAuth). Start with the one additive database migration (complaints INSERT/UPDATE policies + a room_requests DELETE policy), then restyle and complete each dashboard area to its existing design tokens, then finish with a build/type-check checkpoint. No new tables, RPCs, API routes, or enum values are introduced.

## Tasks

- [ ] 1. Deliver the additive database migration foundation
  - [ ] 1.1 Author the migration file with the exact SQL from design.md's Data Models section
    - Create `supabase/migrations/20260828000000_owner_dashboard_complaints_and_request_policies.sql` containing, verbatim: the `"Students can insert own complaints"` INSERT policy on `public.complaints` (`WITH CHECK (auth.uid() = student_id)`), the `"Owners can update complaints for their hostels"` UPDATE policy on `public.complaints` (owner-of-hostel `USING`/`WITH CHECK`), and the `"Owners can delete rejected hostel requests"` DELETE policy on `public.room_requests` (`status = 'rejected'` AND `hostel_id` owned by `auth.uid()`), followed by the `NOTIFY pgrst, 'reload schema'` statement.
    - Use the `DROP POLICY IF EXISTS` + `CREATE POLICY` idempotent pattern already used by `20260726000000_fix_recursive_rls_final.sql`; do not modify, drop, or replace the existing `"Complaint visibility"` SELECT policy on `complaints`, nor any existing policy on `room_requests`.
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 11.1, 11.3, 11.4, 11.6, 11.7_
  - [ ] 1.2 Document the mandatory manual production deployment step
    - This migration cannot be applied to the live Supabase project from this workspace (no CLI project link or live DB credentials are available, consistent with every prior migration under `supabase/migrations/`). "Completing" this subtask means the deployment requirement is explicitly documented — in the migration file's header comment (already specified in design.md's SQL block) and reiterated in this spec's Notes section below — not that the policies are live in production.
    - Flag to the user, on completion of this task, that `supabase db push` (or the team's existing SQL-editor deployment process) must be run manually before Requirement 8 (rejected-request deletion) and Requirement 11 (complaints insert/update) will actually work end-to-end.
    - _Requirements: 8.1, 8.6, 11.7_

- [ ] 2. Hostel section visual and data-accuracy fixes
  - [ ] 2.1 Restyle the four Hostel pages to the shared design tokens
    - In `app/owner/hostels/page.tsx`, `app/owner/hostels/new/page.tsx`, `app/owner/hostels/edit/[id]/page.tsx`, and `app/owner/hostels/[id]/page.tsx`, replace hard-coded `bg-white`/`border-gray-100`/`text-gray-900` Tailwind classes with the shared token classes (`bg-card`, `border-border`, `text-foreground`, etc.) already used on `app/owner/requests/page.tsx` and `app/owner/students/page.tsx`.
    - Verify the existing loading state, empty state, per-card visual separation, delete confirmation (`window.confirm`), and `toast.error(error.message)` surfacing on create/update/delete all continue to render correctly after the restyle — no functional change to any of these.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [ ] 2.2 Remove the "Starting Rent" input from the Add Hostel form only
    - In `app/owner/hostels/new/page.tsx`, remove the "Starting Rent (per month)" input block and its `formData.starting_price` local state, and omit `starting_price` entirely from the insert payload so the database's existing `DEFAULT 0` applies.
    - Do not touch `app/owner/hostels/edit/[id]/page.tsx`, `app/owner/hostels/[id]/page.tsx`, the `hostels.starting_price` column, or the dashboard summary card in `app/owner/dashboard/page.tsx` that reads it.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ] 2.3 Fix zero-value display accuracy for hostel ratings and room occupancy
    - In `app/owner/hostels/page.tsx`'s hostel card, ensure any rating/review-count display added during the Task 2.1 restyle only renders `WHEN (hostel.rating > 0 OR hostel.total_reviews > 0)` — never show "0".
    - Confirm `app/owner/rooms/page.tsx` continues to unconditionally display `{occupied} beds` (including `0 occupied`) as accurate data after Phase 2 (Task 3) restyling — occupancy zero must remain visible, not omitted.
    - Do not alter the underlying numeric value of `rooms.capacity`, `rooms.occupied_count`, `rooms.occupancy`, `rooms.rent`, `rooms.security_deposit`, or `hostels.starting_price`.
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Room section visual and selector-prominence fixes
  - [ ] 3.1 Restyle the Rooms list, Add Room, and Edit Room pages to the shared design tokens
    - In `app/owner/rooms/page.tsx`, `app/owner/rooms/new/page.tsx`, and `app/owner/rooms/edit/[id]/page.tsx`, apply the same shared token restyle described in Task 2.1.
    - Verify the existing distinct loading state (`Loading rooms...`) and empty state (dashed-border `No rooms found...`) remain visually distinct after restyle, and that existing `toast.success`/`toast.error` feedback on create/update/delete is unchanged.
    - _Requirements: 4.1, 4.3, 4.4_
  - [ ] 3.2 Make the Add Room Hostel selector visually prominent; confirm Capacity retention
    - In `app/owner/rooms/new/page.tsx`, restyle the "Select Hostel" `<select>` into its own labeled card/section at the top of the form (mirroring the numbered-card pattern in `app/owner/students/new/page.tsx`, e.g. "Card 1: Student Information"), with a larger control and a clear "Select Hostel *" label. Do not change the underlying query (`.eq('owner_id', profile.user_id)`) or the selectable hostel set.
    - Confirm the required Capacity input (`required type="number" min="1"` in `new/page.tsx`, `required type="number"` in `edit/[id]/page.tsx`) is retained exactly as-is — no removal, hiding, or auto-submission of a capacity value. The existing `grid grid-cols-2` grouping of Capacity next to Room Type may be kept as-is; only cosmetic token restyling applies.
    - _Requirements: 4.2, 5.1, 5.2_

- [ ] 4. Room Requests detail completeness, QR removal, and rejected-request deletion
  - [ ] 4.1 Add the missing Emergency Contact display to ApprovedAllocationCard
    - In `app/owner/requests/page.tsx`, add an `Emergency Contact` `CardInfoRow` to `ApprovedAllocationCard`, sourced the same way `PendingRequestCard`/`DetailsModal` already compute it (`alloc.students.emergency_contact` / `emergency_contact_name` / `emergency_contact_phone`, already fetched by the existing query). Do not duplicate this field within the same card, and do not touch how `DetailsModal` renders it.
    - _Requirements: 6.3, 6.5_
  - [ ] 4.2 Remove the two placeholder QR modals
    - In `app/owner/requests/page.tsx`, remove the `QrCodeModal` function, its `qrCodeModalData` state, the `onViewQR` prop/handler, the "QR Code" `<Button>` in `ApprovedAllocationCard`'s action row, and the `{qrCodeModalData && <QrCodeModal .../>}` render block.
    - In `app/owner/students/[id]/page.tsx`, remove the inline QR modal block (`showQrCode` state, the "Show Payment QR Code" button, and the `{showQrCode && (...)}` JSX block with the simulated SVG QR).
    - Do not touch `app/owner/settings/payment-methods/page.tsx`, `app/student/bills/page.tsx`, or any `payment_methods.qr_code_url` code path. After removal, confirm the remaining actions (Agreement, Student Profile, Payment History, Check Out on `ApprovedAllocationCard`; Agreement, Payment History, Resident Complaints, Checkout Student on the Student Profile page) still render and function.
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 4.3 Add a Delete action for rejected room requests
    - In `app/owner/requests/page.tsx`, add a "Delete" button to `RejectedRequestCard` next to the existing "Re-review" button, wired to the existing `ConfirmationModal` extended with a new `action: 'delete'` case (title/description/button-color entry in its existing lookup-table pattern; prop signature unchanged).
    - Add the `deleteMutation` exactly as specified in design.md's Phase 3 approach: a Supabase `.from('room_requests').delete().eq('id', id).eq('status', 'rejected')` call (client-side filter is defense-in-depth only), with `onSuccess` showing a success toast, closing the confirmation, and invalidating the `['owner-room-requests']` query, and `onError` showing `e.message` via toast.
    - Note: this satisfies AC1/AC5/AC6 at the application layer; AC2/AC3 (rejecting non-rejected or not-owned rows) are enforced by the Task 1 migration's RLS `DELETE` policy, not by this client code — full runtime correctness depends on that migration being deployed (see Notes).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 5. Student Management hostel-selector consistency and booking-type terminology
  - [ ] 5.1 Restyle the Students list and Assign Student hostel selectors to match Room's improved selector
    - Apply the identical visual treatment established in Task 3.2 (label style, control size, focus ring) to the Students list hostel filter in `app/owner/students/page.tsx` (keep the existing `DropdownMenu`/`Button` component, align only labeling/sizing/focus-state classes) and to the Assign Student form's Hostel `<select>` in `app/owner/students/new/page.tsx` ("Card 4: Room Assignment" section).
    - Do not change the underlying Supabase query (`.eq('owner_id', ...)`) or the set of selectable hostels.
    - _Requirements: 9.1, 9.2_
  - [ ] 5.2 Update all booking-type display labels to "Entire Shared Room" / "Entire Room"
    - `app/owner/students/new/page.tsx`: change the Booking Option radio label text for `shared_bed` to "Entire Shared Room" (leave "Entire Room" as-is); update the Assignment Details summary ternary and both `invitationData.booking_type` success-dialog occurrences to output "Entire Shared Room" for the non-`entire_room` branch.
    - `app/student/room-request/page.tsx`: change the `shared_bed`/`shared` radio label to "Entire Shared Room" (leave "Entire Room (Private)" as-is); update the inline note text mentioning "Shared Bed" to say "Entire Shared Room"; add a label-mapping helper so the `pendingRequest.booking_type || 'shared'` display badge shows "Entire Shared Room"/"Entire Room" rather than the raw enum/fallback string.
    - `app/owner/requests/page.tsx`: change every `booking_type === 'entire_room' ? 'Private' : 'Shared Bed'` ternary in `PendingRequestCard`, `ApprovedAllocationCard`, and `DetailsModal` to `'Entire Room' : 'Entire Shared Room'`.
    - `app/owner/students/page.tsx`: change the `bookingType` display ternary (`'Private Room' : 'Shared Bed'`) to `'Entire Room' : 'Entire Shared Room'`.
    - `app/owner/students/[id]/page.tsx`: change the header ternary (`'Private' : 'Shared Bed'`) to `'Entire Room' : 'Entire Shared Room'`.
    - Do not rename, add, or remove any `public.booking_type` enum value; do not change parameter names, types, or accepted values of `create_manual_assignment_with_invite`, `approve_room_request`, or any other RPC; the literal `'shared_bed'`/`'entire_room'` value bound to `<input type="radio" value=...>` and sent to `/api/owner/students/assign`, `room_requests`, and `room_allocations` must remain unchanged — only JSX label text changes.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 6. Complaints category display and backend-integrity verification
  - [ ] 6.1 Add category display to student complaint cards
    - In `app/student/complaints/page.tsx`, add a small category badge/line to each complaint card so the already-fetched `category` field is displayed alongside title, description, status badge, and date.
    - _Requirements: 12.1_
  - [ ] 6.2 Confirm complaints empty/loading states and verify insert/update flows against the deployed migration
    - Confirm `app/owner/complaints/page.tsx`'s existing spinner loading state and dashed-border empty state remain distinct, and that `app/student/complaints/page.tsx`'s "Loading complaints..." text state remains visually distinct from its bordered/icon empty state; restyle for consistency if desired, with no functional change.
    - Confirm `app/student/dashboard/page.tsx`'s `NewComplaintDialog` insert (`student_id: studentId` where `studentId` is `auth.uid()`-scoped) and `app/owner/complaints/page.tsx`'s `updateStatus` (`.update({ status: newStatus }).eq('id', id)`) require no code changes — they already issue the correct queries.
    - Note: actually confirming that these INSERT/UPDATE calls succeed (rather than being silently blocked by RLS) requires the Task 1 migration to be deployed to the live Supabase project; this cannot be verified from this workspace alone (see Notes).
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.2, 12.3_

- [ ] 7. Settings: notification persistence and password-field visibility toggles
  - [ ] 7.1 Wire notification checkboxes to `user_metadata` persistence
    - In `app/owner/settings/page.tsx`, add `user` to the existing `useAuth()` destructure; on mount, read `user.user_metadata.notify_room_requests` / `notify_complaints` into local state (default `true` when `undefined`, matching the `!== false` pattern in `app/student/settings/page.tsx`).
    - Replace the two decorative `<input type="checkbox" defaultChecked className="toggle" />` elements with controlled checkboxes bound to that state, without moving their position in the Notifications section.
    - Add a "Save Preferences" button that calls `supabase.auth.updateUser({ data: { notify_room_requests, notify_complaints } })`, matching the pattern already used in `app/student/settings/page.tsx`. Do not introduce a new table or read/write `public.notifications`.
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - [ ] 7.2 Add independent show/hide toggles to the three Change Password fields
    - In `app/owner/settings/page.tsx`'s Change Password modal, add a per-field eye-icon show/hide toggle (`lucide-react`'s `Eye`/`EyeOff`) to the Current Password, New Password, and Confirm New Password inputs, each backed by its own independent `useState<boolean>` so toggling one field does not affect the others.
    - Do not modify `handleChangePassword`, the `signInWithPassword`-based reauth, the mismatch/min-length checks, the `verifyingPassword` loading state, or the existing `toast.error(err.message || 'Password update failed.')` feedback — this is a pure UI addition on top of the existing `type="password"`/`type="text"` toggle.
    - _Requirements: 14.1, 14.3_

- [ ] 8. Final checkpoint - build verification and manual spot-check
  - Run `npx tsc --noEmit` and `npm run build`; fix any new errors introduced by Tasks 1-7 before proceeding, and confirm no new errors exist relative to the pre-change baseline.
  - Manually spot-check, per design.md's Testing Strategy: the Add Hostel form's insert payload omitting `starting_price`; Add Room's Capacity field still creating the correct number of `beds` rows; the booking-type label changes across Assign Student, Room Request, Room Request cards/modals, and Student list/profile pages while confirming persisted values are unchanged; and the notification-preference save/reload round trip.
  - Explicitly report which behaviors could not be fully verified without live Supabase access — specifically, the rejected-room-request deletion RLS gate (Requirement 8) and the complaints INSERT/UPDATE RLS fix (Requirement 11), both of which require the Task 1 migration to be manually deployed to production first.
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

## Notes

- Task 4.3 (rejected-request deletion) and Task 6.2 (complaints insert/update verification) are written and will compile against Task 1.1's migration file, but their actual runtime behavior against a live database depends on Task 1's migration being manually deployed to the production Supabase project (per Task 1.2) — this deployment step is outside this agent's execution capability and must be performed by the user via the Supabase SQL editor, `supabase db push`, or the team's existing process.
- Task 5.1 depends on Task 3.2: the Students list and Assign Student hostel selectors are restyled to match the Add Room selector's treatment, so Task 3.2 must land first.
- Task 5.2 touches `app/owner/requests/page.tsx`, the same file modified by Tasks 4.1-4.3; it should be applied after Task 4.3 to avoid rework on overlapping card components.
- No new reusable components, hooks, API routes, RPCs, or database tables are introduced anywhere in this task list, consistent with design.md's stated approach of page-local, in-place edits.
- `app/owner/layout.tsx`, `components/dashboard-layout.tsx`, `components/dashboard-shell.tsx`, authentication/authorization/session/`accountCompletionStep` code, payment/billing pages, the OTP signup flow, and the Google OAuth flow are not modified by any task in this list (Requirement 15).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "6.1", "7.1", "7.2"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "3.2", "4.2", "6.2"] },
    { "id": 2, "tasks": ["5.1", "4.3"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["8"] }
  ]
}
```
