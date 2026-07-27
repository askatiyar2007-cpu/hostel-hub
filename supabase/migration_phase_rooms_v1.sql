/*
  PHASE: ROOMS & BEDS SCHEMA SYNC (V1)
  Target Project: HostelHub (files/)
  
  This migration ensures the 'rooms' and 'beds' tables match the frontend payload.
  It adds missing columns like 'room_type', 'security_deposit', 'facilities', and 'status'.
*/

-- ============ 1. ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.room_type AS ENUM ('single', 'double', 'triple', 'quad');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ 2. ROOMS TABLE SYNC ============
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rooms') THEN
    
    -- room_type (ENUM)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='room_type') THEN
      ALTER TABLE public.rooms ADD COLUMN room_type public.room_type NOT NULL DEFAULT 'double';
    END IF;

    -- floor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='floor') THEN
      ALTER TABLE public.rooms ADD COLUMN floor INTEGER DEFAULT 0;
    END IF;

    -- capacity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='capacity') THEN
      ALTER TABLE public.rooms ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- occupancy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='occupancy') THEN
      ALTER TABLE public.rooms ADD COLUMN occupancy INTEGER DEFAULT 0;
    END IF;

    -- security_deposit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='security_deposit') THEN
      ALTER TABLE public.rooms ADD COLUMN security_deposit DECIMAL DEFAULT 0;
    END IF;

    -- facilities
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='facilities') THEN
      ALTER TABLE public.rooms ADD COLUMN facilities TEXT[] DEFAULT '{}';
    END IF;

    -- status (TEXT)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='status') THEN
      ALTER TABLE public.rooms ADD COLUMN status TEXT DEFAULT 'available';
    END IF;

    -- available (BOOLEAN)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='available') THEN
      ALTER TABLE public.rooms ADD COLUMN available BOOLEAN DEFAULT true;
    END IF;

  END IF;
END $$;

-- ============ 3. BEDS TABLE SYNC ============
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='beds') THEN
    
    -- bed_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beds' AND column_name='bed_number') THEN
      ALTER TABLE public.beds ADD COLUMN bed_number INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beds' AND column_name='status') THEN
      ALTER TABLE public.beds ADD COLUMN status TEXT DEFAULT 'available';
    END IF;

  END IF;
END $$;

-- ============ 4. CACHE REFRESH ============
NOTIFY pgrst, 'reload schema';
