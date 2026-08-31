-- Migration: Fix electricity student relationship to reference public.students(id)
-- Date: 2026-09-02
-- Description: Correct student_id foreign keys and RLS policies for Electricity tables

-- Since Electricity tables contain zero rows, no data conversion is needed

BEGIN;

-- 1. Drop existing foreign key constraints pointing to auth.users
ALTER TABLE public.occupancy_change_events
DROP CONSTRAINT IF EXISTS occupancy_change_events_student_id_fkey;

ALTER TABLE public.segment_occupants
DROP CONSTRAINT IF EXISTS segment_occupants_student_id_fkey;

ALTER TABLE public.student_electricity_charges
DROP CONSTRAINT IF EXISTS student_electricity_charges_student_id_fkey;

-- 2. Add new foreign key constraints referencing public.students(id)
ALTER TABLE public.occupancy_change_events
ADD CONSTRAINT occupancy_change_events_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

ALTER TABLE public.segment_occupants
ADD CONSTRAINT segment_occupants_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

ALTER TABLE public.student_electricity_charges
ADD CONSTRAINT student_electricity_charges_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

-- 3. Fix RLS policies to properly resolve student_id through profiles/students relationship

-- 3a. meter_readings: students_view_current_room_readings
DROP POLICY IF EXISTS "students_view_current_room_readings" ON public.meter_readings;
CREATE POLICY "students_view_current_room_readings" ON public.meter_readings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_allocations ra
      WHERE ra.student_id IN (
        SELECT s.id FROM public.students s
        JOIN public.profiles p ON s.profile_id = p.id
        WHERE p.user_id = auth.uid()
      )
        AND ra.room_id = meter_readings.room_id
        AND ra.status = 'active'
    )
  );

-- 3b. segment_occupants: students_view_own_occupancy
DROP POLICY IF EXISTS "students_view_own_occupancy" ON public.segment_occupants;
CREATE POLICY "students_view_own_occupancy" ON public.segment_occupants
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.profiles p ON s.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- 3c. student_electricity_charges: students_view_own_charges
DROP POLICY IF EXISTS "students_view_own_charges" ON public.student_electricity_charges;
CREATE POLICY "students_view_own_charges" ON public.student_electricity_charges
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.profiles p ON s.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- 3d. billing_segments: students_view_own_segments (update existing policy)
DROP POLICY IF EXISTS "students_view_own_segments" ON public.billing_segments;
CREATE POLICY "students_view_own_segments" ON public.billing_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.segment_occupants so
      WHERE so.segment_id = billing_segments.id
        AND so.student_id IN (
          SELECT s.id FROM public.students s
          JOIN public.profiles p ON s.profile_id = p.id
          WHERE p.user_id = auth.uid()
        )
    )
  );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;