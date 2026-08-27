# Implementation Plan: HostelHub Electricity Management System

## Overview

This implementation plan breaks down the HostelHub Electricity Management System into discrete, actionable coding tasks. Each task references specific requirements and design sections, with dependencies and complexity estimates provided.

**Technology Stack:**
- Backend: TypeScript with Supabase client
- Frontend: Next.js 14 with React Server Components
- Database: PostgreSQL 14+ with Supabase
- Testing: Vitest for unit/integration tests

**Implementation Order:**
1. Database schema and infrastructure
2. Backend business logic and APIs
3. Authorization (RLS policies)
4. Frontend UI components
5. Testing and validation

---

## Tasks

- [ ] 1. Set up database schema foundation
  - Create ENUM types (reading_reason, segment_type, occupancy_change_type)
  - Create 7 core tables with complete schema definitions
  - Add all foreign key relationships and ON DELETE behaviors
  - _Requirements: REQ-1.1, REQ-2.3, REQ-3.2, REQ-6.1, REQ-10.4_
  - _Design: Sections 2.2.1-2.2.7_
  - _Dependencies: None (first task)_
  - _Complexity: High - Foundation for entire system_

  - [ ]* 1.1 Write property test for database schema creation
    - **Property 1: All foreign keys reference valid tables**
    - **Validates: REQ-21.1, REQ-21.7**
    - Verify all FK constraints resolve correctly
    - Test cascade behaviors on DELETE operations

  - [ ] 1.2 Create database migration files
    - Migration 001: Core tables
    - Migration 002: Indexes
    - Migration 003: Triggers
    - Include DOWN migrations for rollback
    - _Requirements: REQ-20.4_
    - _Design: Section 12.1_

- [ ] 2. Implement database constraints and indexes
  - [ ] 2.1 Add partial unique constraints
    - One active meter per room constraint
    - One open segment per room constraint
    - _Requirements: REQ-1.2, REQ-7.7_
    - _Design: Sections 2.2.1, 2.2.4, ADR-005_

  - [ ] 2.2 Create performance indexes
    - Index on (hostel_id, meter_id, room_id) for fast lookups
    - Index on (reading_timestamp DESC) for reading history
    - Index on (billing_month, student_id) for charge queries
    - _Requirements: REQ-22.2_
    - _Design: Section 2.2 (all table indexes)_

  - [ ] 2.3 Add CHECK constraints
    - electricity_rate_history.rate_per_unit > 0
    - meter_readings.reading_value >= 0
    - billing_segments closed consistency constraint
    - billing_segments empty room type constraint
    - _Requirements: REQ-2.2, REQ-4.1, REQ-8.1_
    - _Design: Sections 2.2.2, 2.2.3, 2.2.4_

  - [ ]* 2.4 Write property test for constraint enforcement
    - **Property 2: Constraints prevent invalid data states**
    - **Validates: REQ-23.1, REQ-23.9**
    - Test that invalid operations are blocked at database level

- [ ] 3. Create database triggers and validation functions
  - [ ] 3.1 Implement validate_meter_reading_value() trigger
    - Validate new reading >= previous reading
    - Validate timestamp progression
    - Warn if consumption > 1000 units
    - _Requirements: REQ-3.3, REQ-4.3, REQ-4.8_
    - _Design: Section 2.2.3_

  - [ ] 3.2 Implement detect_occupancy_change() trigger
    - Detect Room_Allocation INSERT with status='active'
    - Detect Room_Allocation UPDATE with end_date or status change
    - Create occupancy_change_events records
    - _Requirements: REQ-5.1, REQ-5.2, REQ-5.4_
    - _Design: Section 3.4.1_

  - [ ]* 3.3 Write unit tests for trigger validation logic
    - Test reading value validation (accept equal, reject less)
    - Test high consumption warning
    - Test occupancy change detection conditions

