# Requirements Document

## Introduction

The HostelHub Electricity Management System enables hostel owners to track room-level electricity consumption, manage meter readings coordinated with occupancy changes, and automatically calculate electricity charges for students based on actual consumption divided among room occupants during specific billing segments.

The system integrates with the existing HostelHub room allocation infrastructure to create billing segments whenever room occupancy changes (students joining or leaving). Each segment preserves the meter readings, consumption, electricity rate, and occupant list at that time, ensuring historical billing accuracy and fair cost distribution.

## Glossary

- **Electricity_Meter**: A physical device that measures electricity consumption for a specific room, identified by a meter number
- **Meter_Reading**: A recorded measurement of cumulative electricity consumption at a specific timestamp, with a reason (occupancy_change, month_end, or manual_check)
- **Billing_Segment**: A time period with fixed occupancy during which electricity consumption is tracked and divided among occupants, created only by occupancy_change or month_end readings
- **Electricity_Rate**: The cost per unit of electricity (₹/kWh) stored in a rate history table with effective_from timestamps
- **Consumption**: The difference between two consecutive meter readings, measured in units (kWh)
- **Occupancy_Change**: A timestamped event where a student joins or leaves a room, requiring a meter reading and creating a new billing segment
- **Owner**: A user with role 'owner' who manages hostels, meters, and readings
- **Student**: A user with role 'student' who occupies rooms and is charged for electricity
- **Room_Allocation**: An assignment of a student to a room with start and optional end dates; considered active when status='active' and effective period contains the reference timestamp
- **Empty_Room**: A room with zero active occupants during a billing segment
- **Historical_Bill**: A finalized billing segment whose calculations never change even if current rates change
- **Reading_Validation**: The process of ensuring new readings are not less than previous readings
- **Segment_Charge**: The portion of a billing segment's total cost assigned to one occupant, stored in paise (integer)
- **Month_End_Reading**: A meter reading with reason 'month_end' recorded at the end of a calendar month when no occupancy change occurs
- **Manual_Check_Reading**: A meter reading with reason 'manual_check' that is stored but does NOT close or create billing segments
- **Calendar_Month**: A billing period from the first to last day of a calendar month in the hostel's configured timezone
- **Immediately_Before**: The most recent valid meter reading whose timestamp is at or before the occupancy-change event timestamp
- **Billable_Segment**: A billing segment that can be created only when an active Electricity_Meter exists and has a valid starting reading
- **Paise**: The smallest currency unit (1/100 of ₹) used for precise monetary calculations and storage

## Requirements

### Requirement 1: Electricity Meter Configuration

**User Story:** As a hostel owner, I want to configure one electricity meter per room, so that I can track room-level electricity consumption accurately.

#### Acceptance Criteria

1. THE Owner SHALL configure an Electricity_Meter for a room by providing meter_number, room_id, and hostel_id
2. THE System SHALL prevent creating a second active Electricity_Meter for a room that already has an active meter
3. WHEN the Owner creates an Electricity_Meter, THE System SHALL validate that the room_id belongs to a hostel owned by that Owner
4. THE System SHALL store the Electricity_Meter with fields: id, hostel_id, room_id, meter_number, status, created_at, created_by
5. THE System SHALL allow the Owner to deactivate an Electricity_Meter and create a new one for the same room
6. THE System SHALL display all configured Electricity_Meters for rooms in the Owner's hostels
7. WHEN an Electricity_Meter is created, THE System SHALL initialize its status as 'active'

### Requirement 2: Electricity Rate Management

**User Story:** As a hostel owner, I want to set the electricity rate for my hostel, so that the system can calculate electricity charges accurately.

#### Acceptance Criteria

