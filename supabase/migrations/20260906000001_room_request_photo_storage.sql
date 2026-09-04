-- Migration: Add Photo Storage for Room Requests
-- Date: 2026-09-06
-- Purpose: Add mandatory passport-size photo upload to student room requests
--
-- Changes:
-- 1. Create private storage bucket for student room-request photos
-- 2. Add photo_path column to room_requests table
-- 3. Add RLS policies for secure photo storage access

BEGIN;

-- 1. Create private storage bucket for student room-request photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-room-requests', 'student-room-requests', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Add photo_path column to room_requests table
ALTER TABLE public.room_requests
ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- 3. RLS Policies for storage bucket

-- Path structure: student-room-requests/{student-id}/{unique-filename}

-- Allow authenticated users to upload their own photos
DROP POLICY IF EXISTS "Students can upload own room-request photos" ON storage.objects;

CREATE POLICY "Students can upload own room-request photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-room-requests'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Allow students to read their own photos
DROP POLICY IF EXISTS "Students can read own room-request photos" ON storage.objects;

CREATE POLICY "Students can read own room-request photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-room-requests'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- Allow owners to read photos for their hostel's room requests
DROP POLICY IF EXISTS "Owners can read hostel room-request photos" ON storage.objects;

CREATE POLICY "Owners can read hostel room-request photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-room-requests'
    AND EXISTS (
      SELECT 1 FROM public.room_requests rr
      JOIN public.hostels h ON h.id = rr.hostel_id
      WHERE h.owner_id = auth.uid()
      AND rr.photo_path = name
    )
  );

-- Allow super admins full access
DROP POLICY IF EXISTS "Super admins full access to room-request photos" ON storage.objects;

CREATE POLICY "Super admins full access to room-request photos" ON storage.objects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

COMMIT;