- [ ] 4. Implement rate history management
  - [ ] 4.1 Create getApplicableRate() function
    - Query rate history with effective_from <= segment creation time
    - Return most recent applicable rate
    - Throw error if no rate exists
    - _Requirements: REQ-2.6, REQ-11.1_
    - _Design: Section 3.1.1_

  - [ ] 4.2 Create updateElectricityRate() function
    - Validate rate_per_unit > 0
    - Insert new row in electricity_rate_history
    - Display warning about open segments
    - _Requirements: REQ-2.1, REQ-2.4, REQ-11.4_
    - _Design: Section 3.1.2_

  - [ ]* 4.3 Write unit tests for rate selection algorithm
    - Test rate selection at segment creation time
    - Test multiple rates same day (most recent wins)
    - Test no rate exists (throws error)
    - Test future-dated rate ignored
    - _Design: Section 8.1.1_

- [ ] 5. Checkpoint - Database foundation complete
  - Ensure all migrations run successfully
  - Verify all constraints and indexes created
  - Run trigger validation tests
  - Ask user if questions arise

- [ ] 6. Implement meter reading validation logic
  - [ ] 6.1 Create validateMeterReading() function
    - Fetch previous reading for meter
    - Validate new reading >= previous
    - Warn if consumption > 1000 units
    - Return previous reading for UI confirmation
    - _Requirements: REQ-3.3, REQ-4.3, REQ-4.7_
    - _Design: Section 3.2.1_

  - [ ] 6.2 Create recordMeterReading() function
    - Insert reading with reason
    - Handle segment operations based on reason
    - Call closeOpenSegment() and createBillingSegment() for occupancy_change/month_end
    - Skip segment operations for initial/manual_check
    - _Requirements: REQ-3.7, REQ-3.8, REQ-7.1, REQ-7.2_
    - _Design: Section 3.2.2_

  - [ ]* 6.3 Write unit tests for reading validation
    - Test accepts reading equal to previous
    - Test rejects reading less than previous
    - Test warns for consumption > 1000 units
    - Test accepts first reading as baseline
    - _Design: Section 8.1.3_

- [ ] 7. Implement billing segment lifecycle
  - [ ] 7.1 Create getActiveOccupants() function
    - Query Room_Allocations active at reference timestamp
    - Handle NULL end_date as ongoing allocation
    - Return ordered list for deterministic remainder allocation
    - _Requirements: REQ-6.4_
    - _Design: Section 3.3.1_

  - [ ] 7.2 Create createBillingSegment() function
    - Get applicable rate from rate history
    - Get active occupants at timestamp
    - Determine segment_type (occupied vs empty)
    - Insert billing_segments record (open)
    - Insert segment_occupants records
    - _Requirements: REQ-6.1, REQ-6.7, REQ-8.1_
    - _Design: Section 3.3.2_

  - [ ] 7.3 Create closeOpenSegment() function
    - Find open segment for room
    - Calculate consumption and total_cost_paise
    - Update segment with end values
    - Call calculateStudentCharges() if occupied
    - Skip charges if empty segment
    - _Requirements: REQ-7.1, REQ-7.5, REQ-8.2_
    - _Design: Section 3.3.3_

  - [ ]* 7.4 Write unit tests for active allocation query
    - Test allocations active at specific timestamp
    - Test NULL end_date as ongoing
    - Test inactive status excluded
    - Test empty room returns empty array
    - _Design: Section 8.1.4_

- [ ] 8. Implement student charge calculation with paise precision
  - [ ] 8.1 Create calculateStudentCharges() function
    - Calculate base charge (integer division)
    - Calculate remainder
    - Allocate remainder to first N students (ordered by student_id)
    - Insert student_electricity_charges records
    - Validate sum equals segment total_cost_paise
    - _Requirements: REQ-10.1, REQ-10.2, REQ-20.1-REQ-20.3_
    - _Design: Section 3.3.4_

  - [ ]* 8.2 Write property test for paise calculation
    - **Property 3: Sum of charges equals segment total exactly**
    - **Validates: REQ-10.5, REQ-20.2**
    - Test various amounts and occupant counts
    - Test remainder allocation determinism

  - [ ]* 8.3 Write unit tests for charge calculation edge cases
    - Test ₹0.01 allocation (1 paise ÷ 3 students = [1,0,0])
    - Test ₹0.02 allocation (2 paise ÷ 3 students = [1,1,0])
    - Test exact division (900 paise ÷ 3 = [300,300,300])
    - Test large remainder (1000 paise ÷ 3 = [334,333,333])
    - _Design: Section 8.5 edge cases 4-7_

