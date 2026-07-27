/*
  PHASE D: DATABASE SCHEMA & SECURITY MIGRATION (V5 - COMPREHENSIVE SCHEMA SYNC)
  Target Project: HostelHub (files/)
  
  V5 CHANGES:
  - Added 'rating' and 'total_reviews' to the hostels table sync block.
  - Ensured all expected columns from the insert payload are present in the DB.
  - Retained all fixes from V4 (status, area, starting_price, enum casts).
*/

-- ============ 1. ENUMS ============

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'hostel_owner', 'student', 'parent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.hostel_status AS ENUM ('pending', 'approved', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.room_type AS ENUM ('single', 'double', 'triple', 'quad');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.bill_type AS ENUM ('rent', 'electricity', 'deposit', 'mess', 'maintenance', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.bill_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_category AS ENUM ('electrical', 'plumbing', 'wifi', 'cleaning', 'furniture', 'security', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============ 2. TABLES (CORE INFRASTRUCTURE) ============

-- Profiles (Standardized)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  role public.app_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Parent Links
CREATE TABLE IF NOT EXISTS public.parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

-- Hostels
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  cover_image_url TEXT,
  rules TEXT,
  amenities TEXT[] DEFAULT '{}',
  status public.hostel_status DEFAULT 'pending',
  starting_price DECIMAL DEFAULT 0,
  rating DECIMAL(3,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER DEFAULT 0,
  room_type public.room_type NOT NULL DEFAULT 'double',
  capacity INTEGER NOT NULL DEFAULT 1,
  occupancy INTEGER DEFAULT 0,
  rent DECIMAL DEFAULT 0,
  security_deposit DECIMAL DEFAULT 0,
  facilities TEXT[] DEFAULT '{}',
  available BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Beds
CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_number INTEGER NOT NULL,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, bed_number)
);
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

-- Students
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  education_level TEXT,
  institution TEXT,
  parent_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Notices
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notice_type TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Room Allocations
CREATE TABLE IF NOT EXISTS public.room_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_type public.bill_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status public.bill_status DEFAULT 'pending',
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.complaint_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 2,
  status public.complaint_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;


-- ============ 3. SECURITY FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(_parent_id UUID, _student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_links WHERE parent_id = _parent_id AND student_id = _student_id)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'))
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_of(UUID, UUID) TO authenticated, service_role;


-- ============ 4. ADVANCED DATA CONVERSION & MIGRATION ============

DO $$ 
BEGIN
  -- 4.1 Profiles Role Conversion
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role' AND data_type IN ('text', 'USER-DEFINED')) THEN
    BEGIN
      ALTER TABLE public.profiles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not automatically convert profiles.role. Skipping.';
    END;
  END IF;

  -- 4.2 Rooms rent conversion
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='monthly_rent') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='rent') THEN
      ALTER TABLE public.rooms RENAME COLUMN monthly_rent TO rent;
    ELSE
      UPDATE public.rooms SET rent = monthly_rent WHERE rent = 0 OR rent IS NULL;
    END IF;
  END IF;

  -- 4.3 Complaints priority conversion
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='priority' AND data_type='text') THEN
    ALTER TABLE public.complaints ALTER COLUMN priority TYPE INTEGER USING (
      CASE 
        WHEN priority = 'high' THEN 1
        WHEN priority = 'medium' THEN 2
        ELSE 3
      END
    );
  END IF;

  -- 4.4 Hostel Missing Columns & Owner Migration
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='hostels') THEN
    -- Add status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hostels' AND column_name='status') THEN
      ALTER TABLE public.hostels ADD COLUMN status public.hostel_status DEFAULT 'pending';
      UPDATE public.hostels SET status = 'approved';
    END IF;

    -- Add area
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hostels' AND column_name='area') THEN
      ALTER TABLE public.hostels ADD COLUMN area TEXT;
    END IF;

    -- Add starting_price
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hostels' AND column_name='starting_price') THEN
      ALTER TABLE public.hostels ADD COLUMN starting_price DECIMAL DEFAULT 0;
    END IF;

    -- Add rating (FIX FOR PGRST204)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hostels' AND column_name='rating') THEN
      ALTER TABLE public.hostels ADD COLUMN rating DECIMAL(3,1) DEFAULT 0;
    END IF;

    -- Add total_reviews (SYNC FIX)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hostels' AND column_name='total_reviews') THEN
      ALTER TABLE public.hostels ADD COLUMN total_reviews INTEGER DEFAULT 0;
    END IF;

    -- Migrate owner_id from profiles.id to auth.users.id (if needed)
    IF EXISTS (
      SELECT 1 FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      WHERE kcu.table_name = 'hostels' AND kcu.column_name = 'owner_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM public.hostels h 
        LEFT JOIN auth.users u ON h.owner_id = u.id 
        WHERE u.id IS NULL AND h.owner_id IS NOT NULL
        LIMIT 1
      ) THEN
        UPDATE public.hostels h
        SET owner_id = p.user_id
        FROM public.profiles p
        WHERE h.owner_id = p.id;
      END IF;
    END IF;
  END IF;

  -- 4.5 Migrate roles to user_roles
  INSERT INTO public.user_roles (user_id, role)
  SELECT user_id, role::text::public.app_role FROM public.profiles
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4.6 Migrate Assignments
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='room_assignments') THEN
    EXECUTE 'INSERT INTO public.room_allocations (id, room_id, bed_id, student_id, hostel_id, start_date, active, created_at)
             SELECT id, room_id, ' || 
             CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_assignments' AND column_name='bed_id') 
                  THEN 'bed_id' ELSE 'NULL' END || 
             ', student_id, hostel_id, check_in_date, (status = ''active''), created_at FROM public.room_assignments
             ON CONFLICT (id) DO NOTHING';
  END IF;

  -- 4.7 Migrate Announcements to Notices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='announcements') THEN
    EXECUTE 'INSERT INTO public.notices (id, hostel_id, title, body, notice_type, created_at)
             SELECT id, hostel_id, title, content, type, created_at FROM public.announcements
             ON CONFLICT (id) DO NOTHING';
  END IF;
