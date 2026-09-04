-- Migration: Fix Room Request Photo Storage RLS Policy
-- Date: 2026-09-06
-- Purpose: Fix RLS policy to correctly resolve students.id from auth.uid() through profiles
--
-- Root Cause:
-- The previous migration 20260906000001_room_request_photo_storage.sql had an incorrect
-- relationship in the RLS policy. It used:
-- auth.uid()::text = split_part(name, '/', 1)
--
-- This is incorrect because:
-- - auth.uid() returns auth.users.id
-- The storage path uses students.id
-- The correct relationship is: auth.users.id → profiles.user_id → profiles.id → students.profile_id → students.id
--
-- Fix:
-- Update the storage RLS policies to correctly resolve students.id from auth.uid()
-- using the profiles and students table relationship.

BEGIN;

-- Drop and recreate the storage RLS policies with the correct student_id resolution

-- Allow authenticated users to upload their own photos
DROP POLICY IF EXISTS "Students can upload own room-request photos" ON storage.objects;

CREATE POLICY "Students can upload own room-request photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-room-requests'
    AND auth.uid()::text IN (
      SELECT p.user_id::text
      FROM public.students s
      JOIN public.profiles p ON p.id = s.profile_id
      WHERE s.id::text = split_part(name, '/', 1)
    )
  );

-- Allow students to read their own photos
DROP POLICY IF EXISTS "Students can read own room-request photos" ON storage.objects;

CREATE POLICY "Students can read own room-request photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-room-requests'
    AND auth.uid()::text IN (
      SELECT p.user_id::text
      FROM public.students s
      JOIN public.profiles p ON p.id = s.profile_id
      WHERE s.id::text = split_part(name, '/', 1)
    )
  );

-- Keep owner and super admin policies unchanged as they don't use student_id path logic

COMMIT;