- [ ] 9. Implement occupancy change detection and processing
  - [ ] 9.1 Create processOccupancyChangeEvent() function
    - Fetch pending occupancy_change_events
    - Find qualifying reading (timestamp <= change_timestamp)
    - Update event status to reading_recorded/completed
    - Trigger segment operations
    - _Requirements: REQ-5.3, REQ-5.7_
    - _Design: Section 3.4.2_

  - [ ] 9.2 Create handleOccupancyChange() workflow
    - Validate allocation details
    - Get meter for room
    - Record reading with reason='occupancy_change'
    - Mark event as completed
    - Dismiss notification
    - _Requirements: REQ-5 (all), REQ-6, REQ-7_
    - _Design: Section 4.1_

  - [ ]* 9.3 Write integration test for occupancy change workflow
    - Test student join creates correct segments
    - Test student leave creates correct segments
    - Test multiple same-day changes processed chronologically
    - _Design: Section 8.2.1_

- [ ] 10. Checkpoint - Core business logic complete
  - Ensure reading validation working correctly
  - Verify segment lifecycle functions operational
  - Test paise calculation accuracy
  - Ask user if questions arise

- [ ] 11. Implement month-end processing
  - [ ] 11.1 Create getHostelTimezone() function
    - Query hostels table for timezone
    - Default to UTC if not set
    - _Requirements: REQ-9.3, REQ-9.6_
    - _Design: Section 3.5.1_

  - [ ] 11.2 Create generateMonthEndReminders() scheduled job
    - Query all hostels with active meters
    - Check if today is last day of month in hostel timezone
    - Skip if qualifying month-end reading exists
    - Create notification for pending readings
    - _Requirements: REQ-9.6, REQ-9.7, REQ-25.2, REQ-25.3_
    - _Design: Section 3.5.2_

  - [ ] 11.3 Implement month-end reading processing
    - Handle reason='month_end' in recordMeterReading()
    - Close segment with same occupants
    - Create new segment with unchanged occupant list
    - _Requirements: REQ-9.1, REQ-9.5_
    - _Design: Section 3.5.3_

  - [ ]* 11.4 Write integration test for month-end workflow
    - Test month-end reading closes and creates segments
    - Test reminder sent only if no reading exists
    - Test notification dismissed after reading recorded
    - _Design: Section 8.2.2_

- [ ] 12. Implement concurrency control and idempotency
  - [ ] 12.1 Create recordMeterReadingWithLock() function
    - Use PostgreSQL advisory locks
    - Check for duplicates within 60 seconds
    - Release lock in finally block
    - _Requirements: REQ-4.4, REQ-23.9_
    - _Design: Section 4.4_

  - [ ] 12.2 Create recordReadingIdempotent() function
    - Accept idempotency key
    - Check if operation already completed
    - Return existing result or create new
    - _Design: Section 4.5_

  - [ ]* 12.3 Write concurrency tests
    - Test duplicate readings within 60s blocked
    - Test advisory lock prevents race conditions
    - Test only one open segment per room enforced
    - _Design: Sections 8.4.1, 8.4.2_

- [ ] 13. Implement API endpoints - Meter Management
  - [x] 13.1 Create POST /api/meters/create endpoint
    - Validate hostel ownership
    - Validate room belongs to hostel
    - Check no active meter exists
    - Create meter and initial reading
    - _Requirements: REQ-1.1, REQ-1.3, REQ-4.5_
    - _Design: Section 6.2.1_

  - [ ] 13.2 Create POST /api/meters/:meterId/deactivate endpoint
    - Check for open segments (block if exists)
    - Update meter status to inactive
    - Preserve historical data
    - _Requirements: REQ-1.5, REQ-23.1, REQ-23.2_
    - _Design: Section 6.2.2_

  - [ ] 13.3 Create GET /api/meters endpoint
    - Filter by hostel_id and status
    - Include last reading and open segment info
    - Show pending reading indicators
    - _Requirements: REQ-12.1, REQ-12.3, REQ-12.6_
    - _Design: Section 6.2.3_

