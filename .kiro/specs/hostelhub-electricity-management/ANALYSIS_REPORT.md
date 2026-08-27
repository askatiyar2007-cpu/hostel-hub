# REQUIREMENTS ANALYSIS REPORT
# HostelHub Electricity Management System
# Date: 2026-08-26 18:18

## EXECUTIVE SUMMARY

Analysis Status: COMPLETE ✅
Total Items Analyzed: 28
Auto-Resolvable Items: 4
User-Clarified Items: 24
Critical Issues Found: 12
Blocking Issues: 3

## CRITICAL FINDINGS REQUIRING DECISIONS BEFORE DESIGN

### 🔴 BLOCKING ISSUE 1: Occupancy Change Timing and Segment Closure

**Problem:** The requirements create a temporal paradox in the occupancy change flow.

**Current Specification:**
- REQ-5.3: "Meter reading must be recorded immediately BEFORE the occupancy change"
- REQ-5.6: "When occupancy change occurs, close the current segment using the NEW meter reading"
- REQ-5.7: "When occupancy change occurs, create a new segment with updated occupant list"

**The Paradox:**
`
Timeline Issue:
T1: Student B is about to join Room 101
T2: Owner records meter reading (1100 units) ← "immediately before"
T3: Student B joins (occupancy changes from 1 to 2)

Question: At T2, what is the occupant count?
- If it's 1 (Student A only), then the reading closes segment with occupant_count=1
- But T2 is "immediately before" T3, so has the change "occurred" yet?
- How does the system know T2 is specifically for the T3 event?
`

**Decision Required:**
1. Should the meter reading be tagged/linked to a specific pending occupancy change event?
2. Should the occupancy change be "detected" but "blocked" until reading is recorded?
3. How does the system determine which occupancy change a reading is for if multiple students are scheduled?

**Recommended Solution:**
`
1. When owner schedules student join/leave → System creates "pending_occupancy_change" record
2. System requires meter reading with link to pending_occupancy_change_id
3. Reading is recorded with current occupancy (before change)
4. System closes segment with pre-change occupancy, then applies the change
5. System creates new segment with post-change occupancy
`

**Impact:** Affects database schema (need pending_occupancy_changes table), API design, and UI flow.

---

### 🔴 BLOCKING ISSUE 2: Rounding Money Calculation Error

**Problem:** Integer division for electricity charges can lose money.

**Current Specification:**
- REQ-10.1: "Calculate each Student's Segment_Charge as total_cost divided by occupant_count"
- REQ-10.2: "Allocate remainder cents to student with lowest student_id"

**The Problem:**
`
Example 1: ₹1 ÷ 3 students
- Integer division: ₹0.33, ₹0.33, ₹0.33 = ₹0.99 (lost ₹0.01)
- With remainder: ₹0.34, ₹0.33, ₹0.33 = ₹1.00 ✓

Example 2: ₹10.47 ÷ 3 students
- Naive: ₹3.49, ₹3.49, ₹3.49 = ₹10.47 ✓
- But what if precision requires: ₹3.4900, ₹3.4900, ₹3.4900?
`

**Decision Required:**
1. What is the money precision? (2 decimal places for ₹0.01 precision?)
2. Should we store amounts as integers (paise) instead of decimals?
3. Exact rounding algorithm: Floor division + allocate remainder, or round-robin distribution?

**Recommended Solution:**
`sql
-- Store all amounts as INTEGER (paise, not rupees)
total_cost_paise INTEGER NOT NULL  -- e.g., 100 paise = ₹1.00

-- Calculation:
base_charge = total_cost_paise / occupant_count  -- integer division
remainder = total_cost_paise % occupant_count
-- Allocate remainder to first 'remainder' students (sorted by student_id)
`

**Impact:** Database schema (use INTEGER for amounts), calculation logic, display formatting.

---

### 🔴 BLOCKING ISSUE 3: Empty Room vs Zero Occupants Ambiguity

**Problem:** Two requirements contradict on what happens when occupant_count = 0.

**Current Specification:**
- REQ-8.1: "When segment has occupant_count of zero, mark as Empty_Room"
- REQ-8.2: "Calculate consumption for Empty_Room but set total_cost to zero FOR STUDENT BILLING"
- REQ-24.3: "Handle rooms with occupant_count ranging from 0 to room capacity"
- REQ-24.4: "Charge students only for segments where they were present"

**Clarification from Analysis:**
- Empty_Room segments: consumption tracked, but students NOT charged
- Regular segments with 0 occupants: Should this even be possible?

