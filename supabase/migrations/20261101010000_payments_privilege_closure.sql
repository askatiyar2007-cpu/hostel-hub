-- Migration: 20261101010000_payments_privilege_closure.sql
-- Description: Complete table and column privilege closure for public.payments.
-- Revokes ALL table-level privileges (including REFERENCES, TRIGGER, TRUNCATE) from PUBLIC, anon, authenticated.
-- Grants SELECT back to authenticated only.
-- Explicitly revokes column-level INSERT, UPDATE, REFERENCES from PUBLIC, anon, authenticated.
-- Ensures anon has zero table or column privileges.
-- Preserves full access for service_role.

BEGIN;

-- 1. Revoke ALL table-level privileges from PUBLIC, anon, and authenticated
-- This removes SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER.
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC, anon, authenticated;

-- 2. Grant SELECT back to authenticated role only (RLS policies govern row visibility)
GRANT SELECT ON TABLE public.payments TO authenticated;

-- 3. Explicitly revoke column-level INSERT, UPDATE, REFERENCES privileges
-- from PUBLIC, anon, and authenticated, and ensure anon/PUBLIC have no column-level SELECT
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payments'
    ) LOOP
        -- Revoke column-level write and foreign key constraint privileges
        EXECUTE format(
            'REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.payments FROM PUBLIC, anon, authenticated',
            col.column_name, col.column_name, col.column_name
        );
        -- Ensure anon and PUBLIC retain no column-level SELECT
        EXECUTE format(
            'REVOKE SELECT (%I) ON public.payments FROM PUBLIC, anon',
            col.column_name
        );
    END LOOP;
END $$;

-- 4. Preserve full administrative access for service_role
GRANT ALL PRIVILEGES ON TABLE public.payments TO service_role;

COMMIT;
