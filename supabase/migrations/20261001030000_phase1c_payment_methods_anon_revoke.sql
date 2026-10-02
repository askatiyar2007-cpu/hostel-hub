-- Migration: 20261001030000_phase1c_payment_methods_anon_revoke.sql
-- Description: Phase 1C Hardening - Revoke all direct table privileges on payment_methods from anon.

BEGIN;

-- 1. Revoke all privileges from anon role on payment_methods
REVOKE ALL ON TABLE public.payment_methods FROM anon;

-- 2. Maintain explicit privileges for authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_methods TO authenticated;
GRANT ALL ON TABLE public.payment_methods TO service_role;

COMMIT;