**The Ambiguity:**
`
Scenario: Room 101 has 2 students. Both leave on the same day.

Option A: Create ONE segment with occupant_count=0 (Empty_Room)
Option B: Create TWO segments (one for each student leaving)
Option C: Handle as single "room becomes empty" event
`

**Decision Required:**
1. Can a regular Billing_Segment ever have occupant_count=0, or is that always Empty_Room?
2. When multiple students leave simultaneously, do we close segment before or after all leave?
3. Should Empty_Room be a separate boolean flag, or a segment type enum?

**Recommended Solution:**
`sql
CREATE TYPE segment_type AS ENUM ('occupied', 'empty');

-- Billing segment always reflects actual state
segment_type: 'occupied' when occupant_count > 0
segment_type: 'empty' when occupant_count = 0

-- Calculation rule:
IF segment_type = 'empty' THEN student_charges = 0
ELSE divide total_cost among occupants
`

**Impact:** Database schema (segment_type field), business logic, student charge calculation.

---

## CRITICAL DESIGN DECISIONS NEEDED

### Decision 1: Electricity Rate Storage Strategy

**Question:** Where and how should electricity rates be stored?

**Current Specification:**
- REQ-2: "Configure Electricity_Rate per hostel"
- REQ-11: "Store rate at segment creation time"

**Options:**

A. **Single Current Rate + Historical Capture**
`sql
hostels.current_electricity_rate DECIMAL
billing_segments.rate_per_unit_at_creation DECIMAL
`
Pros: Simple, clear current rate
Cons: No rate change history, can't query "what was rate on date X"

B. **Electricity_Rates Table with Effective Dates**
`sql
CREATE TABLE electricity_rates (
  id UUID PRIMARY KEY,
  hostel_id UUID REFERENCES hostels,
  rate_per_unit DECIMAL NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,  -- NULL = current
  created_by UUID
);
billing_segments.electricity_rate_id UUID REFERENCES electricity_rates
`
Pros: Full history, can query historical rates
Cons: More complex queries, need to find "rate effective at timestamp"

C. **Rate History + Denormalized in Segments**
`sql
-- Both A and B combined
hostels.current_electricity_rate DECIMAL
electricity_rates (full history)
billing_segments.rate_per_unit DECIMAL (denormalized)
`
Pros: Fast queries, full history, clear current rate
Cons: Data duplication, need to keep in sync

**Recommendation:** Option B or C (need to preserve full audit trail per REQ-11.7)

---

### Decision 2: Meter Reading → Segment Closure Workflow

**Question:** How does the system know WHEN to close a segment from a meter reading?

**Scenarios:**

1. **Occupancy Change Reading:**
   - Reading taken before student joins/leaves
   - Should close current segment and create new one
   
2. **Month-End Reading:**
   - Reading taken at end of month
   - Should close current segment and create new one for next month
   
3. **Manual Check Reading:**
   - Owner just checking the meter
   - Should this close segment or just record reading?

**Current Specification:**
- REQ-3.6: "Owner specifies reason: occupancy_change, month_end, manual_check"
- REQ-7.1: "When new reading is recorded, close the open segment"

**The Problem:** Does EVERY reading close a segment, or only certain reasons?

**Decision Required:**
`
IF reason = 'manual_check':
  → Just record reading, DON'T close segment
  OR
  → Close segment and immediately create new one with same occupants?

IF reason = 'occupancy_change':
  → Must close segment before occupancy changes
  → New segment gets updated occupant list

IF reason = 'month_end':
  → Close segment at month boundary
  → New segment starts next month with same occupants
`

**Recommended Solution:**
- 'occupancy_change' and 'month_end': Always close and create new segment
- 'manual_check': Just record reading, optionally close if segment has been open >30 days

---

### Decision 3: Same-Day Multiple Occupancy Changes

**Question:** What happens when multiple students join/leave the same room on the same day?

**Scenario:**
`
Room 101, August 15:
09:00 - Student A leaves (occupancy 2→1)
14:00 - Student C joins (occupancy 1→2)

Required readings:
09:00 reading (before A leaves)
14:00 reading (before C joins)

Segments:
Segment 1: Aug 1-15 09:00, occupants=[A,B]
Segment 2: Aug 15 09:00-14:00, occupants=[B]
Segment 3: Aug 15 14:00-31, occupants=[B,C]
`

**Decision Required:**
1. Can multiple segments exist for the same day?
2. How does UI handle entering multiple readings for same day?
3. Should system suggest "bundle" changes if they're within hours of each other?

