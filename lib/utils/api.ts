// lib/utils/api.ts
import { supabase } from '@/lib/supabase/client';
import { Hostel, Room, Bill } from '@/types/database';

export const hostelAPI = {
  // Get all hostels for a user
  async getHostelsByOwner(ownerId: string) {
    const { data, error } = await supabase
      .from('hostels')
      .select('*')
      .eq('owner_id', ownerId);
    
    if (error) throw error;
    return data;
  },

  // Get single hostel with details
  async getHostelDetails(hostelId: string) {
    const { data, error } = await supabase
      .from('hostels')
      .select(`
        *,
        rooms(*)
      `)
      .eq('id', hostelId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Create new hostel
  async createHostel(hostel: Partial<Hostel>) {
    const { data, error } = await supabase
      .from('hostels')
      .insert([hostel])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Update hostel
  async updateHostel(hostelId: string, updates: Partial<Hostel>) {
    const { data, error } = await supabase
      .from('hostels')
      .update(updates)
      .eq('id', hostelId)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Delete hostel
  async deleteHostel(hostelId: string) {
    const { error } = await supabase
      .from('hostels')
      .delete()
      .eq('id', hostelId);
    
    if (error) throw error;
  },
};

export const roomAPI = {
  // Get rooms for a hostel
  async getRoomsByHostel(hostelId: string) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hostel_id', hostelId);
    
    if (error) throw error;
    return data;
  },

  // Create room
  async createRoom(room: Partial<Room>) {
    const { data, error } = await supabase
      .from('rooms')
      .insert([room])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Update room
  async updateRoom(roomId: string, updates: Partial<Room>) {
    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomId)
      .select();
    
    if (error) throw error;
    return data[0];
  },
};

export const studentAPI = {
  // Get students for a hostel
  async getStudentsByHostel(hostelId: string) {
    const { data, error } = await supabase
      .from('room_allocations')
      .select(`
        *,
        students(*)
      `)
      .eq('hostel_id', hostelId)
      .eq('active', true);
    
    if (error) throw error;
    return data;
  },

  // Get student profile
  async getStudentProfile(studentId: string) {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profiles(*)
      `)
      .eq('id', studentId)
      .single();
    
    if (error) throw error;
    return data;
  },
};

export const billAPI = {
  // Get bills for a student
  async getBillsByStudent(studentId: string) {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('student_id', studentId)
      .order('due_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get pending bills
  async getPendingBills(hostelId: string) {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('hostel_id', hostelId)
      .eq('status', 'pending');
    
    if (error) throw error;
    return data;
  },

  // Create bill
  async createBill(bill: Partial<Bill>) {
    const { data, error } = await supabase
      .from('bills')
      .insert([bill])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Update bill status
  async updateBillStatus(billId: string, status: string) {
    const { data, error } = await supabase
      .from('bills')
      .update({ status, paid_date: new Date().toISOString() })
      .eq('id', billId)
      .select();
    
    if (error) throw error;
    return data[0];
  },
};

export const uploadAPI = {
  // Upload image to storage
  async uploadImage(bucket: string, filePath: string, file: File) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return urlData.publicUrl;
  },

  // Delete image from storage
  async deleteImage(bucket: string, filePath: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) throw error;
  },
};

export const notificationAPI = {
  // Get notifications for user
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    return data;
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
  },

  // Create notification
  async createNotification(notification: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notification])
      .select();
    
    if (error) throw error;
    return data[0];
  },
};

export const complaintAPI = {
  // Get complaints for hostel
  async getComplaintsByHostel(hostelId: string) {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('hostel_id', hostelId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get complaints by student
  async getComplaintsByStudent(studentId: string) {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create complaint
  async createComplaint(complaint: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('complaints')
      .insert([complaint])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  // Update complaint status
  async updateComplaintStatus(complaintId: string, status: string) {
    const { data, error } = await supabase
      .from('complaints')
      .update({ status })
      .eq('id', complaintId)
      .select();
    
    if (error) throw error;
    return data[0];
  },
};

export const analyticsAPI = {
  // Get hostel analytics
  async getHostelAnalytics(hostelId: string) {
    // Get total students
    const { data: students } = await supabase
      .from('room_allocations')
      .select('id')
      .eq('hostel_id', hostelId)
      .eq('active', true);

    // Get revenue
    const { data: bills } = await supabase
      .from('bills')
      .select('amount')
      .eq('hostel_id', hostelId)
      .eq('status', 'paid');

    // Get rooms
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('hostel_id', hostelId);

    return {
      totalStudents: students?.length || 0,
      totalRevenue: bills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0,
      occupancyRate: rooms?.length ? Math.round(((students?.length || 0) / rooms.length) * 100) : 0,
    };
  },
};