- [ ] 14. Implement API endpoints - Reading Management
  - [ ] 14.1 Create POST /api/readings/record endpoint
    - Validate meter ownership
    - Validate reading value
    - Call recordMeterReadingWithLock()
    - Return affected segments and warnings
    - _Requirements: REQ-3.1, REQ-13.1, REQ-13.3_
    - _Design: Section 6.3.1_

  - [ ] 14.2 Create GET /api/readings/history endpoint
    - Filter by meter_id, date range
    - Calculate consumption since previous
    - Include recorded_by name
    - _Requirements: REQ-22.2, REQ-22.3_
    - _Design: Section 6.3.2_

- [ ] 15. Implement API endpoints - Billing
  - [ ] 15.1 Create GET /api/billing/student-charges endpoint
    - Filter by student_id and billing_month
    - Join segments to show details
    - Calculate monthly totals
    - _Requirements: REQ-17.1, REQ-17.3_
    - _Design: Section 6.4.1_

  - [ ] 15.2 Create GET /api/billing/overview endpoint
    - Aggregate by room for hostel owner
    - Separate occupied and empty room consumption
    - Calculate total revenue
    - _Requirements: REQ-16.1, REQ-16.2, REQ-16.5_
    - _Design: Section 6.4.2_

  - [ ] 15.3 Create GET /api/billing/export endpoint
    - Generate CSV file with billing data
    - Include room, segment, student details
    - Set appropriate headers for download
    - _Requirements: REQ-16.7, REQ-22.7_
    - _Design: Section 6.4.3_

- [ ] 16. Implement API endpoints - Rate Management
  - [ ] 16.1 Create POST /api/rates/update endpoint
    - Validate rate > 0
    - Insert new rate history row
    - Count and return open segments affected
    - _Requirements: REQ-2.1, REQ-14.2, REQ-14.3_
    - _Design: Section 6.5.1_

  - [ ] 16.2 Create GET /api/rates/history endpoint
    - Return complete rate history
    - Mark current rate
    - Include creator info
    - _Requirements: REQ-14.5, REQ-11.7_
    - _Design: Section 6.5.2_

- [ ] 17. Implement API endpoints - Notifications
  - [ ] 17.1 Create GET /api/notifications/pending-readings endpoint
    - Query occupancy_change_events pending
    - Query month-end reminders
    - Sort by priority and deadline
    - _Requirements: REQ-15.2, REQ-15.3, REQ-25.1_
    - _Design: Section 6.6.1_

- [ ] 18. Checkpoint - Backend APIs complete
  - Ensure all 22 API endpoints implemented
  - Test API validation with invalid data
  - Verify error handling and responses
  - Ask user if questions arise

- [ ] 19. Implement Row-Level Security (RLS) policies
  - [ ] 19.1 Enable RLS on all 7 tables
    - Execute ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    - _Requirements: REQ-19.1-REQ-19.7_
    - _Design: Section 5_

  - [ ] 19.2 Create electricity_meters RLS policies (4 policies)
    - owners_view_own_meters (SELECT)
    - owners_create_own_meters (INSERT)
    - owners_update_own_meters (UPDATE)
    - prevent_meter_deletion (DELETE - FALSE)
    - _Requirements: REQ-19.1_
    - _Design: Section 5.2_

  - [ ] 19.3 Create electricity_rate_history RLS policies (4 policies)
    - owners_view_own_rates (SELECT)
    - owners_create_own_rates (INSERT)
    - prevent_rate_modifications (UPDATE - FALSE)
    - prevent_rate_deletion (DELETE - FALSE)
    - _Requirements: REQ-19.1, REQ-11.3_
    - _Design: Section 5.3_

  - [ ] 19.4 Create meter_readings RLS policies (5 policies)
    - owners_view_own_readings (SELECT)
    - owners_create_own_readings (INSERT)
    - prevent_reading_modifications (UPDATE - FALSE)
    - prevent_reading_deletion (DELETE - FALSE)
    - students_view_current_room_readings (SELECT)
    - _Requirements: REQ-19.2, REQ-20.4_
    - _Design: Section 5.4_

  - [ ] 19.5 Create billing_segments RLS policies (5 policies)
    - owners_view_own_segments (SELECT)
    - service_create_segments (INSERT - service_role)
    - prevent_closed_segment_updates (UPDATE - only open)
    - prevent_segment_deletion (DELETE - FALSE)
    - students_view_own_segments (SELECT)
    - _Requirements: REQ-19.1, REQ-7.7_
    - _Design: Section 5.5_

  - [ ] 19.6 Create segment_occupants RLS policies (4 policies)
    - owners_view_segment_occupants (SELECT)
    - service_create_occupants (INSERT - service_role)
    - prevent_occupant_modifications (UPDATE - FALSE)
    - prevent_occupant_deletion (DELETE - FALSE)
    - students_view_own_occupancy (SELECT)
    - _Requirements: REQ-7.6_
    - _Design: Section 5.6_

  - [ ] 19.7 Create student_electricity_charges RLS policies (4 policies)
    - students_view_own_charges (SELECT)
    - owners_view_hostel_charges (SELECT)
    - service_create_charges (INSERT - service_role)
    - prevent_charge_modifications (UPDATE - FALSE)
    - prevent_charge_deletion (DELETE - FALSE)
    - _Requirements: REQ-19.3, REQ-10.7_
    - _Design: Section 5.7_

  - [ ] 19.8 Create occupancy_change_events RLS policies (3 policies)
    - owners_view_occupancy_events (SELECT)
    - service_manage_events (ALL - service_role)
    - (No student access)
    - _Requirements: REQ-15.2_
    - _Design: Section 5.8_

  - [ ]* 19.9 Write security tests for RLS policies
    - Test cross-hostel access prevention
    - Test IDOR attack scenarios
    - Test student access restrictions
    - _Design: Sections 8.3.1, 8.3.2_

