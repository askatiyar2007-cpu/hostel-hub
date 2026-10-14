-- Migration: 20261001020000_phase1c_payment_methods_auth_user_id.sql
-- Description: Phase 1C - Normalize payment_methods.owner_id to auth.users.id,
--              grant student SELECT access for active allocations, and add owner DELETE policy.

BEGIN;

-- 1. Pre-checks and Data Migration
DO $$
DECLARE
    v_unmapped_count INTEGER;
    v_already_migrated BOOLEAN;
BEGIN
    -- Check if foreign key is already pointing to auth.users
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'payment_methods'
          AND tc.constraint_name = 'payment_methods_owner_id_fkey'
          AND ccu.table_name = 'users'
          AND ccu.table_schema = 'auth'
    ) INTO v_already_migrated;

    IF NOT v_already_migrated THEN
        -- Drop old foreign key constraint referencing public.profiles(id)
        ALTER TABLE public.payment_methods
            DROP CONSTRAINT IF EXISTS payment_methods_owner_id_fkey;

        -- Migrate existing rows from profiles.id to profiles.user_id if any match profiles.id
        UPDATE public.payment_methods pm
        SET owner_id = p.user_id
        FROM public.profiles p
        WHERE pm.owner_id = p.id AND p.user_id IS NOT NULL;

        -- Clean up any unmapped orphan test rows that do not exist in auth.users
        DELETE FROM public.payment_methods pm
        WHERE NOT EXISTS (
            SELECT 1 FROM auth.users u WHERE u.id = pm.owner_id
        );

        -- Add new foreign key constraint referencing auth.users(id)
        ALTER TABLE public.payment_methods
            ADD CONSTRAINT payment_methods_owner_id_fkey
            FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Update Owner RLS Policies (Directly checking auth.uid())
DROP POLICY IF EXISTS "Owners can add payment methods" ON public.payment_methods;
CREATE POLICY "Owners can add payment methods"
    ON public.payment_methods
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can view their payment methods" ON public.payment_methods;
CREATE POLICY "Owners can view their payment methods"
    ON public.payment_methods
    FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update payment methods" ON public.payment_methods;
CREATE POLICY "Owners can update payment methods"
    ON public.payment_methods
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can delete payment methods" ON public.payment_methods;
CREATE POLICY "Owners can delete payment methods"
    ON public.payment_methods
    FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- 3. Student SELECT RLS Policy
DROP POLICY IF EXISTS "Students can view active payment methods for allocated hostel" ON public.payment_methods;
CREATE POLICY "Students can view active payment methods for allocated hostel"
    ON public.payment_methods
    FOR SELECT
    TO authenticated
    USING (
        is_active = true AND EXISTS (
            SELECT 1 FROM public.room_allocations ra
            JOIN public.students s ON s.id = ra.student_id
            JOIN public.profiles p ON p.id = s.profile_id
            WHERE ra.hostel_id = payment_methods.hostel_id
              AND ra.active = true
              AND p.user_id = auth.uid()
        )
    );

-- 4. Ensure RLS is enabled and permissions granted
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_methods TO authenticated;
GRANT ALL ON TABLE public.payment_methods TO service_role;

COMMIT;
