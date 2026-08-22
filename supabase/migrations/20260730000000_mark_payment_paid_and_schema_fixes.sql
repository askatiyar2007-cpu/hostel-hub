-- Migration: Add mark_payment_paid RPC and schema fixes
-- Target: public

-- 1. Ensure student_fees has status and paid_date columns
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_verification', 'paid', 'overdue'));
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS paid_date TIMESTAMPTZ;

-- 2. Verify and add student_name and student_email to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_email TEXT;

-- 3. Populate students table snapshot details from profiles table if null
UPDATE public.students s
SET 
  student_name = COALESCE(s.student_name, p.full_name),
  student_email = COALESCE(s.student_email, p.email)
FROM public.profiles p
WHERE p.id = s.profile_id;

-- 4. Remove bed_number column from room_allocations IF exists
ALTER TABLE public.room_allocations DROP COLUMN IF EXISTS bed_number;

-- 5. Create RPC function mark_payment_paid(p_fee_id UUID)
CREATE OR REPLACE FUNCTION public.mark_payment_paid(p_fee_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
    UPDATE public.student_fees
    SET status = 'paid', paid_date = NOW()
    WHERE id = p_fee_id;
    
    RETURN json_build_object(
        'fee_id', p_fee_id::TEXT,
        'status', 'paid',
        'message', 'Payment marked as paid'
    );
END $$;

GRANT EXECUTE ON FUNCTION public.mark_payment_paid(UUID) TO authenticated;

-- 6. Refresh schema cache
NOTIFY pgrst, 'reload schema';