**Recommended Solution:**
- Yes, allow multiple segments per day (accurate billing)
- UI shows timeline with all pending readings for the day
- System calculates even sub-day consumption accurately

---

### Decision 4: Initial Meter Reading Handling

**Question:** When a meter is first configured, what happens before the first reading?

**Current Specification:**
- REQ-4.5: "When no previous reading exists, accept first reading as baseline"

**Problem:**
`
Room 101 meter configured on Aug 1
- No reading yet
- Student A allocated to room on Aug 1
  
What is the consumption for August?
- Can't calculate without starting reading
- Should system require initial reading at meter configuration?
- Or allow retroactive initial reading?
`

**Decision Required:**
1. Require initial reading when configuring meter?
2. Allow room allocation only after initial reading exists?
3. Or allow allocation, but defer billing until first full segment?

**Recommended Solution:**
`
1. Meter configuration requires initial_reading at creation time
2. This serves as the baseline for all future calculations
3. No segments created until a second reading is recorded
4. UI clearly shows "Meter configured, awaiting first billing reading"
`

---

### Decision 5: Mid-Month Rate Changes

**Question:** When a rate changes mid-month with an open segment, what rate does the segment use?

**Current Specification:**
- REQ-2.3: "Apply new rate only to new segments created AFTER the change"
- REQ-11.1: "Store rate effective at segment creation time"

**Scenario:**
`
August 1: Rate = ₹8/unit, Segment opens
August 15: Owner changes rate to ₹9/unit
August 31: Month-end reading

Which rate for August segment?
Option A: ₹8 (rate when segment was created)
Option B: ₹9 (current rate when segment closes)
Option C: Split segment at rate change date?
`

**Recommended Solution:**
`
Use rate at segment CREATION time (Option A)
- Segment created Aug 1 with rate ₹8
- Rate change Aug 15 doesn't affect this segment
- Next segment (Sep 1) uses new rate ₹9

Rationale: Simpler, preserves "segment = fixed period with fixed rate"
`

---

## EDGE CASES REQUIRING SPECIFICATION

### Edge Case 1: Student Leaves and Rejoins Same Day

`
Room 101, August 15:
09:00 - Student A checks out
15:00 - Student A checks back in

Required:
- Reading at 09:00 (before checkout)
- Reading at 15:00 (before check-in)

Segments:
- Segment ending 09:00 includes Student A
- Segment 09:00-15:00 excludes Student A
- Segment starting 15:00 includes Student A

Question: Should system warn "same student checking back in same day"?
`

### Edge Case 2: Room Capacity Changes Mid-Month

`
Room 101:
- Aug 1-15: Capacity 2, occupancy 2
- Aug 16: Room renovated, capacity increased to 3
- Aug 16-31: Capacity 3, occupancy 3

Question: Does changing room.capacity trigger a segment closure?
Answer: No, only actual occupancy changes (student allocations) trigger segments.
`

### Edge Case 3: Meter Replacement

`
Room 101:
- Aug 1-15: Old meter, reading 1000 → 1100
- Aug 15: Meter replaced
- Aug 15: New meter, initial reading 0
- Aug 15-31: New meter, reading 0 → 50

How to handle:
- Close segment with old meter reading 1100
- Create new meter with initial reading 0
- New segment starts from new meter reading 0
- Readings from different meters are NOT comparable
`

### Edge Case 4: Negative Time Segments (Clock Adjustment)

`
If system clock is adjusted backward or timezone changes:
- Reading 1: Aug 15 14:00, value 1100
- Reading 2: Aug 15 13:00, value 1150 (due to clock adjustment)

System should reject: timestamp must be >= previous timestamp
`

### Edge Case 5: Student Allocation Backdated

`
Owner manually creates allocation with start_date in the past:
- Today: Aug 31
- Owner creates allocation: Student B, start_date = Aug 15

Question: Should this retroactively create segments?
Answer: No - system should require readings to be recorded at time of change,
        not retroactively. Block backdated allocations requiring billing segments.
`

---

## AMBIGUITIES IN REQUIREMENTS

### Ambiguity 1: "Immediately Before" Definition

**REQ-5.3:** "Meter reading must be recorded immediately before the change"

**Questions:**
- What is "immediately"? Same hour? Same minute?
- Can reading be recorded 1 day before if owner knows student joins tomorrow?
- Should system validate reading timestamp is within X minutes of allocation timestamp?

**Recommendation:** Define explicit time window (e.g., reading must be within 24 hours before occupancy change)

---

### Ambiguity 2: Active Room_Allocation Definition

**REQ-6.4:** "Determine occupant_count from active Room_Allocations during the segment period"

