# HostelHub - Complete Setup Guide

## 📋 Table of Contents
1. Supabase Setup
2. Database Schema
3. Authentication Configuration
4. Row Level Security (RLS)
5. Storage Setup
6. Environment Variables
7. Seeding Data
8. Deployment

---

## 1. Supabase Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up or login
3. Click "New project"
4. Fill in:
   - Project name: `hostelhub`
   - Database password: (secure password)
   - Region: Choose closest to your users
5. Wait for project to initialize (5-10 minutes)

### Step 2: Get API Keys
1. Go to Settings → API
2. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Database Schema

Run these SQL commands in Supabase SQL Editor:

### 2.1 Profiles Table
\`\`\`sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'hostel_owner', 'student', 'parent')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
\`\`\`

### 2.2 Hostels Table
\`\`\`sql
CREATE TABLE hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  cover_image_url TEXT,
  rules TEXT,
  amenities TEXT[] DEFAULT '{}',
  rating DECIMAL(3,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hostels_owner_id ON hostels(owner_id);
CREATE INDEX idx_hostels_city ON hostels(city);
\`\`\`

### 2.3 Rooms Table
\`\`\`sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'four_sharing')),
  capacity INTEGER NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  security_deposit DECIMAL(10,2),
  facilities TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rooms_hostel_id ON rooms(hostel_id);
CREATE INDEX idx_rooms_status ON rooms(status);
\`\`\`

### 2.4 Beds Table
\`\`\`sql
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number INTEGER NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, bed_number)
);

CREATE INDEX idx_beds_room_id ON beds(room_id);
\`\`\`

### 2.5 Students Table
\`\`\`sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  education_level TEXT,
  institution TEXT,
  parent_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_students_profile_id ON students(profile_id);
CREATE INDEX idx_students_parent_id ON students(parent_id);
\`\`\`

### 2.6 Room Assignments Table
\`\`\`sql
CREATE TABLE room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_out_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_room_assignments_student_id ON room_assignments(student_id);
CREATE INDEX idx_room_assignments_hostel_id ON room_assignments(hostel_id);
CREATE INDEX idx_room_assignments_status ON room_assignments(status);
\`\`\`

### 2.7 Bills Table
\`\`\`sql
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('rent', 'electricity', 'mess', 'maintenance')),
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  late_fee DECIMAL(10,2),
  discount DECIMAL(10,2),
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bills_hostel_id ON bills(hostel_id);
CREATE INDEX idx_bills_student_id ON bills(student_id);
CREATE INDEX idx_bills_status ON bills(status);
\`\`\`

### 2.8 Electricity Readings Table
\`\`\`sql
CREATE TABLE electricity_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  previous_reading DECIMAL(10,2),
  current_reading DECIMAL(10,2) NOT NULL,
  reading_date DATE NOT NULL,
  units_consumed DECIMAL(10,2),
  rate_per_unit DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_electricity_readings_hostel_id ON electricity_readings(hostel_id);
\`\`\`

### 2.9 Complaints Table
\`\`\`sql
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('electrical', 'plumbing', 'wifi', 'cleaning', 'furniture', 'security', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_complaints_hostel_id ON complaints(hostel_id);
CREATE INDEX idx_complaints_student_id ON complaints(student_id);
CREATE INDEX idx_complaints_status ON complaints(status);
\`\`\`

### 2.10 Announcements Table
\`\`\`sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK (type IN ('general', 'fee_reminder', 'maintenance', 'emergency')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_announcements_hostel_id ON announcements(hostel_id);
\`\`\`

### 2.11 Reviews Table
\`\`\`sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  rating_food INTEGER CHECK (rating_food >= 1 AND rating_food <= 5),
  rating_cleanliness INTEGER CHECK (rating_cleanliness >= 1 AND rating_cleanliness <= 5),
  rating_safety INTEGER CHECK (rating_safety >= 1 AND rating_safety <= 5),
  rating_wifi INTEGER CHECK (rating_wifi >= 1 AND rating_wifi <= 5),
  rating_management INTEGER CHECK (rating_management >= 1 AND rating_management <= 5),
  rating_room_quality INTEGER CHECK (rating_room_quality >= 1 AND rating_room_quality <= 5),
  overall_rating DECIMAL(3,1),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reviews_hostel_id ON reviews(hostel_id);
CREATE INDEX idx_reviews_student_id ON reviews(student_id);
\`\`\`

### 2.12 Notifications Table
\`\`\`sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT CHECK (type IN ('bill', 'payment', 'complaint', 'announcement', 'system')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
\`\`\`

---

## 3. Row Level Security (RLS) Setup

Enable RLS on all tables and set policies:

\`\`\`sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public profiles" ON profiles
  FOR SELECT USING (true);

-- Hostels RLS
CREATE POLICY "Owners can view own hostels" ON hostels
  FOR SELECT USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Everyone can view all hostels" ON hostels
  FOR SELECT USING (true);

CREATE POLICY "Owners can manage own hostels" ON hostels
  FOR UPDATE USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can delete own hostels" ON hostels
  FOR DELETE USING (owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Add similar policies for other tables based on your requirements
\`\`\`

---

## 4. Storage Setup

### Create Buckets

Go to Storage in Supabase:

1. Create bucket: `hostels` (public)
2. Create bucket: `rooms` (public)
3. Create bucket: `documents` (private)

---

## 5. Environment Variables

Create `.env.local`:

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
NEXT_PUBLIC_APP_NAME=HostelHub
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

---

## 6. Create Demo Accounts

Run in Supabase SQL Editor:

\`\`\`sql
-- Create demo accounts using auth.admin_user_create()
-- This requires running from backend or Supabase functions
-- For now, manually create them through auth UI or use this approach:

INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES 
  ('owner@test.com', crypt('Test123456', gen_salt('bf')), NOW()),
  ('student@test.com', crypt('Test123456', gen_salt('bf')), NOW()),
  ('parent@test.com', crypt('Test123456', gen_salt('bf')), NOW());
\`\`\`

---

## 7. Installation & Running

\`\`\`bash
# Clone repository
git clone <repo-url>
cd hostelhub

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev

# Open browser
open http://localhost:3000
\`\`\`

---

## 8. Testing

### Test Accounts
- **Owner**: owner@test.com / Test123456
- **Student**: student@test.com / Test123456
- **Parent**: parent@test.com / Test123456

### Test Workflow
1. Sign up or login with test account
2. Create a hostel (owner)
3. Add rooms and students
4. Generate bills
5. View dashboard

---

## 9. Deployment (Vercel)

\`\`\`bash
# Push to GitHub
git push origin main

# Go to vercel.com
# Connect GitHub repository
# Add environment variables
# Deploy
\`\`\`

---

## Troubleshooting

### Common Issues

1. **Auth Error**: Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
2. **RLS Error**: Enable RLS and create proper policies
3. **Image Upload Error**: Check storage bucket permissions (public)
4. **Database Connection**: Verify Supabase project is running

---

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Run database schema
3. ✅ Configure authentication
4. ✅ Set up storage
5. ✅ Add environment variables
6. ✅ Create demo accounts
7. ✅ Test application
8. ✅ Deploy to production

For more help, visit: https://supabase.com/docs
