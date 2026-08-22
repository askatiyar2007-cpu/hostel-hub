-- Migration: Add Manual Student Assignment and Student Invitations
-- Target: public

-- 1. Make students.profile_id nullable (DROP NOT NULL)
ALTER TABLE public.students ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Add admission_date column if missing
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS admission_date DATE;

-- Set default value for existing null records to current date
UPDATE public.students 
SET admission_date = CURRENT_DATE 
WHERE admission_date IS NULL;

-- Add a default constraint for future inserts
ALTER TABLE public.students 
ALTER COLUMN admission_date SET DEFAULT CURRENT_DATE;

-- 3. Create public.student_invitations table
CREATE TABLE IF NOT EXISTS public.student_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes for quick lookups on student_invitations
CREATE INDEX IF NOT EXISTS idx_student_invitations_token_hash ON public.student_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_student_invitations_student_id ON public.student_invitations(student_id);
CREATE INDEX IF NOT EXISTS idx_student_invitations_email ON public.student_invitations(email);

-- 4. Enable RLS on student_invitations
ALTER TABLE public.student_invitations ENABLE ROW LEVEL SECURITY;

-- 5. Add Select RLS Policy for student_invitations (Only owners can see invitations for their students)
DROP POLICY IF EXISTS "Owners can view invitations" ON public.student_invitations;
CREATE POLICY "Owners can view invitations" ON public.student_invitations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.room_allocations ra ON ra.student_id = s.id
      JOIN public.hostels h ON h.id = ra.hostel_id
      WHERE s.id = student_invitations.student_id
      AND h.owner_id = auth.uid()
    )
  );