- [ ] 20. Create TypeScript types and Zod schemas
  - [ ] 20.1 Generate Supabase database types
    - Run Supabase type generation
    - Export all table row types
    - _Requirements: REQ-26.4_
    - _Design: Section 15.3_

  - [ ] 20.2 Define API request/response schemas
    - Create Zod schemas for all 22 endpoints
    - Export TypeScript interfaces
    - _Requirements: REQ-26.3_
    - _Design: Section 6 (all API specs)_

  - [ ] 20.3 Define core domain types
    - ReadingReason, SegmentType, OccupancyChangeType enums
    - ElectricityMeter, MeterReading, BillingSegment interfaces
    - _Requirements: REQ-26.1_
    - _Design: Section 15.3_

- [ ] 21. Implement Owner Dashboard - Meter Management Page
  - [ ] 21.1 Create MeterManagementPage component
    - Display all meters with status badges
    - Show last reading and pending indicators
    - Add filter bar (status, pending readings)
    - Include create meter button
    - _Requirements: REQ-12.1, REQ-12.3, REQ-12.6_
    - _Design: Section 7.1.1_

  - [ ] 21.2 Create MeterCard component
    - Display room number, meter number, status
    - Show last reading with date
    - Include action buttons (view history, record reading, deactivate)
    - _Requirements: REQ-12.3_
    - _Design: Section 7.1.1_

  - [ ] 21.3 Create CreateMeterModal component
    - Select room dropdown
    - Enter meter number input
    - Enter initial reading input
    - Validate and submit
    - _Requirements: REQ-12.2_
    - _Design: Section 7.1.1_

- [ ] 22. Implement Owner Dashboard - Reading Entry Page
  - [ ] 22.1 Create ReadingEntryPage component
    - Display meter info (room, meter number)
    - Show previous reading with timestamp
    - Calculate days elapsed
    - _Requirements: REQ-13.2, REQ-13.4_
    - _Design: Section 7.1.2_

  - [ ] 22.2 Create ReadingForm component
    - Reading value input with validation
    - Reason selector dropdown
    - Notes textarea
    - Expected consumption preview
    - Confirmation dialog for high consumption
    - _Requirements: REQ-13.3, REQ-4.8_
    - _Design: Section 7.1.2_

  - [ ] 22.3 Create ImpactPreview component
    - Show segments that will be closed/created
    - For occupancy_change: show before/after occupants
    - For month_end: show monthly totals
    - _Requirements: REQ-13.4_
    - _Design: Section 7.1.2_