1. THE Owner SHALL configure the Electricity_Rate per hostel by providing a numeric value in ₹/unit
2. THE System SHALL validate that the Electricity_Rate is strictly greater than zero (positive and non-zero)
3. THE System SHALL store all Electricity_Rate changes in a rate history table with fields: id, hostel_id, rate_per_unit, effective_from, created_by
4. WHEN the Owner updates the Electricity_Rate, THE System SHALL apply the new rate only to new Billing_Segments created on or after the effective_from timestamp
5. THE System SHALL preserve all historical Electricity_Rates permanently in the rate history table
6. WHEN creating a Billing_Segment, THE System SHALL determine the applicable rate by selecting the rate with the latest effective_from timestamp that is at or before the segment creation time
7. THE System SHALL display the current Electricity_Rate for each hostel in the Owner dashboard

### Requirement 3: Meter Reading Entry

**User Story:** As a hostel owner, I want to enter meter readings, so that I can record actual electricity consumption for billing.

#### Acceptance Criteria

1. WHEN the Owner enters a Meter_Reading, THE System SHALL validate that the Owner owns the hostel containing the meter
2. THE System SHALL store the Meter_Reading with fields: id, meter_id, room_id, reading_value, timestamp, recorded_by, reason, notes
3. THE System SHALL validate that the new reading_value is greater than or equal to the most recent previous reading_value for that meter
4. IF the new reading_value is less than the previous reading_value, THEN THE System SHALL reject the Meter_Reading with an error message
5. THE System SHALL record the timestamp automatically when the Meter_Reading is saved
6. THE System SHALL allow the Owner to specify a reason for the reading from: 'occupancy_change', 'month_end', 'manual_check'
7. WHEN a Meter_Reading with reason 'occupancy_change' or 'month_end' is successfully saved, THE System SHALL trigger Billing_Segment closure and creation
8. WHEN a Meter_Reading with reason 'manual_check' is successfully saved, THE System SHALL store the reading without closing or creating Billing_Segments

### Requirement 4: Meter Reading Validation

**User Story:** As a system administrator, I want the system to validate meter readings, so that billing calculations are based on accurate data.

#### Acceptance Criteria

1. WHEN a Meter_Reading is submitted, THE System SHALL verify that the reading_value is a non-negative number
2. THE System SHALL calculate the Consumption as the difference between consecutive readings for the same meter
3. IF the calculated Consumption is negative, THEN THE System SHALL reject the Meter_Reading
4. THE System SHALL prevent duplicate Meter_Readings with identical meter_id, reading_value, and timestamp within 60 seconds
5. WHEN no previous Meter_Reading exists for a meter, THE System SHALL accept the first reading as the baseline starting reading and allow subsequent billable segments to be created
6. THE System SHALL require a valid starting reading before any Billing_Segment can be created for that meter
7. THE System SHALL display the previous reading_value to the Owner before accepting a new reading
8. IF the new reading_value exceeds the previous value by more than 1000 units, THEN THE System SHALL display a confirmation warning

### Requirement 5: Occupancy Change Detection

**User Story:** As a system administrator, I want the system to detect occupancy changes, so that billing segments can be created automatically.

#### Acceptance Criteria

1. WHEN a Room_Allocation is created with status 'active', THE System SHALL identify this as a timestamped Occupancy_Change event
2. WHEN a Room_Allocation is updated with end_date or status changes to 'inactive', THE System SHALL identify this as a timestamped Occupancy_Change event
3. WHEN an Occupancy_Change is detected, THE System SHALL require a Meter_Reading whose timestamp is at or before the Occupancy_Change event timestamp (Immediately_Before definition)
4. THE System SHALL detect Occupancy_Change events, mark them as pending, and block completion if no qualifying Meter_Reading exists
5. THE System SHALL display a reminder notification to the Owner when an Occupancy_Change requires a reading
6. WHEN multiple Occupancy_Changes occur on the same day for the same room, THE System SHALL process them in chronological order by timestamp
7. WHEN an Occupancy_Change has a qualifying Meter_Reading, THE System SHALL close the current Billing_Segment and create a new Billing_Segment with the updated occupant list

### Requirement 6: Billing Segment Creation

