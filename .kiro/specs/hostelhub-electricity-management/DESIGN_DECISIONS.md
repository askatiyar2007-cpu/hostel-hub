# Architectural Decision Records
# HostelHub Electricity Management System

**Date:** 2026-08-26

---

## ADR-001: Integer Paise for Money Storage

**Status:** Accepted

**Context:**  
Electricity charges require precise currency calculations. Floating-point arithmetic can introduce rounding errors (e.g., 0.1 + 0.2 ≠ 0.3 in binary).

**Decision:**  
Store all monetary amounts as INTEGER in paise (1/100 rupee) instead of DECIMAL.

**Rationale:**
- Prevents floating-point precision errors
- Ensures sum of charges equals segment total exactly (REQ-10.5, REQ-20.2)
- Enables deterministic remainder allocation (REQ-10.2, REQ-20.3)
- Standard practice in financial systems

**Consequences:**
- All calculations use integer arithmetic
- Display requires conversion (divide by 100)
- Database columns: `total_cost_paise INTEGER`, `charge_amount_paise INTEGER`

**Alternatives Rejected:**
- `DECIMAL(10,2)`: Risk of rounding errors in division
- `MONEY` type: PostgreSQL-specific, less portable

---

## ADR-002: Rate History Table with effective_from Timestamps

**Status:** Accepted

**Context:**  
Electricity rates change over time, but historical bills must remain immutable (REQ-11). Need to preserve audit trail and enable historical rate queries.

**Decision:**  
Create separate `electricity_rate_history` table with `effective_from` timestamps. Never UPDATE or DELETE rows.

**Rationale:**
- Preserves complete audit trail (REQ-2.5, REQ-11.8)
- Enables "what was rate on date X?" queries
- Prevents retroactive billing changes (REQ-11.4)
- Segment captures rate at creation time (REQ-11.1)

**Consequences:**
- Rate selection: `WHERE effective_from <= segment_creation ORDER BY effective_from DESC LIMIT 1`
- No `effective_to` column (implicit from next rate)
- Immutable rows (enforced by RLS)

**Alternatives Rejected:**
- Single current rate + snapshot in segments: No historical queries
- Temporal table with effective_from/to: More complex, unnecessary

---

## ADR-003: Reading Reason Enum Controls Segment Lifecycle

**Status:** Accepted

**Context:**  
Not all meter readings should trigger billing segment operations (REQ-3.7, REQ-3.8, REQ-7.1, REQ-7.2).

**Decision:**  
Use `reading_reason` ENUM. Only `occupancy_change` and `month_end` close/create segments. `manual_check` does NOT.

**Rationale:**
- Owners need to check meters without affecting billing
- Explicit control over segment boundaries
- Prevents accidental segment closures
- Clear semantics: initial=baseline, manual_check=informational only

**Consequences:**
- Application checks reason before segment operations
- Initial readings don't create segments
- Manual checks stored but don't affect billing

**Alternatives Rejected:**
- All readings close segments: Too rigid
- Separate table for non-billing readings: Unnecessary complexity

---

## ADR-004: Occupancy Change Events Track Pending State

**Status:** Accepted

**Context:**  
Occupancy changes require meter readings before completion (REQ-5.3), but readings may not be entered immediately (REQ-5.4, REQ-5.5).

**Decision:**  
Create `occupancy_change_events` table to track pending changes awaiting readings.

**Rationale:**
- Decouples allocation changes from meter readings
- Enables reminder notifications (REQ-15, REQ-25)
- Prevents completing allocation without reading
- Audit trail of occupancy change timeline

**Consequences:**
- Additional table and status tracking
- Validates reading timestamp <= change timestamp ("immediately before" - REQ-5.3)
- Supports pending state notifications

**Alternatives Rejected:**
- Block allocations until reading entered: Poor UX
- Allow allocations without readings: Violates billing accuracy

---

## ADR-005: Partial Unique Constraints for Active Records

**Status:** Accepted

**Context:**  
Only one active meter per room (REQ-1.2), only one open segment per room (REQ-7.7), but historical records must coexist.

**Decision:**  
Use partial unique constraints: `UNIQUE (room_id, status) WHERE status='active'` and `UNIQUE (room_id) WHERE end_date IS NULL`.

**Rationale:**
- Enforces business rules at database level
- Allows unlimited historical inactive/closed records
- Prevents race conditions
- PostgreSQL-native feature

**Consequences:**
- Constraint only applies to active/open subset
- Deactivating/closing removes from constraint
- Cannot be bypassed by application

**Alternatives Rejected:**
- Application-level enforcement: Race condition risk
- Unique on all records: Prevents historical data

---

## ADR-006: Segment Type Enum for Empty Rooms

**Status:** Accepted

**Context:**  
Empty rooms consume electricity but students shouldn't be charged (REQ-8.1, REQ-8.2, REQ-8.4).

**Decision:**  
Use `segment_type` ENUM ('occupied', 'empty') with CHECK constraint: `(occupant_count = 0 AND segment_type = 'empty') OR (occupant_count > 0 AND segment_type = 'occupied')`.

**Rationale:**
- Explicit semantic distinction
- Consumption tracked for owner reporting (REQ-8.3, REQ-8.6)
- Easy filtering in queries
- Clear charge calculation rule

**Consequences:**
- `segment_type='empty'` skips charge creation
- Empty segments visible in owner reports
- CHECK constraint enforces consistency

**Alternatives Rejected:**
- Boolean `is_empty`: Less clear
- Infer from occupant_count=0: Ambiguous

---

## ADR-007: Immutable Historical Records

**Status:** Accepted

**Context:**  
Billing data must be auditable and unchangeable after creation (REQ-7.7, REQ-11.3, REQ-20.5, REQ-22.1).

**Decision:**  
Prevent UPDATE and DELETE on historical tables via RLS policies: `FOR UPDATE/DELETE USING (FALSE)`.

**Rationale:**
- Financial audit requirements
- Prevents tampering (accidental or malicious)
- Historical bills never change
- Clear data lineage

**Consequences:**
- Corrections require new records (e.g., adjustment charges)
- Data retention policies must account for permanent storage
- RLS enforces immutability

**Alternatives Rejected:**
- Allow updates with audit log: Risk of inconsistency
- Soft delete: Still allows modification

---

## ADR-008: Advisory Locks for Meter Reading Concurrency

**Status:** Accepted

**Context:**  
Concurrent reading submissions for same meter could create race conditions (REQ-4.4, REQ-23.9).

**Decision:**  
Use PostgreSQL advisory locks (`pg_advisory_lock`) during reading insertion.

**Rationale:**
- Serializes operations on same meter
- Prevents duplicate detection failures
- Simpler than SERIALIZABLE isolation
- Auto-released on connection close

**Consequences:**
- Lock acquisition at operation start
- Lock released after validation
- Potential contention (acceptable for infrequent readings)

**Alternatives Rejected:**
- SERIALIZABLE isolation: Broader scope than needed
- Unique constraint only: Doesn't prevent validation races

---

## Summary of Key Decisions

1. **Money:** INTEGER paise (not DECIMAL)
2. **Rates:** Immutable history table with effective_from
3. **Readings:** Reason enum controls segment lifecycle
4. **Occupancy:** Pending events table for state tracking
5. **Uniqueness:** Partial constraints for active records
6. **Empty Rooms:** Explicit type enum with constraints
7. **Immutability:** RLS prevents historical modifications
8. **Concurrency:** Advisory locks for critical operations

**All decisions align with requirements and DECISION_RECORD.md**

