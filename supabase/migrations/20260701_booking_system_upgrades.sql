-- Phase 2: Add booking_type to room_requests table
ALTER TABLE public.room_requests
ADD COLUMN IF NOT EXISTS booking_type TEXT CHECK (booking_type IN ('shared', 'entire_room')) DEFAULT 'shared';

-- Fix room_allocations.student_id constraint if needed
-- We want to ensure room_allocations.student_id references public.students(id)
DO $$
BEGIN
  -- Drop the foreign key constraint pointing to auth.users if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'room_allocations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'student_id'
    AND EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage ccu
      WHERE ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
    )
  ) THEN
    ALTER TABLE public.room_allocations DROP CONSTRAINT IF EXISTS room_allocations_student_id_fkey;
  END IF;

  -- Add the correct constraint pointing to public.students(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'room_allocations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'student_id'
    AND EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage ccu
      WHERE ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'students'
    )
  ) THEN
    ALTER TABLE public.room_allocations DROP CONSTRAINT IF EXISTS room_allocations_student_id_fkey;
    
    ALTER TABLE public.room_allocations
    ADD CONSTRAINT room_allocations_student_id_fkey
    FOREIGN KEY (student_id)
    REFERENCES public.students(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Update RLS policies for public.room_allocations
DROP POLICY IF EXISTS "View allocations" ON public.room_allocations;
CREATE POLICY "View allocations" ON public.room_allocations 
  FOR SELECT TO authenticated USING (
    student_id IN (
      SELECT id FROM public.students WHERE profile_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
    OR public.is_parent_of(
      auth.uid(), 
      (SELECT p.user_id FROM public.profiles p JOIN public.students s ON s.profile_id = p.id WHERE s.id = student_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.hostels h 
      WHERE h.id = hostel_id AND h.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );

DROP POLICY IF EXISTS "Owners manage allocations" ON public.room_allocations;
CREATE POLICY "Owners manage allocations" ON public.room_allocations
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.hostels h 
      WHERE h.id = hostel_id AND h.owner_id = auth.uid()
    )
  );

-- Create transactional room request approval function
CREATE OR REPLACE FUNCTION public.approve_room_request(req_id UUID)
RETURNS VOID AS $$
DECLARE
  r_req RECORD;
  r_room RECORD;
  v_exists BOOLEAN;
  v_new_occupied INT;
BEGIN
  -- 1. Fetch request and lock it
  SELECT * INTO r_req FROM public.room_requests WHERE id = req_id FOR UPDATE;
  IF r_req IS NULL THEN
    RAISE EXCEPTION 'Room request not found.';
  END IF;
  
  IF r_req.status != 'pending' THEN
    RAISE EXCEPTION 'Request has already been processed.';
  END IF;

  -- 2. Check if student already has an active allocation
  SELECT EXISTS (
    SELECT 1 FROM public.room_allocations 
    WHERE student_id = r_req.student_id AND active = true
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE EXCEPTION 'Student already has an active room allocation.';
  END IF;

  -- 3. Lock and fetch room details
  SELECT * INTO r_room FROM public.rooms WHERE id = r_req.room_id FOR UPDATE;
  IF r_room IS NULL THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;

  -- 4. Booking Type Logic (shared vs entire_room)
  IF r_req.booking_type = 'entire_room' THEN
    IF COALESCE(r_room.occupied_count, r_room.occupancy, 0) > 0 THEN
      RAISE EXCEPTION 'Room is already occupied and cannot be booked entirely.';
    END IF;
    v_new_occupied := r_room.capacity;
  ELSE
    -- Default/shared booking
    IF COALESCE(r_room.occupied_count, r_room.occupancy, 0) >= r_room.capacity THEN
      RAISE EXCEPTION 'Room is at full capacity.';
    END IF;
    v_new_occupied := COALESCE(r_room.occupied_count, r_room.occupancy, 0) + 1;
  END IF;

  -- 5. Update room occupied count and availability
  UPDATE public.rooms
  SET 
    occupied_count = v_new_occupied,
    occupancy = v_new_occupied,
    available = (v_new_occupied < capacity),
    status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
  WHERE id = r_req.room_id;

  -- 6. Create room allocation
  INSERT INTO public.room_allocations (
    student_id,
    hostel_id,
    room_id,
    start_date,
    active
  ) VALUES (
    r_req.student_id,
    r_req.hostel_id,
    r_req.room_id,
    CURRENT_DATE,
    true
  );

  -- 7. Update request status
  UPDATE public.room_requests
  SET status = 'approved'
  WHERE id = req_id;

  -- 8. Reject other pending requests for the same student
  UPDATE public.room_requests
  SET status = 'rejected'
  WHERE student_id = r_req.student_id AND id != req_id AND status = 'pending';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create transactional student checkout function
CREATE OR REPLACE FUNCTION public.checkout_student(alloc_id UUID)
RETURNS VOID AS $$
DECLARE
  r_alloc RECORD;
  r_req RECORD;
  r_room RECORD;
  v_booking_type TEXT;
  v_new_occupied INT;
BEGIN
  -- 1. Fetch allocation and lock it
  SELECT * INTO r_alloc FROM public.room_allocations WHERE id = alloc_id FOR UPDATE;
  IF r_alloc IS NULL THEN
    RAISE EXCEPTION 'Allocation not found.';
  END IF;
  
  IF NOT r_alloc.active THEN
    RAISE EXCEPTION 'Allocation is already inactive.';
  END IF;

  -- 2. Deactivate the allocation
  UPDATE public.room_allocations
  SET active = false, end_date = CURRENT_DATE
  WHERE id = alloc_id;

  -- 3. Lock room details
  SELECT * INTO r_room FROM public.rooms WHERE id = r_alloc.room_id FOR UPDATE;
  IF r_room IS NOT NULL THEN
    -- Try to find the booking type from the approved request for this student and room
    SELECT booking_type INTO v_booking_type 
    FROM public.room_requests
    WHERE student_id = r_alloc.student_id AND room_id = r_alloc.room_id AND status = 'approved'
    ORDER BY created_at DESC LIMIT 1;
    
    -- Fallback to shared if not found
    v_booking_type := COALESCE(v_booking_type, 'shared');

    -- 4. Calculate new occupied count
    IF v_booking_type = 'entire_room' THEN
      v_new_occupied := 0;
    ELSE
      v_new_occupied := GREATEST(0, COALESCE(r_room.occupied_count, r_room.occupancy, 0) - 1);
    END IF;

    -- 5. Update room occupied count and availability
    UPDATE public.rooms
    SET 
      occupied_count = v_new_occupied,
      occupancy = v_new_occupied,
      available = (v_new_occupied < capacity),
      status = CASE WHEN v_new_occupied >= capacity THEN 'occupied' ELSE 'available' END
    WHERE id = r_alloc.room_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