**Questions:**
- Active = status='active'?
- Active = status='active' AND start_date <= segment_date AND (end_date IS NULL OR end_date > segment_date)?
- What if allocation has no end_date (permanent allocation)?

**Recommendation:** Define explicit query:
`sql
WHERE status = 'active'
  AND start_date <= segment_start_date
  AND (end_date IS NULL OR end_date > segment_end_date)
`

---

### Ambiguity 3: Billing Month Definition

**REQ-10.3:** "Sum all Segment_Charges for a Student within a billing month"

**Questions:**
- Is billing month calendar month (Aug 1-31)?
- Is billing month custom period (Aug 5 to Sep 4)?
- Do segments spanning month boundary belong to which month?

**Recommendation:** Use calendar month, segments are attributed to month of segment start_date

---

### Ambiguity 4: Month-End Reminder Timing

**REQ-9.6, REQ-25.2:** "Send reminders on the last day of each month"

**Questions:**
- What time of day? Midnight? 9 AM? 6 PM?
- What timezone? Server UTC? Owner's timezone? Hostel location timezone?
- If owner already entered reading on last day, still send reminder?

**Recommendation:**
- Send reminder at 9 AM in hostel's timezone (need to add timezone to hostels table)
- Only send if no month-end reading exists for that meter in current month

---

### Ambiguity 5: Deactivated Meter Behavior

**REQ-1.5, REQ-23.1:** "Allow deactivate without immediately creating replacement" + "Prevent deactivating meter with open segment"

**Questions:**
- If meter deactivated, can new allocations still be created for that room?
- If meter deactivated, what happens to future billing?
- Should deactivation also close any open segments?

**Recommendation:**
- Deactivating meter requires closing all open segments first (REQ-23.1)
- New allocations for room without active meter should be blocked OR show warning
- Reactivating meter requires new initial reading

---

## REQUIREMENTS NEEDING CLARIFICATION

### Clarification 1: Bulk Reading Entry (REQ-13.7)

**Question:** "Owner Dashboard shall allow bulk reading entry for multiple rooms"

**Details needed:**
- Does bulk entry create all readings with same timestamp?
- Does bulk entry allow different reasons per room?
- If one reading in bulk fails validation, does entire batch fail or partial success?
- UI design: Single form with multiple room inputs? CSV upload?

---

### Clarification 2: High Consumption Warning (REQ-4.7)

**Question:** "If new reading exceeds previous by >1000 units, display confirmation warning"

**Details needed:**
- Is 1000 units configurable per hostel/meter?
- Does warning block submission or just show confirmation dialog?
- Should system also warn for unusually LOW consumption (e.g., <10 units in 30 days)?

---

### Clarification 3: Notification Preferences (REQ-25)

**Question:** Integration with existing notification system

**Details needed:**
- Can owner configure notification preferences (email, in-app, SMS)?
- Should system respect existing notification_preferences table?
- Are electricity notifications a new category in notification system?

---

### Clarification 4: Export CSV Format (REQ-16.7, REQ-22.7)

**Question:** CSV export requirements

**Details needed:**
- What columns should be included?
- Should export include calculated fields or raw data?
- Should export be localized (₹ symbol, date format)?
- File naming convention?

---

### Clarification 5: Student Authorization on Roommate Data (REQ-18.5)

**Question:** "Student can view other occupants in the room during each segment"

**Privacy consideration:**
- Should students see full names of roommates?
- Should students see only "Occupant 1, Occupant 2" (anonymized)?
- Does this violate student privacy RLS policies?

**Recommendation:** Show only count "You shared this room with 1 other occupant" without names

---

## MISSING REQUIREMENTS

### Missing 1: Dispute Resolution Process

**Need:** What happens when student disputes electricity charge?

**Required specifications:**
- Can student flag a segment charge as disputed?
- Does owner get notified of dispute?
- Is there a dispute resolution workflow?
- Are disputed charges excluded from payment calculations?

---

### Missing 2: Meter Testing/Calibration

**Need:** What happens when owner suspects meter malfunction?

**Required specifications:**
- Can owner mark meter as "under maintenance"?
- Should system pause billing for malfunctioning meter?
- Can owner enter corrected readings retroactively?

---

### Missing 3: Partial Month Allocation Proration

**Need:** How to handle student allocations not starting on month start?

**Current:** System handles via segments (student only charged for their segments)
**Clarify:** Is this the intended behavior or should there be additional proration logic?

---

### Missing 4: Historical Data Migration

**Need:** What about rooms that already have students and electricity usage?