- [ ] 23. Implement Owner Dashboard - Billing Overview Page
  - [ ] 23.1 Create BillingOverviewPage component
    - Month selector calendar picker
    - Summary cards (consumption, revenue, empty rooms)
    - Room billing table
    - Export CSV button
    - _Requirements: REQ-16.1, REQ-16.7_
    - _Design: Section 7.1.3_

  - [ ] 23.2 Create RoomBillingTable component
    - Display room rows with segments count
    - Show consumption and revenue
    - Highlight empty room consumption
    - View details button per room
    - _Requirements: REQ-16.2, REQ-16.5_
    - _Design: Section 7.1.3_

  - [ ] 23.3 Create FilterBar component
    - Filter by room type
    - Show only empty rooms toggle
    - Show only occupied rooms toggle
    - _Requirements: REQ-16.3_
    - _Design: Section 7.1.3_

- [ ] 24. Implement Owner Dashboard - Rate Configuration Page
  - [ ] 24.1 Create RateConfigurationPage component
    - Display current rate prominently
    - Show effective from date
    - Update rate form with validation
    - Rate history table
    - _Requirements: REQ-14.1, REQ-14.5_
    - _Design: Section 7.1.4_

  - [ ] 24.2 Create UpdateRateForm component
    - New rate input (validate > 0)
    - Effective from display (auto NOW)
    - Notes textarea
    - Warning about open segments
    - _Requirements: REQ-14.2, REQ-14.3_
    - _Design: Section 7.1.4_

  - [ ] 24.3 Create RateHistoryTable component
    - Display all historical rates
    - Show effective from dates
    - Display creator names
    - Mark current rate with badge
    - _Requirements: REQ-14.5_
    - _Design: Section 7.1.4_

- [ ] 25. Implement Student Dashboard - Electricity Charges Page
  - [ ] 25.1 Create StudentElectricityPage component
    - Month selector
    - Total charge card (prominent)
    - Charge breakdown list
    - Calculation explanation section
    - _Requirements: REQ-17.1, REQ-18.1_
    - _Design: Section 7.2.1_

  - [ ] 25.2 Create SegmentCard component
    - Show room number and date range
    - Display consumption, rate, occupant count
    - Show student's individual charge
    - Display calculation formula with values
    - _Requirements: REQ-17.2, REQ-17.3, REQ-18.4_
    - _Design: Section 7.2.1_

  - [ ] 25.3 Create CalculationExplanation component
    - Show formula: (end_reading - start_reading) × rate ÷ occupants
    - Display example with actual values
    - Explain paise allocation
    - _Requirements: REQ-18.1_
    - _Design: Section 7.2.1_

- [ ] 26. Implement Student Dashboard - Billing History Page
  - [ ] 26.1 Create BillingHistoryPage component
    - Display monthly history list
    - Show month summaries (charges, segment counts)
    - Download PDF statement button
    - _Requirements: REQ-17.7, REQ-18.7_
    - _Design: Section 7.2.2_

  - [ ] 26.2 Create MonthSummaryCard component
    - Display month (YYYY-MM)
    - Show total charge
    - Show number of segments
    - View details button
    - _Requirements: REQ-17.7_
    - _Design: Section 7.2.2_

- [ ] 27. Checkpoint - UI components complete
  - Ensure all owner dashboard pages functional
  - Verify student dashboard displays charges correctly
  - Test responsive design on mobile/tablet
  - Ask user if questions arise

- [ ] 28. Write integration tests for complete workflows
  - [ ]* 28.1 Test complete occupancy change workflow
    - Student join creates correct segments with charges
    - Student leave closes and creates segments properly
    - Charges calculated correctly for each occupant
    - _Design: Section 8.2.1_

  - [ ]* 28.2 Test month-end processing workflow
    - Month-end reading closes and creates segments
    - Reminders sent on last day of month
    - Notification dismissed after reading
    - _Design: Section 8.2.2_

  - [ ]* 28.3 Test rate change impact workflow
    - New rate doesn't affect open segments
    - New segments use new rate
    - Historical segments preserve original rate
    - _Design: Section 8.2.3_

  - [ ]* 28.4 Test empty room handling workflow
    - Empty segment tracks consumption with zero charges
    - Transition from occupied to empty
    - Transition from empty to occupied
    - _Design: Section 8.2.4_

