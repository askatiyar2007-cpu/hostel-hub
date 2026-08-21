export type UserRole = 'super_admin' | 'owner' | 'student' | 'parent';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: UserRole;
  avatar_url?: string;
  password_set?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Hostel {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  area?: string;
  state: string;
  pincode: string;
  contact_number: string;
  email: string;
  cover_image_url?: string;
  rules: string;
  amenities: string[];
  status: 'pending' | 'approved' | 'suspended';
  rating: number;
  total_reviews: number;
  created_at: string;
  starting_price?: number;
}

export interface Room {
  id: string;
  hostel_id: string;
  room_number: string;
  floor: number;
  room_type: 'single' | 'double' | 'triple' | 'quad';
  capacity: number;
  occupancy: number;
  rent: number;
  security_deposit?: number;
  facilities: string[];
  available: boolean;
  created_at: string;
}

export interface Bed {
  id: string;
  room_id: string;
  bed_number: number;
  status: 'available' | 'occupied' | 'maintenance';
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  profile_id: string;
  admission_date: string;
  education_level: string;
  institution: string;
  parent_id?: string;
  status: 'active' | 'inactive' | 'graduated';
  created_at: string;
  updated_at: string;
}

export interface RoomAllocation {
  id: string;
  student_id: string;
  hostel_id: string;
  room_id: string;
  start_date: string;
  end_date?: string;
  active: boolean;
  booking_type?: 'shared_bed' | 'entire_room';
  status?: string;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  hostel_id: string;
  student_id: string;
  bill_type: 'rent' | 'electricity' | 'deposit' | 'mess' | 'maintenance' | 'other';
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'failed';
  description?: string;
  paid_at?: string;
  created_at: string;
}

export interface ElectricityReading {
  id: string;
  room_id: string;
  hostel_id: string;
  previous_reading: number;
  current_reading: number;
  rate_per_unit: number;
  units_consumed: number;
  total_amount: number;
  reading_date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  bill_id: string;
  student_id: string;
  amount: number;
  payment_method: 'upi' | 'card' | 'net_banking' | 'wallet';
  transaction_id: string;
  status: 'pending' | 'success' | 'failed';
  paid_at?: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  hostel_id: string;
  student_id: string;
  category: 'electrical' | 'plumbing' | 'wifi' | 'cleaning' | 'furniture' | 'security' | 'other';
  title: string;
  description: string;
  priority: number;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  hostel_id: string;
  title: string;
  body: string;
  notice_type: string;
  created_at: string;
}

export interface ParentLink {
  id: string;
  parent_id: string;
  student_id: string;
  created_at: string;
}

export interface Review {
  id: string;
  hostel_id: string;
  user_id: string;
  food: number;
  cleanliness: number;
  safety: number;
  wifi: number;
  management: number;
  room_quality: number;
  comment: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface RoomRequest {
  id: string;
  student_id: string;
  hostel_id: string;
  room_id: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  address: string;
  emergency_contact?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  created_at: string;
}