**User Story:** As a system administrator, I want the system to create billing segments when occupancy changes, so that electricity costs are divided fairly among occupants.

#### Acceptance Criteria

1. WHEN an Occupancy_Change occurs with a qualifying Meter_Reading, THE System SHALL create a new Billing_Segment with fields: id, room_id, meter_id, start_reading_id, end_reading_id, start_date, end_date, consumption_units, rate_per_unit, total_cost_paise, occupant_count
2. THE System SHALL calculate Consumption as end_reading_value minus start_reading_value
3. THE System SHALL calculate total_cost_paise as Consumption multiplied by applicable Electricity_Rate converted to paise
4. THE System SHALL determine occupant_count by querying Room_Allocations where status='active' AND start_date <= segment_timestamp AND (end_date IS NULL OR end_date >= segment_timestamp)
5. THE System SHALL store a junction table linking each Billing_Segment to its Student occupants with individual Segment_Charges in paise
6. WHEN a room has zero active Room_Allocations at segment creation time, THE System SHALL create a Billing_Segment marked as Empty_Room with occupant_count zero
7. THE System SHALL set segment start_date to the timestamp of the start Meter_Reading
8. THE System SHALL support creating multiple distinct Billing_Segments on the same calendar day when multiple timestamped Occupancy_Changes occur

### Requirement 7: Billing Segment Closure

**User Story:** As a system administrator, I want the system to close billing segments correctly, so that consumption is calculated accurately.

#### Acceptance Criteria

1. WHEN a Meter_Reading with reason 'occupancy_change' or 'month_end' is recorded for a room with an open Billing_Segment, THE System SHALL close the open segment
2. THE System SHALL NOT close open Billing_Segments when a Meter_Reading with reason 'manual_check' is recorded
3. THE System SHALL set the end_reading_id to the new Meter_Reading that closes the segment
4. THE System SHALL set the end_date to the timestamp of the ending Meter_Reading
5. THE System SHALL calculate and store the final Consumption and total_cost_paise for the closed segment
6. WHEN closing a Billing_Segment, THE System SHALL capture the applicable Electricity_Rate from the rate history table and store the final occupant list
7. THE System SHALL prevent modifying a closed Billing_Segment
8. WHEN a Billing_Segment is closed, THE System SHALL calculate individual Segment_Charges in paise for each occupant

### Requirement 8: Empty Room Handling

**User Story:** As a hostel owner, I want electricity consumed in empty rooms to not be charged to students, so that billing is fair.

#### Acceptance Criteria

1. WHEN a Billing_Segment has occupant_count of zero, THE System SHALL mark it as Empty_Room
2. THE System SHALL calculate Consumption for Empty_Room segments but set total_cost to zero for student billing
3. THE System SHALL display Empty_Room segment consumption separately in Owner reports
4. THE System SHALL exclude Empty_Room segments from student electricity charge calculations
5. WHEN creating a new Room_Allocation in a previously empty room, THE System SHALL close the Empty_Room segment first
6. THE System SHALL track Empty_Room electricity consumption for Owner analysis
7. THE System SHALL preserve Empty_Room segment data as part of the audit trail

### Requirement 9: Month-End Reading

**User Story:** As a hostel owner, I want to enter month-end meter readings, so that I can bill students when no occupancy change occurs during the month.

#### Acceptance Criteria

1. WHEN the Owner enters a Month_End_Reading, THE System SHALL close any open Billing_Segment for that room
2. THE System SHALL accept Month_End_Reading with reason set to 'month_end'
3. IF no Occupancy_Change occurs during a Calendar_Month, THEN THE System SHALL create one Billing_Segment from the month start to the Month_End_Reading
4. THE System SHALL calculate monthly electricity charges from all Billing_Segments within that Calendar_Month
5. THE System SHALL create a new Billing_Segment starting from the Month_End_Reading with unchanged occupant list
6. THE System SHALL send reminders to Owners on the last calendar day of each Calendar_Month in the hostel's configured timezone to enter Month_End_Readings
7. THE System SHALL skip sending reminders for rooms where a qualifying month-end reading already exists
8. WHEN entering a Month_End_Reading, THE System SHALL display the previous reading and days elapsed