- [ ] 29. Write edge case tests
  - [ ]* 29.1 Test billing edge cases
    - Zero occupants (empty room)
    - One occupant (single student gets full charge)
    - Same-day join and leave
    - _Design: Section 8.5 cases 1-3_

  - [ ]* 29.2 Test paise allocation edge cases
    - ₹0.01 ÷ 3 students = [1,0,0]
    - ₹0.02 ÷ 3 students = [1,1,0]
    - Exact division 900 ÷ 3 = [300,300,300]
    - Large remainder 1000 ÷ 3 = [334,333,333]
    - _Design: Section 8.5 cases 4-7_

  - [ ]* 29.3 Test reading edge cases
    - Reading equals previous (zero consumption)
    - First reading (no previous to compare)
    - Reading after month gap
    - Multiple readings same day
    - _Design: Section 8.5 cases 8-11_

  - [ ]* 29.4 Test boundary edge cases
    - Month-end on 28th (February)
    - Month-end on 31st
    - Leap year Feb 29
    - Timezone crossing midnight
    - Rate change at midnight
    - Occupancy change at 00:00:00
    - _Design: Section 8.5 cases 12-17_

  - [ ]* 29.5 Test operational edge cases
    - Manual_check reading doesn't close segment
    - Deactivated meter blocks allocations
    - No active meter blocks segments
    - Meter replaced (new meter fresh readings)
    - Missing reading blocks allocation
    - _Design: Section 8.5 cases 18-22_

- [ ] 30. Implement scheduled jobs and background tasks
  - [ ] 30.1 Create month-end reminder scheduled job
    - Run daily at 9 AM
    - Check each hostel's timezone
    - Generate reminders for last day of month
    - Skip if reading already exists
    - _Requirements: REQ-9.6, REQ-25.2_
    - _Design: Section 3.5.2_

  - [ ] 30.2 Create overdue reading reminder job
    - Send daily summary for readings > 24 hours old
    - High-priority for occupancy changes
    - _Requirements: REQ-25.8_
    - _Design: Section 6.6.1_

- [ ] 31. Implement notification system integration
  - [ ] 31.1 Create notification creation function
    - Support types: occupancy_change, month_end, overdue
    - Set priority levels
    - Include action URLs
    - _Requirements: REQ-15.1, REQ-25.1_
    - _Design: Section 6.6.1_

  - [ ] 31.2 Create notification dismissal function
    - Auto-dismiss when reading recorded
    - Manual dismiss option
    - Handle failures gracefully
    - _Requirements: REQ-15.6, REQ-25.7_
    - _Design: Sections 4.1, 6.6.1_

  - [ ] 31.3 Create notification display component
    - Badge with count in navigation
    - Notifications panel with list
    - Sort by priority and deadline
    - _Requirements: REQ-15.4, REQ-25.9_
    - _Design: Section 6.6.1_

- [ ] 32. Write API validation and error handling tests
  - [ ]* 32.1 Test API input validation
    - Invalid meter_id (non-UUID)
    - Negative reading value
    - Rate <= 0
    - Missing required fields

  - [ ]* 32.2 Test authorization failures
    - Owner accessing other hostel's data
    - Student accessing other student's charges
    - Unauthenticated requests

  - [ ]* 32.3 Test business logic errors
    - Creating meter for non-owned hostel
    - Recording reading for deactivated meter
    - Closing segment without open segment
    - Creating segment without rate configured

- [ ] 33. Perform security audit and penetration testing
  - [ ]* 33.1 Test RLS policy enforcement
    - Attempt cross-hostel data access
    - Test IDOR vulnerabilities
    - Verify immutability policies
    - _Design: Sections 5.9, 8.3_

  - [ ]* 33.2 Test API authorization
    - Test all 22 endpoints with unauthorized users
    - Verify ownership checks
    - Test role-based access

  - [ ]* 33.3 Test data modification restrictions
    - Attempt to modify closed segments
    - Attempt to delete historical readings
    - Attempt to update immutable rate history