**Required specifications:**
- How to initialize system for existing occupied rooms?
- Should historical data be imported or start fresh?
- What is the initial_reading when configuring meter for occupied room?

---

### Missing 5: Electricity Bill Status

**Need:** What are the possible statuses for electricity charges?

**Current specs mention:**
- bills table has 'status' field
- student_fees has 'status' field

**Required specifications:**
- Should electricity charges have status: draft, finalized, paid, overdue?
- When does charge status change from draft to finalized?
- Integration with payment status tracking?

---

## DATABASE DESIGN RISKS

### Risk 1: Orphaned Segments

**Scenario:** Room_Allocation deleted, but Billing_Segments reference it

**Current Protection:** REQ-23.2: "Prevent deleting allocation if it would orphan segments"

**Risk:** What if deletion happens via direct database access or cascade delete?

**Mitigation:** Add database-level FK constraints with appropriate ON DELETE behavior

---

### Risk 2: Overlapping Segments

**Scenario:** Two open segments for same room simultaneously

**Risk:** Could happen due to race condition or bug

**Mitigation:** Database constraint:
`sql
-- Only one open segment per room at a time
CREATE UNIQUE INDEX idx_one_open_segment_per_room
  ON billing_segments(room_id)
  WHERE end_date IS NULL;
`

---

### Risk 3: Segment-Allocation Consistency

**Scenario:** Segment occupant_count doesn't match actual allocation count

**Risk:** Could happen if allocations modified after segment created

**Mitigation:** 
- Store segment_occupants junction table (immutable)
- Don't recalculate from current allocations

---

### Risk 4: Money Calculation Precision Loss

**Scenario:** Using DECIMAL(10,2) for amounts

**Risk:** Division produces more decimals than storage allows

**Mitigation:** Use INTEGER for amounts (paise), convert to rupees only for display

---

## RECOMMENDATIONS BEFORE DESIGN PHASE

### Critical Path Items (Must Resolve):

1. ✅ **Define Occupancy Change Workflow:**
   - How system links meter readings to specific occupancy events
   - Database schema for pending occupancy changes
   - API flow for owner entering readings

2. ✅ **Define Money Calculation Strategy:**
   - Use INTEGER (paise) vs DECIMAL (rupees)
   - Exact rounding algorithm for division
   - Code example of calculation

3. ✅ **Define Empty Room Handling:**
   - Segment type enum or boolean flag
   - Exact rules for when segment is empty vs occupied with 0 count

4. ✅ **Define Rate Storage Architecture:**
   - Table design for electricity_rates with history
   - Query pattern for "rate effective at timestamp"

### High Priority Items (Should Resolve):

5. ⚠️ Define "immediately before" time window
6. ⚠️ Define active allocation query pattern
7. ⚠️ Define billing month boundaries
8. ⚠️ Define initial meter reading workflow
9. ⚠️ Define mid-month rate change behavior

### Medium Priority Items (Can Defer):

10. 📋 Bulk reading entry UX details
11. 📋 CSV export format specification
12. 📋 Student privacy for roommate data
13. 📋 Dispute resolution process
14. 📋 Meter testing/maintenance workflow

---

## FINAL ANALYSIS SUMMARY

### Requirements Quality: GOOD ✅

- Well-structured with clear user stories
- Comprehensive coverage of main scenarios
- Strong focus on data integrity and authorization

### Blocking Issues: 3 CRITICAL 🔴

- Occupancy change timing paradox
- Money calculation precision
- Empty room ambiguity

### Design Readiness: 60% ⚠️

Can proceed to design phase AFTER resolving:
1. Critical path items (1-4 above)
2. High priority items (5-9 above)

### Next Steps:

1. **User Decision:** Resolve 3 critical blocking issues
2. **Update Requirements:** Incorporate decisions and clarifications
3. **Proceed to Design:** With confirmed business logic and database strategy
4. **Technical Design:** Create migrations, API design, UI mockups
5. **Implementation Plan:** Generate tasks.md with concrete action items

---

## APPENDIX: AUTO-RESOLVED ITEMS

1. **Month-end notification processing:** Only process active meters from start ✅
2. **Multiple active meters prevention:** Enforce as persistent system invariant ✅
3. **Student removal validation:** Set validation flag to confirm meter reading requirement ✅
4. **First reading consumption warning:** Skip warning checks for first readings ✅

All 4 items have been incorporated into requirements analysis.

---

**Report Generated:** 2026-08-26 18:18
**Status:** READY FOR DESIGN AFTER CRITICAL DECISIONS