### Requirement 10: Student Electricity Charge Calculation

**User Story:** As a system administrator, I want the system to calculate electricity charges per student, so that costs are divided fairly among room occupants.

#### Acceptance Criteria

1. WHEN a Billing_Segment is closed, THE System SHALL calculate each Student's Segment_Charge in paise as total_cost_paise divided by occupant_count
2. THE System SHALL allocate remainder paise deterministically by assigning them to the student with lowest student_id in the segment
3. THE System SHALL sum all Segment_Charges for a Student within a Calendar_Month to produce the monthly electricity charge in paise
4. THE System SHALL store individual Segment_Charges with fields: id, segment_id, student_id, charge_amount_paise, billing_month
5. THE System SHALL ensure that the sum of all Segment_Charges in paise equals the Billing_Segment total_cost_paise exactly
6. THE System SHALL exclude Empty_Room segments from Student charge calculations
7. THE System SHALL preserve Historical_Bill charges even if recalculation is triggered

### Requirement 11: Historical Rate Preservation

**User Story:** As a hostel owner, I want historical bills to preserve original rates, so that finalized bills never change when I update current rates.

#### Acceptance Criteria

1. WHEN creating a Billing_Segment, THE System SHALL query the rate history table to determine the applicable Electricity_Rate with the latest effective_from timestamp at or before segment creation time
2. THE System SHALL store the applicable rate_per_unit in the Billing_Segment record
3. THE System SHALL prevent modification of the stored rate_per_unit in closed Billing_Segments
4. WHEN the Owner updates the current Electricity_Rate, THE System SHALL apply the new rate only to new Billing_Segments created on or after the new rate's effective_from timestamp
5. THE System SHALL calculate Historical_Bill charges using the preserved rate_per_unit from the segment
6. THE System SHALL display the historical Electricity_Rate used in each Historical_Bill
7. WHEN viewing past billing periods, THE System SHALL show the rate effective during that period
8. THE System SHALL maintain the complete rate history table with all rate changes and their effective_from timestamps

### Requirement 12: Owner Dashboard - Meter Management

**User Story:** As a hostel owner, I want to view and manage meters in my dashboard, so that I can track electricity infrastructure.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display all rooms in the Owner's hostels with their Electricity_Meter status
2. THE Owner_Dashboard SHALL allow the Owner to configure a new Electricity_Meter for a room
3. THE Owner_Dashboard SHALL display meter_number, status, and last_reading_date for each meter
4. THE Owner_Dashboard SHALL allow the Owner to deactivate an Electricity_Meter
5. THE Owner_Dashboard SHALL filter rooms showing: 'meters configured', 'meters missing', 'meters inactive'
6. THE Owner_Dashboard SHALL display rooms requiring meter readings with a visual indicator
7. THE Owner_Dashboard SHALL allow the Owner to view full reading history for any meter

### Requirement 13: Owner Dashboard - Reading Entry

**User Story:** As a hostel owner, I want to enter meter readings from my dashboard, so that I can record consumption efficiently.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL provide a form to enter Meter_Readings with fields: meter selection, reading_value, reason, notes
2. THE Owner_Dashboard SHALL display the previous reading_value and timestamp before accepting a new reading
3. THE Owner_Dashboard SHALL validate the new reading_value and display errors inline
4. THE Owner_Dashboard SHALL calculate and display the expected Consumption before submission
5. WHEN a reading is saved successfully, THE Owner_Dashboard SHALL display a confirmation message
6. THE Owner_Dashboard SHALL display pending reading requirements sorted by urgency
7. THE Owner_Dashboard SHALL allow bulk reading entry for multiple rooms