- [ ] 34. Database seeding and test data setup
  - [ ] 34.1 Create development seed script
    - 2 hostels with different rates
    - 10 rooms per hostel (mix with/without meters)
    - 20 students with various allocations
    - Historical readings and segments
    - _Design: Section 12.3_

  - [ ] 34.2 Create test fixtures for integration tests
    - Baseline hostel/room/student data
    - Meter configurations
    - Sample readings and segments
    - Edge case scenarios

- [ ] 35. Performance testing and optimization
  - [ ]* 35.1 Test reading history query performance
    - Test with 1000+ readings per meter
    - Verify index usage
    - Optimize slow queries

  - [ ]* 35.2 Test billing overview query performance
    - Test with 100+ segments per room
    - Test monthly aggregations
    - Verify index usage on billing_month

  - [ ]* 35.3 Test concurrent operation performance
    - Simulate multiple simultaneous readings
    - Test advisory lock contention
    - Verify no deadlocks

- [ ] 36. Documentation and deployment preparation
  - [ ] 36.1 Create API documentation
    - Document all 22 endpoints
    - Include request/response examples
    - Document error codes

  - [ ] 36.2 Create database migration runbook
    - Migration execution steps
    - Rollback procedures
    - Backup requirements

  - [ ] 36.3 Create owner onboarding guide
    - How to configure meters
    - How to enter readings
    - How to interpret billing data

  - [ ] 36.4 Create student help documentation
    - How to view charges
    - Understanding charge calculations
    - Billing transparency

- [ ] 37. Final integration testing and validation
  - [ ]* 37.1 End-to-end testing full lifecycle
    - Create hostel and set rate
    - Configure meters for rooms
    - Record initial readings
    - Create room allocations
    - Process occupancy changes
    - Record month-end readings
    - Verify student charges
    - Export billing data

  - [ ]* 37.2 Test timezone handling
    - Create hostels in different timezones
    - Test month-end processing in each timezone
    - Verify calendar month boundaries

  - [ ]* 37.3 Validate TypeScript build
    - Ensure no TypeScript errors
    - Verify all types resolve correctly
    - Test production build
    - _Requirements: REQ-26.6_

- [ ] 38. Final checkpoint - System ready for deployment
  - All 182 acceptance criteria covered by implementation
  - All 27 RLS policies active and tested
  - All 22 API endpoints functional
  - All UI components operational
  - All tests passing (unit, integration, security, edge cases)
  - Documentation complete
  - Ask user if ready to proceed to staging deployment

---

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Design section references provide detailed implementation guidance
- Dependencies are implicit in task ordering (sequential execution recommended)
- Checkpoints (tasks 5, 10, 18, 27, 38) are critical validation points before proceeding

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 10, "tasks": ["13.1", "13.2", "13.3", "14.1", "14.2"] },
    { "id": 11, "tasks": ["15.1", "15.2", "15.3", "16.1", "16.2", "17.1"] },
    { "id": 12, "tasks": ["19.1"] },
    { "id": 13, "tasks": ["19.2", "19.3", "19.4", "19.5", "19.6", "19.7", "19.8", "19.9"] },
    { "id": 14, "tasks": ["20.1", "20.2", "20.3"] },
    { "id": 15, "tasks": ["21.1", "21.2", "21.3", "22.1", "22.2", "22.3"] },
    { "id": 16, "tasks": ["23.1", "23.2", "23.3", "24.1", "24.2", "24.3"] },
    { "id": 17, "tasks": ["25.1", "25.2", "25.3", "26.1", "26.2"] },
    { "id": 18, "tasks": ["28.1", "28.2", "28.3", "28.4"] },
    { "id": 19, "tasks": ["29.1", "29.2", "29.3", "29.4", "29.5"] },
    { "id": 20, "tasks": ["30.1", "30.2", "31.1", "31.2", "31.3"] },
    { "id": 21, "tasks": ["32.1", "32.2", "32.3"] },
    { "id": 22, "tasks": ["33.1", "33.2", "33.3"] },
    { "id": 23, "tasks": ["34.1", "34.2"] },
    { "id": 24, "tasks": ["35.1", "35.2", "35.3"] },
    { "id": 25, "tasks": ["36.1", "36.2", "36.3", "36.4"] },
    { "id": 26, "tasks": ["37.1", "37.2", "37.3"] }
  ]
}
```