-- 6. Create RPC function to handle transaction-safe manual student assignment with invitation creation
CREATE OR REPLACE FUNCTION public.create_manual_assignment_with_invite(
    p_hostel_id UUID,
    p_room_id UUID,
    p_student_name TEXT,
    p_student_email TEXT,
    p_student_phone TEXT,
    p_parent_name TEXT,
    p_parent_phone TEXT,
    p_parent_email TEXT,
    p_address TEXT,
    p_emergency_name TEXT,
    p_emergency_phone TEXT,
    p_start_date DATE,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_owner_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id UUID;
    v_existing_student_id UUID;
    v_existing_profile_id UUID;
    v_allocation_id UUID;
    v_request_id UUID;
    v_invitation_id UUID;
    v_room_capacity INT;
    v_room_occupancy INT;
    v_has_active_alloc BOOLEAN;
    v_assign_result JSON;
BEGIN
    -- a) Verify hostel ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.hostels 
        WHERE id = p_hostel_id AND owner_id = p_owner_id
    ) THEN
        RAISE EXCEPTION 'You do not own this hostel';
    END IF;

    -- b) Verify room belongs to hostel
    IF NOT EXISTS (
        SELECT 1 FROM public.rooms 
        WHERE id = p_room_id AND hostel_id = p_hostel_id
    ) THEN
        RAISE EXCEPTION 'Room does not belong to this hostel';
    END IF;

    -- c) Verify room has capacity (Lock row for update)
    SELECT capacity, occupancy INTO v_room_capacity, v_room_occupancy 
    FROM public.rooms 
    WHERE id = p_room_id FOR UPDATE;

    IF v_room_occupancy >= v_room_capacity THEN
        RAISE EXCEPTION 'Room is already at full capacity';
    END IF;

    -- d) Check if student already exists by email
    SELECT id INTO v_existing_profile_id 
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(TRIM(p_student_email));

    IF v_existing_profile_id IS NOT NULL THEN
        -- Find student record linked to profile
        SELECT id INTO v_existing_student_id 
        FROM public.students 
        WHERE profile_id = v_existing_profile_id;
    ELSE
        -- Find pending student record with this email
        SELECT id INTO v_existing_student_id 
        FROM public.students 
        WHERE LOWER(student_email) = LOWER(TRIM(p_student_email)) AND profile_id IS NULL;
    END IF;

    -- e) If student exists, check for active allocation
    IF v_existing_student_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.room_allocations 
            WHERE student_id = v_existing_student_id AND active = true
        ) INTO v_has_active_alloc;

        IF v_has_active_alloc THEN
            RAISE EXCEPTION 'Student with this email already has an active room allocation';
        END IF;

        v_student_id := v_existing_student_id;
    ELSE
        -- Create a new pending student record
        INSERT INTO public.students (
            id,
            profile_id,
            status,
            student_name,
            student_email,
            admission_date
        ) VALUES (
            gen_random_uuid(),
            NULL,
            'pending',
            p_student_name,
            LOWER(TRIM(p_student_email)),
            p_start_date
        ) RETURNING id INTO v_student_id;
    END IF;

    -- f) Create the pre-approved room request to store parent, address, and emergency details
    INSERT INTO public.room_requests (
        student_id,
        hostel_id,
        room_id,
        parent_name,
        parent_phone,
        parent_email,
        address,
        emergency_contact,
        status,
        student_name,
        student_email,
        student_phone,
        created_at
    ) VALUES (
        v_student_id,
        p_hostel_id,
        p_room_id,
        p_parent_name,
        p_parent_phone,
        p_parent_email,
        p_address,
        p_emergency_name || ' - ' || p_emergency_phone,
        'approved',
        p_student_name,
        LOWER(TRIM(p_student_email)),
        p_student_phone,
        NOW()
    ) RETURNING id INTO v_request_id;

    -- g) Allocate the room (using existing public.assign_student_to_room RPC)
    SELECT public.assign_student_to_room(
        v_student_id,
        p_room_id,
        p_hostel_id,
        p_start_date,
        p_student_name,
        LOWER(TRIM(p_student_email)),
        p_student_phone
    ) INTO v_assign_result;

    v_allocation_id := (v_assign_result->>'allocation_id')::UUID;

    -- h) Create the invitation record
    INSERT INTO public.student_invitations (
        student_id,
        email,
        token_hash,
        expires_at
    ) VALUES (
        v_student_id,
        LOWER(TRIM(p_student_email)),
        p_token_hash,
        p_expires_at
    ) RETURNING id INTO v_invitation_id;

    -- i) Return JSON with status details
    RETURN json_build_object(
        'success', true,
        'student_id', v_student_id,
        'allocation_id', v_allocation_id,
        'request_id', v_request_id,
        'invitation_id', v_invitation_id
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_manual_assignment_with_invite TO authenticated;

-- 7. Create RPC function to atomically complete invitation signup on the database side
CREATE OR REPLACE FUNCTION public.complete_invitation_signup(
    p_student_id UUID,
    p_profile_user_id UUID,
    p_phone_number TEXT,
    p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_student_name TEXT;
    v_student_email TEXT;
BEGIN
    -- a) Fetch student details for profile creation if needed
    SELECT student_name, student_email INTO v_student_name, v_student_email
    FROM public.students
    WHERE id = p_student_id;

    -- b) Try to fetch existing profile_id for user_id
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = p_profile_user_id;

    -- c) If profile doesn't exist, create it (handles trigger race condition/missing trigger)
    IF v_profile_id IS NULL THEN
        INSERT INTO public.profiles (user_id, full_name, email, role)
        VALUES (
            p_profile_user_id,
            v_student_name,
            v_student_email,
            'student'
        )
        RETURNING id INTO v_profile_id;
    END IF;

    -- d) Update profile phone number if provided and currently empty
    IF p_phone_number IS NOT NULL AND p_phone_number <> '' THEN
        UPDATE public.profiles
        SET phone_number = COALESCE(phone_number, p_phone_number)
        WHERE id = v_profile_id;
    END IF;

    -- e) Update student record (link profile and activate)
    UPDATE public.students
    SET profile_id = v_profile_id,
        status = 'active'
    WHERE id = p_student_id;

    -- f) Mark invitation as used (ensure it hasn't been used yet)
    UPDATE public.student_invitations
    SET used_at = NOW()
    WHERE id = p_invitation_id AND used_at IS NULL;

    -- g) Verify the invitation was successfully marked as used
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation has already been used';
    END IF;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_invitation_signup TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

