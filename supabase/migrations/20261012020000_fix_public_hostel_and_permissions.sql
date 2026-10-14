-- Migration: Fix public hostel viewing and RLS permissions for QR code scanning
-- Enables prospective students and public visitors to view hostels and rooms via scanned QR links

DO $$
BEGIN
  -- Grant execute on is_parent_of if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'is_parent_of'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_parent_of(UUID, UUID) TO authenticated, anon, public';
  END IF;

  -- Grant execute on is_parent_of_student if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'is_parent_of_student'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_parent_of_student(UUID, UUID) TO authenticated, anon, public';
  END IF;

  -- Grant execute on is_student_user if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'is_student_user'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_student_user(UUID, UUID) TO authenticated, anon, public';
  END IF;

  -- Grant execute on get_room_actual_occupancy to authenticated, anon, public
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_room_actual_occupancy'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_room_actual_occupancy(UUID) TO authenticated, anon, public';
  END IF;
END $$;

-- Ensure hostels are publicly readable so public listing and QR scanning work reliably
DROP POLICY IF EXISTS "Hostels public read" ON public.hostels;
CREATE POLICY "Hostels public read" ON public.hostels
  FOR SELECT USING (true);

-- Ensure rooms are publicly readable for room selection
DROP POLICY IF EXISTS "Rooms public read" ON public.rooms;
CREATE POLICY "Rooms public read" ON public.rooms
  FOR SELECT USING (true);
