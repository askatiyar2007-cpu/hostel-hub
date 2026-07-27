/*
  PHASE D: DATABASE SCHEMA & SECURITY MIGRATION (V7 - FIX OWNER_ID CONSTRAINT)
  Target Project: HostelHub (files/)
  
  V7 CHANGES:
  - Dropped incorrect 'hostels_owner_id_fkey' referencing public.profiles(id).
  - Re-created 'hostels_owner_id_fkey' referencing auth.users(id).
  - Ensured data migration for any existing records using profile.id.
  - Refreshed schema cache.
*/

DO $$ 
BEGIN
  -- 1. Identify and Drop the incorrect constraint if it exists and points to profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'hostels' 
    AND kcu.column_name = 'owner_id' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage ccu
        WHERE ccu.constraint_name = tc.constraint_name
        AND ccu.table_name = 'profiles'
    )
  ) THEN
    -- We found a constraint pointing to profiles. Let's drop it.
    -- Note: We use the actual constraint name found in the error message
    ALTER TABLE public.hostels DROP CONSTRAINT IF EXISTS hostels_owner_id_fkey;
  END IF;

  -- 2. Migrate existing data if owner_id contains profiles.id instead of auth.users.id
  -- We check if any owner_id exists that is NOT in auth.users but IS in public.profiles
  IF EXISTS (
    SELECT 1 FROM public.hostels h
    JOIN public.profiles p ON h.owner_id = p.id
    LEFT JOIN auth.users u ON h.owner_id = u.id
    WHERE u.id IS NULL
  ) THEN
    UPDATE public.hostels h
    SET owner_id = p.user_id
    FROM public.profiles p
    WHERE h.owner_id = p.id;
  END IF;

  -- 3. Add the correct constraint pointing to auth.users(id)
  -- We check if the constraint already exists (pointing to auth.users) to avoid double creation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'hostels' 
    AND kcu.column_name = 'owner_id' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage ccu
        WHERE ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = 'auth'
        AND ccu.table_name = 'users'
    )
  ) THEN
    -- Ensure any existing constraint with this name is gone before adding the correct one
    ALTER TABLE public.hostels DROP CONSTRAINT IF EXISTS hostels_owner_id_fkey;
    
    ALTER TABLE public.hostels 
    ADD CONSTRAINT hostels_owner_id_fkey 
    FOREIGN KEY (owner_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;

END $$;

-- 4. CACHE REFRESH
NOTIFY pgrst, 'reload schema';