### Requirement 14: Owner Dashboard - Rate Configuration

**User Story:** As a hostel owner, I want to set electricity rates from my dashboard, so that charges are calculated correctly.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display the current Electricity_Rate for each hostel
2. THE Owner_Dashboard SHALL provide a form to update the Electricity_Rate with validation ensuring the rate is strictly greater than zero
3. THE Owner_Dashboard SHALL display a warning that the new rate applies only to new Billing_Segments created on or after the effective_from timestamp
4. WHEN the Owner updates the rate, THE Owner_Dashboard SHALL show the effective_from timestamp
5. THE Owner_Dashboard SHALL display the complete rate history with all changes and their effective_from timestamps
6. THE Owner_Dashboard SHALL validate that the new rate is strictly greater than zero (positive and non-zero)
7. THE Owner_Dashboard SHALL display the impact of rate changes on current open segments

### Requirement 15: Owner Dashboard - Reading Reminders

**User Story:** As a hostel owner, I want to see reminders for required readings, so that I don't miss important billing events.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a notification badge showing the count of pending Meter_Readings
2. THE Owner_Dashboard SHALL list rooms requiring readings due to: pending Occupancy_Changes, month-end, overdue readings
3. THE Owner_Dashboard SHALL sort pending readings by priority: Occupancy_Change before month-end
4. THE Owner_Dashboard SHALL display the reason and urgency for each pending reading
5. THE Owner_Dashboard SHALL allow the Owner to directly enter a reading from the reminder list
6. THE Owner_Dashboard SHALL remove a reminder immediately after the required reading is recorded
7. THE Owner_Dashboard SHALL send in-app notifications for high-priority pending readings

### Requirement 16: Owner Dashboard - Billing Overview

**User Story:** As a hostel owner, I want to view billing summaries in my dashboard, so that I can review electricity charges.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display monthly electricity billing summaries per room
2. THE Owner_Dashboard SHALL show total Consumption, total_cost, and occupant_count for each Billing_Segment
3. THE Owner_Dashboard SHALL allow the Owner to filter billing data by: hostel, room, date range
4. THE Owner_Dashboard SHALL display individual Student charges within each segment
5. THE Owner_Dashboard SHALL highlight Empty_Room segments with zero student charges
6. THE Owner_Dashboard SHALL calculate and display total electricity revenue per month
7. THE Owner_Dashboard SHALL allow the Owner to export billing data as CSV

### Requirement 17: Student Dashboard - View Own Charges

**User Story:** As a student, I want to view my electricity charges, so that I understand what I'm being billed for.

#### Acceptance Criteria

1. THE Student_Dashboard SHALL display the Student's current month electricity charges
2. THE Student_Dashboard SHALL show a breakdown of charges by Billing_Segment with dates and amounts
3. THE Student_Dashboard SHALL display: Consumption, Electricity_Rate, total_cost, and Segment_Charge per segment
4. THE Student_Dashboard SHALL show how many occupants shared the room during each segment
5. THE Student_Dashboard SHALL display meter reading values and dates for each segment
6. THE Student_Dashboard SHALL calculate and display total electricity charges for the current month
7. THE Student_Dashboard SHALL allow the Student to view Historical_Bills for previous months

### Requirement 18: Student Dashboard - Billing Transparency

**User Story:** As a student, I want to see how my electricity charges are calculated, so that I trust the billing system.

#### Acceptance Criteria

1. THE Student_Dashboard SHALL display the calculation formula: (end_reading - start_reading) × rate ÷ occupants
2. THE Student_Dashboard SHALL show start_reading and end_reading values with timestamps for each segment
3. THE Student_Dashboard SHALL display the Electricity_Rate used for each segment
4. THE Student_Dashboard SHALL show the occupant_count and calculation of per-person Segment_Charge
5. THE Student_Dashboard SHALL allow the Student to view other occupants in the room during each segment
6. THE Student_Dashboard SHALL display a timeline showing when the Student joined and left rooms
7. THE Student_Dashboard SHALL allow the Student to download a detailed billing statement