END $$;


-- ============ 5. RLS POLICIES ============

-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

-- User Roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

-- Hostels
DROP POLICY IF EXISTS "Approved hostels public" ON public.hostels;
CREATE POLICY "Approved hostels public" ON public.hostels FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Owners manage own hostels" ON public.hostels;
CREATE POLICY "Owners manage own hostels" ON public.hostels FOR ALL TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'super_admin'));

-- Rooms
DROP POLICY IF EXISTS "Rooms public read" ON public.rooms;
CREATE POLICY "Rooms public read" ON public.rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners manage rooms" ON public.rooms;
CREATE POLICY "Owners manage rooms" ON public.rooms FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

-- Beds
DROP POLICY IF EXISTS "Beds public read" ON public.beds;
CREATE POLICY "Beds public read" ON public.beds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners manage beds" ON public.beds;
CREATE POLICY "Owners manage beds" ON public.beds FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.rooms r JOIN public.hostels h ON h.id = r.hostel_id WHERE r.id = room_id AND h.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

-- Room Allocations
DROP POLICY IF EXISTS "View allocations" ON public.room_allocations;
CREATE POLICY "View allocations" ON public.room_allocations FOR SELECT TO authenticated USING (
  student_id = auth.uid() 
  OR public.is_parent_of(auth.uid(), student_id)
  OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Bills
DROP POLICY IF EXISTS "Bills visibility" ON public.bills;
CREATE POLICY "Bills visibility" ON public.bills FOR SELECT TO authenticated USING (
  student_id = auth.uid()
  OR public.is_parent_of(auth.uid(), student_id)
  OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Complaints
DROP POLICY IF EXISTS "Complaint visibility" ON public.complaints;
CREATE POLICY "Complaint visibility" ON public.complaints FOR SELECT TO authenticated USING (
  student_id = auth.uid()
  OR public.is_parent_of(auth.uid(), student_id)
  OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Notices
DROP POLICY IF EXISTS "View notices" ON public.notices;
CREATE POLICY "View notices" ON public.notices FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_allocations ra WHERE ra.hostel_id = notices.hostel_id AND ra.student_id = auth.uid() AND ra.active = true)
  OR EXISTS (SELECT 1 FROM public.hostels h WHERE h.id = hostel_id AND h.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);


-- ============ 6. TRIGGERS ============

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============ 7. GRANTS ============

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hostels, public.rooms, public.beds, public.room_allocations, public.bills, public.complaints, public.notices, public.students TO authenticated;
