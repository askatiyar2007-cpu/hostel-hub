-- Migration: 20261001040000_remove_legacy_bills.sql
-- Description: Remove obsolete public.bills table after verifying it contains 0 rows and has no dependent objects.

BEGIN;

-- Safety assertion: abort if public.bills contains any rows
DO $$
DECLARE
  v_bills_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'bills'
  ) THEN
    SELECT COUNT(*) INTO v_bills_count FROM public.bills;
    IF v_bills_count > 0 THEN
      RAISE EXCEPTION 'Safety assertion failed: public.bills contains % rows. Migration aborted.', v_bills_count;
    END IF;
  END IF;
END $$;

-- Drop obsolete public.bills table without CASCADE
-- This will intentionally fail if any dependent database objects exist.
DROP TABLE public.bills;

COMMIT;