### Requirement 19: Authorization and Row-Level Security

**User Story:** As a system administrator, I want strict authorization controls, so that users can only access their own data.

#### Acceptance Criteria

1. THE System SHALL enforce that Owners can only create, read, update Electricity_Meters for their own hostels
2. THE System SHALL enforce that Owners can only enter Meter_Readings for meters in their own hostels
3. THE System SHALL enforce that Students can only view their own Segment_Charges and electricity bills
4. THE System SHALL implement RLS policies preventing Owner A from accessing Owner B's meter data
5. THE System SHALL validate hostel ownership on the backend for all mutation operations
6. THE System SHALL prevent Students from viewing or modifying any meter or reading data
7. THE System SHALL log all access attempts for audit purposes

### Requirement 20: Data Integrity and Accuracy

**User Story:** As a system administrator, I want accurate billing calculations, so that financial data is reliable.

#### Acceptance Criteria

1. THE System SHALL use integer paise for all monetary calculations and storage to prevent floating-point errors
2. THE System SHALL ensure that the sum of Segment_Charges in paise equals the Billing_Segment total_cost_paise exactly
3. WHEN rounding is required, THE System SHALL allocate remainder paise deterministically to the occupant with lowest student_id
4. THE System SHALL preserve all Meter_Readings as an immutable audit trail
5. THE System SHALL prevent deletion of Billing_Segments that have associated Segment_Charges
6. THE System SHALL validate data consistency between Room_Allocations and Billing_Segment occupants
7. THE System SHALL perform validation checks on all meter readings before creating billing segments

### Requirement 21: Integration with Existing Systems

**User Story:** As a system administrator, I want the electricity system to integrate with existing HostelHub infrastructure, so that implementation is consistent.

#### Acceptance Criteria

1. THE System SHALL reuse existing hostels, rooms, students, room_allocations, and profiles tables
2. THE System SHALL query active Room_Allocations to determine billing segment occupants
3. THE System SHALL enforce authorization using existing profiles.role and hostel ownership relationships
4. THE System SHALL utilize the existing Supabase client and RLS policies
5. THE System SHALL follow existing naming conventions and code organization patterns
6. THE System SHALL not duplicate or replace existing student, room, or allocation management systems
7. THE System SHALL create new tables only for: electricity_meters, meter_readings, billing_segments, segment_charges

### Requirement 22: Reading History and Audit Trail

**User Story:** As a hostel owner, I want to view complete reading history, so that I can audit electricity consumption.

#### Acceptance Criteria

1. THE System SHALL store all Meter_Readings permanently without deletion
2. THE Owner_Dashboard SHALL display chronological reading history for any Electricity_Meter
3. THE Reading_History SHALL show: timestamp, reading_value, recorded_by, reason, notes, Consumption since previous reading
4. THE System SHALL allow filtering reading history by: date range, reason, room, meter
5. THE System SHALL display which Billing_Segments were created from each reading pair
6. THE System SHALL highlight anomalies such as unusually high consumption between readings
7. THE System SHALL allow the Owner to export reading history as CSV

### Requirement 23: Prevent Invalid Operations

**User Story:** As a system administrator, I want to prevent invalid operations, so that data remains consistent.

#### Acceptance Criteria

1. THE System SHALL prevent deactivating an Electricity_Meter that has an open Billing_Segment
2. THE System SHALL preserve all historical meter data when an Electricity_Meter is deactivated
3. THE System SHALL block new billable occupancy processing for rooms with deactivated meters
4. THE System SHALL prevent deleting a Room_Allocation if it would orphan Billing_Segments
5. THE System SHALL prevent creating billable Room_Allocations without a valid starting Meter_Reading for the room's meter
6. THE System SHALL prevent modifying historical Meter_Readings after Billing_Segments are created from them
7. IF a Student is removed from a Room_Allocation, THEN THE System SHALL require a Meter_Reading with reason 'occupancy_change' before removal
8. THE System SHALL validate that all active Electricity_Meters belong to existing, active rooms
9. THE System SHALL prevent simultaneous conflicting operations on the same meter through database constraints

