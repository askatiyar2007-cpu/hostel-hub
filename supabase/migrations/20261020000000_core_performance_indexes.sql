-- ============================================================================
-- Migration: 20261020000000_core_performance_indexes.sql
-- Description: Core performance indexes for foreign keys and frequent query filters.
-- Verified: Minimal justified set of 15 non-redundant indexes.
--
-- Excluded candidates based on live catalog & query audit:
-- - students(profile_id): covered by students_profile_id_unique constraint.
-- - student_fees(due_date): no global unscoped queries in application.
-- - student_fees(allocation_id): covered by uq_student_fees_allocation_month(allocation_id, month_year).
-- ============================================================================

-- 1. room_allocations
CREATE INDEX IF NOT EXISTS idx_room_allocations_student_id 
    ON public.room_allocations(student_id);

CREATE INDEX IF NOT EXISTS idx_room_allocations_hostel_active 
    ON public.room_allocations(hostel_id, active);

CREATE INDEX IF NOT EXISTS idx_room_allocations_room_active 
    ON public.room_allocations(room_id, active);

-- 2. student_fees
CREATE INDEX IF NOT EXISTS idx_student_fees_student_id 
    ON public.student_fees(student_id);

CREATE INDEX IF NOT EXISTS idx_student_fees_hostel_status 
    ON public.student_fees(hostel_id, status);

-- 3. payments
CREATE INDEX IF NOT EXISTS idx_payments_student_id 
    ON public.payments(student_id);

CREATE INDEX IF NOT EXISTS idx_payments_allocation_id 
    ON public.payments(allocation_id);

CREATE INDEX IF NOT EXISTS idx_payments_student_fees_id 
    ON public.payments(student_fees_id);

CREATE INDEX IF NOT EXISTS idx_payments_hostel_status 
    ON public.payments(hostel_id, payment_status);

-- 4. rooms
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id 
    ON public.rooms(hostel_id);

-- 5. room_requests
CREATE INDEX IF NOT EXISTS idx_room_requests_student_id 
    ON public.room_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_room_requests_hostel_status 
    ON public.room_requests(hostel_id, status);

-- 6. complaints
CREATE INDEX IF NOT EXISTS idx_complaints_student_id 
    ON public.complaints(student_id);

CREATE INDEX IF NOT EXISTS idx_complaints_hostel_status 
    ON public.complaints(hostel_id, status);

-- 7. notices
CREATE INDEX IF NOT EXISTS idx_notices_hostel_id 
    ON public.notices(hostel_id);
