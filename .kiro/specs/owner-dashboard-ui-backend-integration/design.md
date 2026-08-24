# Design Document

## Overview

This feature reworks six existing Owner Dashboard areas of HostelHub — Hostel Management, Room Management, Room Requests/Approve Allocation, Student Management/Assign Student, Complaints, and Settings — to close visual and backend gaps identified during investigation, without touching the dashboard shell, authentication, or unrelated flows (payments, OTP signup, Google OAuth).

The work is almost entirely UI-layer: most requirements are satisfied by editing existing page/component files to reuse the app's existing design tokens (Tailwind utility classes and `components/ui/*` primitives already used elsewhere), fix data-mapping/display bugs, and remove two placeholder QR modals. Two requirements (Requirement 8's rejected-request deletion, and Requirement 11's complaints RLS gap) require a real database change. Both are additive: a `DELETE` RLS policy on `room_requests` and two RLS policies (`INSERT`, `UPDATE`) on `complaints`. No enum values, RPC signatures, or existing SELECT policies change.

This design is organized into the same six functional phases as `requirements.md`, plus a closing Regression Protection section for Requirement 15.


## Architecture

This feature does not introduce a new architectural layer. It works entirely within the existing Next.js 14 App Router + Supabase architecture already used across the Owner Dashboard:

- **Client pages** (`app/owner/**/*.tsx`, `app/student/complaints/page.tsx`) call the Supabase JS client (`@/lib/supabase/client`) directly for reads/writes, exactly as they do today — no new data-fetching layer, hook library, or state-management abstraction is introduced.
- **Row Level Security (RLS)** on Postgres remains the sole authorization boundary for all direct-from-browser Supabase calls, consistent with the rest of the codebase. The two new policies (Phase 3 and Phase 5) extend this same boundary; no application-level authorization check is added or relied upon in its place.
- **Existing RPCs** (`create_manual_assignment_with_invite`, `approve_room_request`, `checkout_student`, etc.) are called unchanged, with unchanged parameters.
- **Supabase Auth `user_metadata`** is reused as the persistence layer for Requirement 13, consistent with the existing pattern already shipped on the Student Settings page — no new persistence layer is introduced.
- **One new migration file** is added under `supabase/migrations/`, following the project's existing migration-per-change convention; it is purely additive (new policies only) and does not alter any existing table, function, trigger, or policy.

No new API routes, RPCs, background jobs, or external services are introduced by this feature.

## Components and Interfaces

No new reusable components, hooks, or service modules are introduced. This feature modifies existing page-level components in place and, where a small piece of UI is genuinely new (e.g. a Delete action on a rejected request, a Save Preferences button, per-field password visibility toggles), it is added as local JSX/state within the existing containing file, consistent with this codebase's current pattern of page-local state rather than extracted shared hooks for these areas.

Existing components reused as-is (no interface changes):
- components/ui/button.tsx, components/ui/input.tsx, components/ui/label.tsx, components/ui/badge.tsx, components/ui/dialog.tsx, components/ui/tabs.tsx, components/dashboard-shell.tsx (DashboardShell, StatCard, AnalyticsCard) — all consumed with their current props/signatures, unchanged.
- ConfirmationModal (local to pp/owner/requests/page.tsx) is extended with one new ction union member ('delete') and corresponding title/description/button-color entries, following its existing Record<action, string> lookup-table pattern — its prop signature (ction, onConfirm, onClose, loading) is unchanged.
- PaymentHistoryModal, MarkDepositPaidModal, MarkFeePaidModal (from pp/owner/requests/payment-modals.tsx) are untouched and continue to be imported exactly as today.

Modified page components (interface unchanged — these are route-level pages with no external props):
- pp/owner/hostels/page.tsx, pp/owner/hostels/new/page.tsx, pp/owner/hostels/edit/[id]/page.tsx, pp/owner/hostels/[id]/page.tsx
- pp/owner/rooms/page.tsx, pp/owner/rooms/new/page.tsx, pp/owner/rooms/edit/[id]/page.tsx
- pp/owner/requests/page.tsx
- pp/owner/students/page.tsx, pp/owner/students/new/page.tsx, pp/owner/students/[id]/page.tsx
- pp/student/room-request/page.tsx
- pp/student/complaints/page.tsx, pp/owner/complaints/page.tsx
- pp/owner/settings/page.tsx

Data access pattern (unchanged): every page above continues to call the Supabase client directly (supabase.from(...), supabase.rpc(...)) or the existing etch('/api/owner/students/assign') route; no new API route or RPC wrapper is introduced.
---

## Phase 1: Hostel Section (Requirements 1–3)

**Files modified:**
- `app/owner/hostels/page.tsx`
- `app/owner/hostels/new/page.tsx`
- `app/owner/hostels/edit/[id]/page.tsx`
- `app/owner/hostels/[id]/page.tsx`

**Nature of change:** UI-only. No backend/RLS change.

### Approach