### Requirement 24: Multi-Occupant Billing Accuracy

**User Story:** As a student in a shared room, I want my electricity charge to reflect only my share of consumption, so that billing is fair.

#### Acceptance Criteria

1. WHEN multiple Students occupy a room during a Billing_Segment, THE System SHALL divide total_cost equally among them
2. THE System SHALL calculate each Student's share as: total_cost ÷ occupant_count
3. THE System SHALL handle rooms with occupant_count ranging from 0 to room capacity
4. WHEN a Student occupies a room for only part of a month, THE System SHALL charge for only the segments where they were present
5. THE System SHALL sum all Segment_Charges for a Student across multiple segments in the billing month
6. THE System SHALL display to each Student the dates they were charged for in each segment
7. THE System SHALL ensure that no Student is charged for time periods when they were not allocated to the room

### Requirement 25: System Notifications and Reminders

**User Story:** As a hostel owner, I want automated reminders for meter readings, so that I don't miss billing events.

#### Acceptance Criteria

1. WHEN an Occupancy_Change is pending, THE System SHALL create a high-priority notification for the Owner
2. WHEN the last calendar day of the Calendar_Month arrives in the hostel's configured timezone, THE System SHALL create month-end reading notifications for all active meters that lack a qualifying reading
3. THE System SHALL skip creating month-end reminders for meters where a qualifying Month_End_Reading already exists
4. THE System SHALL display notification count badges in the Owner_Dashboard navigation
5. THE System SHALL allow the Owner to mark notifications as read or dismiss them
6. WHEN a notification is acted upon by recording the required reading, THE System SHALL automatically dismiss the notification
7. THE System SHALL handle notification removal failures gracefully without blocking meter reading operations
8. THE System SHALL send daily summary notifications if there are pending readings older than 24 hours
9. THE System SHALL display all pending notifications in a dedicated notifications panel

### Requirement 26: TypeScript Type Safety and Build Validation

**User Story:** As a developer, I want the electricity management code to be type-safe, so that bugs are caught at compile time.

#### Acceptance Criteria

1. THE System SHALL define TypeScript interfaces for: ElectricityMeter, MeterReading, BillingSegment, SegmentCharge
2. THE System SHALL use strict TypeScript configuration with no implicit any types
3. THE System SHALL define Zod schemas or similar validation for all API request/response types
4. THE System SHALL generate TypeScript types from Supabase database schema using type generation tools
5. THE System SHALL ensure all React components use properly typed props
6. THE System SHALL pass the complete project build process without TypeScript or compilation errors

---

## Out of Scope / Deferred Items

The following items are explicitly **OUT OF SCOPE** for this feature specification and may be addressed in future iterations:

1. **Dispute Resolution Workflow**: Process for students to dispute charges or owners to review/adjust bills
2. **Meter Malfunction/Maintenance Workflow**: Handling meter repairs, replacements, or calibration events
3. **Historical Data Migration**: Tools or processes to import pre-existing meter readings or billing data
4. **Charge Lifecycle Management**: Formal states for charges (draft, finalized, paid, overdue) and payment tracking
5. **Student Roommate Privacy Details**: Granular controls over what occupancy information students can see about roommates
6. **Bulk Reading Entry UX Details**: Specific interface design for entering multiple readings simultaneously
7. **Detailed CSV Export Format Specification**: Exact column definitions, formatting rules, and encoding standards for exported data
8. **Real-time Meter Integration**: Automatic reading collection from smart meters or IoT devices
9. **Payment Gateway Integration**: Direct payment collection for electricity charges
10. **Multi-currency Support**: Supporting hostels in different countries with different currencies