**Requirement 1 (visual/UX consistency, empty/loading/error states, confirmation, card separation):**
`app/owner/hostels/page.tsx` already has a loading state, an empty state, and a card grid — these largely satisfy AC1–AC3 and AC7 already. The remaining gap is AC4 (error state on failed mutations) and AC6 (confirmation before delete). Currently `handleDelete` uses `window.confirm(...)` (a native browser dialog), which technically satisfies "an explicit confirmation step" (AC6) but is visually inconsistent with the rest of the app's design language. This design keeps the confirmation *requirement* satisfied as-is (native `confirm()` is an accepted, functioning confirmation step) and focuses effort on:
- Surfacing Supabase errors from `insert`/`update`/`delete` calls via `toast.error(error.message)` consistently (some paths already do this in `new/page.tsx` and `edit/[id]/page.tsx`; `page.tsx`'s `handleDelete` already does too) — verify all three hostel mutation paths render the actual Supabase error text, never a raw stack trace.
- Confirming card visual separation already exists (`border border-gray-100 shadow-sm` per card in the grid) — no change needed for AC7 beyond restyling to match shared tokens if inconsistent with Room/Request cards elsewhere (e.g. the app increasingly uses `rounded-2xl`/`rounded-3xl`, `border-border`, `bg-card` tokens seen in `app/owner/requests/page.tsx` and `app/owner/students/page.tsx`). Restyle the Hostels pages' hard-coded `bg-white`/`border-gray-100`/`text-gray-900` Tailwind classes to the shared token classes (`bg-card`, `border-border`, `text-foreground`, etc.) used by the newer owner pages, so visual language is consistent app-wide.

**Requirement 2 (remove Starting Rent from Add Hostel form):**
- In `app/owner/hostels/new/page.tsx`, remove the "Starting Rent (per month)" `<input>` block and its `formData.starting_price` field entirely from the form UI and local state.
- Remove `starting_price: formData.starting_price ? parseFloat(formData.starting_price) : 0` from the insert `payload` — omit the key entirely so the database's existing `DEFAULT 0` on `hostels.starting_price` applies.
- Do NOT touch `app/owner/hostels/edit/[id]/page.tsx` (it already has no `starting_price` field — confirmed by reading the file).
- Do NOT touch `app/owner/hostels/[id]/page.tsx` or `app/owner/dashboard/page.tsx`'s hostel card (`From â‚¹{Number(h.starting_price ?? 0).toLocaleString()}` at line 216) — this display must remain exactly as-is.

**Requirement 3 (zero-value display accuracy):**
- `app/owner/hostels/page.tsx`'s hostel card currently displays no rating/review count at all — no regression risk there, and no rating UI needs to be added since the requirement is about *omitting* zero-value ratings, not adding a new rating display. If a rating badge is added as part of the Requirement 1 visual pass, it must conditionally render only `WHEN (hostel.rating > 0 OR hostel.total_reviews > 0)`.
- `app/owner/rooms/page.tsx` already computes and displays `Occupied` beds as a real count (`{occupied} beds`) unconditionally, including when `occupied === 0` — this already satisfies AC2 ("0 occupied" must be shown, not omitted). No change needed there; just confirm this behavior is preserved when the Rooms page is restyled in Phase 2.
- No numeric column (`capacity`, `occupied_count`, `occupancy`, `rent`, `security_deposit`, `starting_price`) is written to as part of any display change in this phase — all changes are read/render-path only.

---

## Phase 2: Room Section (Requirements 4–5)

**Files modified:**
- `app/owner/rooms/page.tsx`
- `app/owner/rooms/new/page.tsx`
- `app/owner/rooms/edit/[id]/page.tsx`

**Nature of change:** UI-only. No backend/RLS change.

### Approach

**Requirement 4:**
- Apply the same shared design-token restyle described in Phase 1 (replace hard-coded `bg-white`, `border-gray-100`, `text-gray-900` etc. with `bg-card`, `border-border`, `text-foreground` token classes) across all three Room pages.
- `app/owner/rooms/new/page.tsx`'s Hostel selector (`<select>` under "Select Hostel") is currently a plain, unstyled-looking dropdown inline with other inputs. Per AC2, make it visually prominent: give it its own labeled card/section at the top of the form (mirroring the numbered-card pattern already used in `app/owner/students/new/page.tsx`, e.g. "Card 1: Student Information"), with a larger control size and clear "Select Hostel *" label — no change to the query (`.eq('owner_id', profile.user_id)`) or selectable hostel set.
- `app/owner/rooms/page.tsx` already has a distinct loading state (`Loading rooms...`) and empty state (`No rooms found...` in a dashed-border box) — AC3 is already satisfied; verify they remain visually distinct after restyle.
- AC4 (error/success feedback) — `page.tsx`'s `handleDelete` and both form pages already call `toast.success`/`toast.error` with the real Supabase error message; no functional change needed, just confirm consistency after restyle.

**Requirement 5 (capacity retention):**
- `rooms.capacity` is a `NOT NULL integer` column with no derivation trigger (confirmed: `20260822000000_fix_room_booking_occupancy.sql` only reads `capacity`, never derives it, and no other migration adds a trigger on `rooms`). The Capacity input already exists as a required field in both `app/owner/rooms/new/page.tsx` (`required type="number" min="1"`) and `app/owner/rooms/edit/[id]/page.tsx` (`required type="number"`). **No removal is planned nor permitted.** Per AC2, Capacity MAY be visually grouped next to Room Type (both forms already place them in the same `grid grid-cols-2` row) — this is already satisfied structurally; only cosmetic/token restyling applies here, not logic changes. Bed-row generation in `new/page.tsx` (`for (let i = 1; i <= Number(formData.capacity); i++)`) is untouched.

---

## Phase 3: Room Requests (Requirements 6–8)

**Files modified:**
- `app/owner/requests/page.tsx`
- `app/owner/students/[id]/page.tsx` (QR removal only, shared with Phase 4)

**New migration file:** `supabase/migrations/20260828000000_owner_dashboard_complaints_and_request_policies.sql` (also covers Phase 5's complaints RLS fix — see the combined SQL in the Data Models section below)

### Approach

**Requirement 6 (visual separation + detail completeness):**
- Cards (`PendingRequestCard`, `ApprovedAllocationCard`, `RejectedRequestCard`) are already rendered as separate bordered/rounded cards in a `flex flex-col gap-6` stack — AC1 is already satisfied structurally.
- AC2 (name, contact, hostel, room+booking type, date, status) — already present across the three card components and `DetailsModal`.
- AC3 (emergency contact display without hardcoded placeholder) — `PendingRequestCard` already computes emergency contact from `req.emergency_contact || (emergency_contact_name && emergency_contact_phone ? ... : emergency_contact_name || 'N/A')`. The `'N/A'` fallback string used when no emergency data exists at all is an acceptable literal fallback (not a fabricated placeholder value pretending to be real data), so no change is required here beyond verifying `ApprovedAllocationCard` surfaces the same emergency fields (it currently maps `emergency_contact*` onto `alloc.students` in the query layer but does not render them in the card body — this is a real gap). Add an `Emergency Contact` `CardInfoRow` to `ApprovedAllocationCard`, sourced the same way as `PendingRequestCard`/`DetailsModal` already compute it (`alloc.students.emergency_contact` etc., already fetched by the existing query).
- AC4 (parent/guardian data continues to display) — already rendered in `DetailsModal` and the Student Profile page; no removal planned.
- AC5 (no duplicate field rendering within one details view) — `DetailsModal` already computes `emergencyContact` once and renders it once via `renderDetailRow("Emergency Contact", emergencyContact)`; no duplication exists today. Verify the new `ApprovedAllocationCard` row does not also duplicate inside the same card as `DetailsModal`'s content (they're separate views — card summary vs. modal detail — so no violation).

**Requirement 7 (placeholder QR removal):**
- Remove the `QrCodeModal` function, its usages (`qrCodeModalData` state, `onViewQR` prop/handler, the "QR Code" `<Button>` in `ApprovedAllocationCard`'s action row, and the `{qrCodeModalData && <QrCodeModal .../>}` render block) from `app/owner/requests/page.tsx`.
- Remove the inline QR modal block (`showQrCode` state, the "Show Payment QR Code" button, and the `{showQrCode && (...)}` JSX block containing the simulated SVG QR) from `app/owner/students/[id]/page.tsx`.
- Do NOT touch `app/owner/settings/payment-methods/page.tsx`, `app/student/bills/page.tsx`, or any code path reading `payment_methods.qr_code_url` — these are confirmed (via investigation) to be a real, unrelated feature.
- After removal, confirm the remaining actions on `ApprovedAllocationCard` (Agreement, Student Profile, Payment History, Check Out) and on the Student Profile page (Agreement, Payment History, Resident Complaints, Checkout Student) still render and function — no other action is removed.

**Requirement 8 (rejected room request deletion):**
- UI: Add a "Delete" button to `RejectedRequestCard` in `app/owner/requests/page.tsx`, next to the existing "Re-review" button. Clicking it opens the existing `ConfirmationModal` component (reused, extended with a new `action: 'delete'` case) which requires an explicit "Confirm Action" click before the delete request is sent — this satisfies AC4.
- Add a new mutation:
  ```ts
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'rejected'); // defense-in-depth; RLS is the real gate
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rejected request deleted.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSelectedConfirmAction(null);
    },
  });
  ```
- This satisfies AC1 (real delete on rejected rows owned by the owner), AC5 (list refresh via query invalidation — same pattern already used by `rejectMutation`/`rereviewMutation`), and AC6 (real Supabase delete gated by RLS, not a client-side filter).
- AC2 and AC3 (rejecting deletion of non-`rejected` rows, and rows not owned by the requesting owner) are enforced at the database level by the new RLS `DELETE` policy below — the client-side `.eq('status', 'rejected')` filter is defense-in-depth only, never the actual security boundary.

---

## Phase 4: Student Management / Assign Student (Requirements 9–10)

**Files modified:**
- `app/owner/students/page.tsx`
- `app/owner/students/new/page.tsx`
- `app/owner/requests/page.tsx` (label-only changes, shared with Phase 3)
- `app/owner/students/[id]/page.tsx` (label-only changes)

**Nature of change:** UI-only. No backend/RLS/RPC change.

### Approach

**Requirement 9 (hostel selector consistency):**
- Once the Add Room form's Hostel selector is restyled in Phase 2 into a prominent, clearly labeled control, apply the identical visual treatment (label style, control size, focus ring) to:
  - The Students list hostel filter dropdown in `app/owner/students/page.tsx` (currently a `DropdownMenu`/`Button` combo — keep the same underlying component, just align label/sizing/focus-state classes).
  - The Assign Student form's Hostel `<select>` in `app/owner/students/new/page.tsx` ("Card 4: Room Assignment" section).
- AC2: the underlying Supabase query (`.eq('owner_id', profile.user_id)` / `.eq('owner_id', user.id)`) and the set of selectable hostels are not modified — this is purely a class-name/layout change.

**Requirement 10 (booking type terminology):**
- Enum values (`shared_bed`, `entire_room`) are never renamed. Only display strings change, in these exact spots:
  - `app/owner/students/new/page.tsx`: the Booking Option radio labels currently read `"Shared Bed"` / `"Entire Room"` → change the `shared_bed` label's visible text to `"Entire Shared Room"`. (`"Entire Room"` is already correct, no change.) Also update the "Assignment Details" summary block's ternary (`formData.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Bed'`) to output `"Entire Shared Room"` for the non-`entire_room` branch, and the success-dialog `invitationData` display (`invitationData.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Bed'`, appears twice) likewise.
  - `app/student/room-request/page.tsx`: the Booking Option radio label currently reads `"Shared Bed"` (line ~1758) → change to `"Entire Shared Room"`. The `"Entire Room (Private)"` label is left as-is since "Entire Room" is already the required substring (AC2 only requires the `entire_room` case say "Entire Room", the extra "(Private)" qualifier is not prohibited by the requirement and is left unchanged to avoid scope creep). Update the inline note text ("Shared Bed means you will share this room...") to say "Entire Shared Room" for consistency, and the `pendingRequest.booking_type || 'shared'` display badge (line ~860) — add a small label-mapping helper so the displayed word is "Entire Shared Room"/"Entire Room" rather than the raw enum/fallback string.
  - `app/owner/requests/page.tsx`: every occurrence of the ternary `booking_type === 'entire_room' ? 'Private' : 'Shared Bed'` (in `PendingRequestCard`, `ApprovedAllocationCard`, and `DetailsModal`) currently outputs `"Private"` for entire_room and `"Shared Bed"` for shared_bed — neither matches the required terminology exactly. Change both branches to `"Entire Room"` / `"Entire Shared Room"` respectively, in all three locations.
  - `app/owner/students/page.tsx`: the `bookingType` display variable (`item.booking_type === 'entire_room' ? 'Private Room' : 'Shared Bed'`) → change to `'Entire Room'` / `'Entire Shared Room'`.
  - `app/owner/students/[id]/page.tsx`: the header line (`allocation.booking_type === 'entire_room' ? 'Private' : 'Shared Bed'`) → change to `'Entire Room'` / `'Entire Shared Room'`.
- AC4/AC5: no enum, RPC parameter, or RPC accepted-value change. `create_manual_assignment_with_invite` and `approve_room_request` continue to accept/normalize `shared_bed`/`entire_room` (and their existing synonyms like `'shared'`) exactly as today — confirmed by reading `20260822000000_fix_room_booking_occupancy.sql`; this migration is not touched.
- AC6: the `formData.booking_type` value sent to `/api/owner/students/assign` (which forwards to `create_manual_assignment_with_invite`) and to `room_requests`/`room_allocations` remains the literal `'shared_bed'` or `'entire_room'` string — only the JSX label text changes, never the value bound to `<input type="radio" value="shared_bed">`/`value="entire_room"`.

---

## Phase 5: Complaints (Requirements 11–12)

**Files modified:**
- `app/student/complaints/page.tsx`
- `app/owner/complaints/page.tsx`
- `app/student/dashboard/page.tsx` (no change planned — its `NewComplaintDialog` insert already targets `student_id: studentId` where `studentId` is `auth.uid()`-scoped; confirmed compatible with the new INSERT policy below)

**New migration file:** `supabase/migrations/20260828000000_owner_dashboard_complaints_and_request_policies.sql` (SQL below)

### Approach

**Requirement 11 (shared backend integrity):**
- Investigation confirms `public.complaints.student_id` is a foreign key to `auth.users(id)` (not `public.students(id)`), and the currently-live RLS migration chain ends at `20260726000000_fix_recursive_rls_final.sql`, which recreates only a SELECT policy (`"Complaint visibility"`) on `complaints`. Earlier migrations that defined `"Students can insert own complaints"` and `"Owners can update complaints for their hostels"` were explicitly dropped by that same migration (as invasive-policy cleanup) and never recreated. This matches AC7's stated gap exactly: INSERT and UPDATE are currently unenforced/blocked for the intended actors.
- `app/student/dashboard/page.tsx`'s existing complaint-insert code already inserts with `student_id: studentId` where `studentId` resolves to `auth.uid()` — this is compatible with a `WITH CHECK (auth.uid() = student_id)` policy, so no application code change is needed there for INSERT to start working; it will simply stop being silently blocked (or allowed by accident via a permissive default) and become correctly, explicitly permitted.
- `app/owner/complaints/page.tsx`'s `updateStatus` function already issues `supabase.from('complaints').update({ status: newStatus }).eq('id', id)` — this is compatible with an owner-scoped `USING`/`WITH CHECK (EXISTS (... hostels.owner_id = auth.uid() ...))` policy on UPDATE.
- AC1–AC5 are therefore primarily validated by the new RLS policies (below) rather than by application code changes — the application code already does the right queries; it was the database policy set that didn't permit them.
- AC6/AC7: the new policies are additive only. The existing SELECT policy (`"Complaint visibility"`) is not modified, dropped, or replaced — it is left completely untouched, preserving its current visibility boundaries (self, `is_parent_of`, owning-hostel owner, super_admin).

**Requirement 12 (visual improvements):**
- `app/student/complaints/page.tsx` already renders complaints as individual `.card` divs with title, description, priority/status badges, and date — AC1 is largely satisfied; the "category" field is fetched (`select('*')`) but not currently displayed in the card body. Add a small category badge/line to each card to fully satisfy AC1's explicit "category" requirement.
- `app/student/complaints/page.tsx`'s empty state (`No complaints filed yet`) has no distinct loading state currently — it shows `<p>Loading complaints...</p>` as plain text while `loading` is true, vs. a bordered/icon empty state when not loading and `complaints.length === 0`. These are already visually distinct (plain text vs. a bordered card with icon) — AC2 is satisfied; may be restyled to match `app/owner/complaints/page.tsx`'s spinner-based loading state for consistency, but no functional change required.
- `app/owner/complaints/page.tsx` already has a spinner loading state and a distinct dashed-border empty state — AC2 satisfied already.
- AC3 (create/update feedback) — student-side complaint creation (`NewComplaintDialog` in `app/student/dashboard/page.tsx`) already calls `toast.success`/`toast.error`; owner-side `updateStatus` already calls `toast.success('Status updated!')` / `toast.error('Failed to update status')`. No change needed beyond confirming these continue to surface real Supabase error text once the new RLS policies are in place (a blocked UPDATE/INSERT would previously have surfaced as a generic RLS error toast — after this fix, successful operations will show success toasts instead).

---

## Phase 6: Settings (Requirements 13–14)

**Files modified:**
- `app/owner/settings/page.tsx`

**Nature of change:** UI-only, reusing an existing Supabase Auth mechanism. No new table, no schema change.

### Approach

**Requirement 13 (notification preference persistence):**
- Mirror the exact pattern already implemented in `app/student/settings/page.tsx`:
  - On mount, read `user.user_metadata.notify_room_requests` and `user.user_metadata.notify_complaints` into local state, defaulting to `true` when `undefined` (matching the student page's `!== false` pattern, so existing owners who've never touched the toggle see them ON by default, matching current `defaultChecked` behavior).
  - Get `user` from `useAuth()` in `app/owner/settings/page.tsx` (currently only `profile` is destructured — add `user` to the existing `useAuth()` call).
  - Replace the two decorative `<input type="checkbox" defaultChecked className="toggle" />` elements with controlled checkboxes bound to the new state (`checked={notifyRoomRequests}` / `checked={notifyComplaints}`, `onChange` updating state).
  - Add a "Save Preferences" action (button, matching the pattern in `app/student/settings/page.tsx`) that calls:
    ```ts
    const { error } = await supabase.auth.updateUser({
      data: {
        notify_room_requests: notifyRoomRequests,
        notify_complaints: notifyComplaints
      }
    });
    ```
  - This satisfies AC1 (same `user_metadata` mechanism as the student page) and AC2 (reload reads the persisted value, not a hardcoded default).
- AC3: no new table is introduced; `public.notifications` (existing, write-only table) is not touched or read from as part of this requirement — it remains out of scope, per the investigation notes.
- AC4: the two checkboxes' position/order in the Notifications section is unchanged — only their `defaultChecked`/uncontrolled nature becomes `checked`/controlled, and a Save button is added beneath them (an additive UI element, not a repositioning of the existing checkboxes).

**Requirement 14 (Change Password UX):**
- `app/owner/settings/page.tsx`'s Change Password modal already implements the core flow: current/new/confirm fields, `signInWithPassword`-based reauth, then `supabase.auth.updateUser({ password: newPassword })`, a mismatch check (`newPassword !== confirmPassword`), a min-length check, and loading/disabled state (`verifyingPassword`) on submit — this already covers AC2 (mismatch validation), AC3 (verify-then-update via unmodified existing calls), AC4 (loading state), and AC6 (no password value is persisted to a table or logged — confirmed by reading the file, no `console.log` of password values exists).
- The gap is AC1 (independent show/hide visibility toggles per field) and part of AC5 (success/error feedback without exposing password values — already satisfied via generic `toast.error(err.message || 'Password update failed.')`, which does not echo the password; kept as-is).
- Add a per-field show/hide toggle (an eye icon button, e.g. from `lucide-react`'s `Eye`/`EyeOff`, matching icons already imported elsewhere in the codebase) to each of the three password inputs (Current, New, Confirm) in the modal, each with its own independent `useState<boolean>` so toggling one field's visibility does not affect the others. This is a pure UI addition; the underlying `type="password"`/`type="text"` toggle does not touch the verification/update logic (`handleChangePassword`), satisfying AC3's "without modification to that verification mechanism" constraint.

---

## Regression Protection (Requirement 15)

This requirement is enforced by omission and by verification, not by new code:

- **Not modified by this feature:** `app/owner/layout.tsx`, `components/dashboard-layout.tsx`, `components/dashboard-shell.tsx` (AC1); any authentication/authorization/session/`accountCompletionStep` code (AC2); payment/billing pages (e.g. `app/api/payments/*`, `app/owner/settings/payment-methods/page.tsx`, `app/student/bills/page.tsx`), the OTP signup flow (`app/api/auth/signup/*`), or the Google OAuth flow (`app/auth/callback/route.ts`, `app/api/auth/oauth-intent/route.ts`) (AC3).
- **Verification (AC4):** after implementation, run `npx tsc --noEmit` (or the project's existing type-check script) and `npm run build` (or equivalent), and confirm no new errors appear beyond any pre-existing baseline. This is an implementation-time task, not a design-time artifact, and will be executed as part of task completion for this spec.

---

## Data Models

**File:** `supabase/migrations/20260828000000_owner_dashboard_complaints_and_request_policies.sql`

This is the only schema/policy change in this feature. It is purely additive: two new policies on `complaints` (INSERT, UPDATE) and one new policy on `room_requests` (DELETE). It does not drop, replace, or alter the existing `"Complaint visibility"` SELECT policy on `complaints`, nor any existing policy on `room_requests`. Idempotency follows the same `DROP POLICY IF EXISTS` + `CREATE POLICY` pattern used by `20260726000000_fix_recursive_rls_final.sql`, so the migration is safely re-runnable.

```sql
-- ===============================================================
-- Migration: Owner Dashboard — Complaints RLS fix & Rejected
--            Room Request deletion policy
-- Target Project: HostelHub
-- Date: 2026-08-28
-- Description:
-- 1. Restores INSERT (student, own complaint) and UPDATE (owner,
--    own hostel's complaints) policies on public.complaints that
--    were dropped by 20260726000000_fix_recursive_rls_final.sql
--    and never recreated. The existing SELECT policy
--    ("Complaint visibility") is NOT modified, dropped, or
--    replaced by this migration.
-- 2. Adds a DELETE policy on public.room_requests scoped to:
--    the request's status = 'rejected' AND the request's hostel
--    is owned by the requesting user. No existing SELECT/INSERT/
--    UPDATE policy on room_requests is modified.
-- This migration is purely additive and idempotent.
-- ===============================================================

-- ===============================================================
-- 1) COMPLAINTS: INSERT policy (student inserts own complaint)
-- ===============================================================

DROP POLICY IF EXISTS "Students can insert own complaints" ON public.complaints;

CREATE POLICY "Students can insert own complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- ===============================================================
-- 2) COMPLAINTS: UPDATE policy (owner updates complaints for
--    hostels they own)
-- ===============================================================

DROP POLICY IF EXISTS "Owners can update complaints for their hostels" ON public.complaints;

CREATE POLICY "Owners can update complaints for their hostels" ON public.complaints
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = complaints.hostel_id AND h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hostels h
      WHERE h.id = complaints.hostel_id AND h.owner_id = auth.uid()
    )
  );

-- ===============================================================
-- 3) ROOM_REQUESTS: DELETE policy (owner deletes their own
--    hostel's rejected requests only)
-- ===============================================================

DROP POLICY IF EXISTS "Owners can delete rejected hostel requests" ON public.room_requests;

CREATE POLICY "Owners can delete rejected hostel requests" ON public.room_requests
  FOR DELETE TO authenticated
  USING (
    status = 'rejected'
    AND hostel_id IN (
      SELECT id FROM public.hostels WHERE owner_id = auth.uid()
    )
  );

-- ===============================================================
-- 4) SCHEMA CACHE RELOAD
-- ===============================================================
NOTIFY pgrst, 'reload schema';
```

### What must NOT change (explicit list)

- `public.booking_type` enum values (`shared_bed`, `entire_room`) — never renamed, added to, or removed.
- The signatures, parameter names/types, and accepted values of `create_manual_assignment_with_invite`, `approve_room_request`, `checkout_student`, `mark_payment_paid`, `mark_fee_paid_manual`, or any other existing RPC.
- The existing `"Complaint visibility"` SELECT policy on `public.complaints`.
- Every existing policy on `public.room_requests` (`"Students can insert own requests"`, `"Students can read own requests"`, `"Owners can read hostel requests"`, `"Owners can update hostel requests"`).
- `hostels.starting_price`, `rooms.capacity`, `rooms.occupied_count`, `rooms.occupancy`, `rooms.rent`, `rooms.security_deposit` — column definitions and existing row values.
- `payment_methods.qr_code_url` and every page that reads it (`app/owner/settings/payment-methods/page.tsx`, `app/student/bills/page.tsx`).
- `app/owner/layout.tsx`, `components/dashboard-layout.tsx`, `components/dashboard-shell.tsx`.
- Any authentication/authorization/session/OTP/Google-OAuth code path.

## Correctness Properties

Property 1: Booking type persistence is label-invariant
_For any_ owner or student submission using either displayed label ("Entire Shared Room" or "Entire Room"), the value written to room_requests.booking_type and room_allocations.booking_type SHALL be exactly shared_bed or entire_room respectively — identical to the value that would have been written before any label text changed.
**Validates: Requirements 10.4, 10.5, 10.6**

Property 2: Rejected-request deletion is policy-gated, not client-gated
_For any_ delete request issued against public.room_requests, the row SHALL be removed if and only if status = 'rejected' AND the row's hostel_id belongs to a hostel owned by the requesting auth.uid() — enforced by the database RLS policy regardless of what the calling client code does or omits.
**Validates: Requirements 8.1, 8.2, 8.3, 8.6**

Property 3: Complaint mutation authority matches ownership
_For any_ INSERT on public.complaints, the row SHALL only be accepted when auth.uid() = student_id. _For any_ UPDATE on public.complaints, the row SHALL only be accepted when the caller owns the hostel referenced by hostel_id. Both hold independently of the existing, unmodified SELECT policy's visibility rules.
**Validates: Requirements 11.1, 11.3, 11.4, 11.6, 11.7**

Property 4: Schema and RPC surface is unchanged
_For any_ page or component modified by this feature, the set of public.booking_type enum values, the signatures of create_manual_assignment_with_invite/pprove_room_request/other existing RPCs, and the existing SELECT policies on complaints and oom_requests SHALL be byte-for-byte identical before and after this feature ships.
**Validates: Requirements 10.4, 10.5, 11.6, 11.7, 15.1, 15.2, 15.3**
---

## Deployment Note

This project's development environment has no live connection to the production Supabase instance (confirmed: no Supabase CLI project link or live DB credentials are available from this workspace, consistent with how every prior migration in `supabase/migrations/` has been handled). The new migration file `20260828000000_owner_dashboard_complaints_and_request_policies.sql` will be created and committed to the repository as part of this feature's implementation tasks, but **it must be manually applied to the production Supabase project** (via the Supabase SQL editor, `supabase db push`, or the team's existing deployment process) after the commit lands — the same manual-deployment step every other migration under `supabase/migrations/` has required. Implementation tasks for this spec will call this out explicitly rather than assuming the migration is auto-applied.

---

## Error Handling

- All new/modified Supabase mutations (hostel delete, room delete, room request delete, complaint insert/update, notification preference save) follow the codebase's existing pattern: catch the Supabase `error` object, surface `error.message` via `toast.error(...)` (via either `react-hot-toast` or `sonner`, matching whichever the containing file already imports — `app/owner/hostels/*` and `app/owner/rooms/*` use `react-hot-toast`; `app/owner/requests/page.tsx`, `app/owner/complaints/page.tsx`, and `app/owner/settings/page.tsx` mix `react-hot-toast`/`sonner` per-file already), and never render the raw error object, a stack trace, or (for password flows) the submitted password value.
- The new `DELETE` RLS policy on `room_requests` means an owner attempting to delete a non-rejected or not-owned request will receive zero affected rows (Supabase returns no error for a policy-filtered delete that matches nothing) rather than a thrown exception — the mutation's `onSuccess` path will fire, but the row will not actually be gone. Since the UI only ever offers the Delete action from within `RejectedRequestCard` (which only renders for `status === 'rejected'` items already scoped to the signed-in owner via the existing `hostels!inner` + `.eq('hostels.owner_id', user.id)` fetch filter), this edge case is not reachable through the UI and needs no additional client-side guard beyond the defense-in-depth `.eq('status', 'rejected')` already included in the mutation.
- The new `complaints` INSERT/UPDATE policies will cause previously-silently-broken operations to start succeeding; no new error paths are introduced. If a future non-owner/non-student caller attempts INSERT/UPDATE outside the policy's `WITH CHECK`, Supabase returns a standard RLS-violation error, which is already handled by each call site's existing `catch`/`onError` block.

---

## Testing Strategy

- **Hostel/Room forms (Phases 1–2):** manual verification that the Add Hostel form no longer sends `starting_price` in its insert payload (confirm via browser network tab or a quick `console.log` during development, removed before commit) and that existing hostel rows' `starting_price` is unaffected; verify Add Room's Capacity field still creates the correct number of `beds` rows.
- **Room Requests deletion (Phase 3):** manual test as an owner — attempt to delete a rejected request (should succeed and disappear from the list after refetch); attempt (via direct API/SQL, not UI) to delete a `pending`/`approved` request or a request belonging to another owner's hostel (should be blocked by RLS, zero rows affected).
- **Complaints RLS (Phase 5):** manual test as a student — submit a new complaint via `NewComplaintDialog` and confirm the row is created (previously this INSERT was unpermitted/relying on default behavior; after the migration it is explicitly and correctly permitted). Manual test as an owner — change a complaint's status via `app/owner/complaints/page.tsx` and confirm the `UPDATE` persists and the student sees the new status after reload. Manual test that a student cannot read another student's complaints and that the owner can only see complaints for hostels they own (regression check on the untouched SELECT policy).
- **Booking type labels (Phase 4):** manual visual check across Assign Student form, Room Request form, Room Request cards/modals, Approved Allocation cards, and Student list/profile pages that all `shared_bed`-backed UI reads "Entire Shared Room" and all `entire_room`-backed UI reads "Entire Room" (or "Entire Room (Private)" on the one line where the extra qualifier is retained), while confirming the actual submitted/persisted values are unchanged (inspect the network request body or the resulting `room_allocations.booking_type`/`room_requests.booking_type` row value).
- **Notification preferences (Phase 6):** manual test — toggle both owner notification checkboxes, save, reload the page, and confirm the previously-saved state (not the default) is shown; confirm `user.user_metadata.notify_room_requests`/`notify_complaints` reflect the saved values (inspectable via Supabase Auth user record).
- **Regression (Requirement 15):** run `npx tsc --noEmit` and the project's production build command; confirm no new compile/build errors relative to the pre-change baseline. No existing test suite currently covers these owner-dashboard pages (none found under `app/owner/**` during investigation aside from files unrelated to this feature), so no automated test regressions are expected; this feature does not introduce a new automated test framework, consistent with keeping changes minimal and scoped.

---

## Design Decisions and Rationale

**Why `rooms.capacity` is retained, not removed:** Investigation confirmed `capacity` is a `NOT NULL` column with no database trigger, function, or generated-column rule that derives it from `room_type` or any other field. The Add Room form's client-side loop (`for (let i = 1; i <= Number(formData.capacity); i++) { beds.push(...) }`) is the *only* mechanism that determines how many `beds` rows get created. Removing the input (or hiding it and silently defaulting it) would either break bed generation for room types that don't map 1:1 to a fixed bed count, or require adding new derivation logic (a trigger, a lookup table) that Requirement 5 explicitly does not ask for and that would expand scope well beyond this feature's stated boundaries. Keeping it as an explicit, required, owner-visible input is the only change consistent with "no existing derivation rule" and "SHALL NOT auto-submit a capacity value without owner-visible confirmation."

**Why "Starting Rent" is removed only from the form, not the schema:** Requirement 2 explicitly distinguishes the *input* (a UI element on one specific form) from the *column* (`hostels.starting_price`), and AC3/AC4 explicitly forbid touching the column or the existing dashboard summary card that reads it. The column has a `DEFAULT 0`, so omitting the field from the insert payload is a zero-risk, backward-compatible change — new hostels simply get the same `0` default that any hostel created without an explicit override would already get, and every other reader of `starting_price` (the dashboard card) is completely unaffected because it reads existing/future rows exactly as before.

**Why notification preferences reuse `user_metadata` instead of a new table:** `app/student/settings/page.tsx` already implements and ships this exact pattern (`supabase.auth.updateUser({ data: { ... } })` for `email_notifications`, `announcements_notifications`, `payment_reminders`), and Requirement 13's AC1 and AC3 explicitly mandate reusing that same mechanism and explicitly prohibit introducing a new preferences table. Beyond the explicit requirement, `user_metadata` is the right fit here regardless: these are simple boolean per-user flags with no need for relational queries, joins, or row-level security beyond "the user can read/write their own," which Supabase Auth's user metadata already provides for free without any new schema, migration, or RLS policy.

**Why the QR removal is scoped only to the two fake modals, not `payment_methods.qr_code_url`:** The two removed QR modals (`QrCodeModal` in `app/owner/requests/page.tsx` and the inline QR block in `app/owner/students/[id]/page.tsx`) render a hand-drawn SVG pattern with no backing data — no `qr_code_url` field, no student-check-in encoding, nothing scannable or functional. They are purely decorative placeholders labeled "Digital Check-In QR" that don't correspond to any real feature described anywhere in the codebase. `payment_methods.qr_code_url`, by contrast, is a real column populated by real owner-uploaded images (see the file-upload logic in `app/owner/settings/payment-methods/page.tsx`) and read by real student-facing billing UI (`app/student/bills/page.tsx`) to let students actually scan a payment QR code. Requirement 7's AC2 explicitly calls this out as a feature that must not be touched, and the two are structurally unrelated (different tables, different components, different purposes), so there is no overlap risk in scoping the removal narrowly to the two placeholder modals.
