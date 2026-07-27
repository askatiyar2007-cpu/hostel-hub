'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { DollarSign, Building2, MapPin, AlertCircle } from 'lucide-react';

interface StudentDashboardData {
  hostelName?: string;
  roomNumber?: string;
  bedNumber?: string;
  monthlyRent?: number;
  electricityBill?: number;
  pendingBills?: number;
  complaints?: number;
}

export default function StudentDashboardPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<StudentDashboardData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData();
  }, [profile]);

  const fetchStudentData = async () => {
    try {
      if (!profile?.id) return;

      // Get room assignment
      const { data: assignmentData } = await supabase
        .from('room_assignments')
        .select('*, hostels(*), rooms(*)')
        .eq('student_id', profile.id)
        .eq('status', 'active')
        .single();

      if (assignmentData) {
        setData({
          hostelName: assignmentData.hostels?.name,
          roomNumber: assignmentData.rooms?.room_number,
          bedNumber: assignmentData.bed_id,
          monthlyRent: assignmentData.rooms?.monthly_rent,
        });
      }

      // Get bills
      const { data: billsData } = await supabase
        .from('bills')
        .select('*')
        .eq('student_id', profile.id);

      if (billsData) {
        const pending = billsData.filter(b => b.status === 'pending').length;
        const electricity = billsData.find(b => b.bill_type === 'electricity');
        
        setData(prev => ({
          ...prev,
          electricityBill: electricity?.amount,
          pendingBills: pending,
        }));
      }

      // Get complaints
      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .eq('student_id', profile.id)
        .eq('status', 'open');

      if (complaintsData) {
        setData(prev => ({ ...prev, complaints: complaintsData.length }));
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value }: any) => (
    <div className="card flex items-center space-x-4">
      <div className="p-3 rounded-lg bg-primary/10">
        <Icon size={24} className="text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display">{value || 'N/A'}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-display font-bold">My Dashboard</h1>
          <p className="text-muted-foreground">Welcome {profile?.full_name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center">Loading...</div>
        ) : !data.hostelName ? (
          <div className="card text-center py-12">
            <Building2 size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold">Not Assigned to a Hostel</h3>
            <p className="text-muted-foreground mt-2">
              Contact your hostel owner for room assignment
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hostel Info */}
            <div className="card">
              <h2 className="text-lg font-bold mb-4">My Room</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hostel</p>
                  <p className="font-bold">{data.hostelName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Room Number</p>
                  <p className="font-bold">{data.roomNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bed Number</p>
                  <p className="font-bold">{data.bedNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="font-bold">₹{data.monthlyRent?.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={DollarSign}
                label="Pending Bills"
                value={data.pendingBills || 0}
              />
              <StatCard
                icon={AlertCircle}
                label="Open Complaints"
                value={data.complaints || 0}
              />
              <StatCard
                icon={DollarSign}
                label="Electricity Bill"
                value={data.electricityBill ? `₹${data.electricityBill}` : 'N/A'}
              />
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="/student/bills" className="card hover:shadow-lg transition-shadow cursor-pointer">
                <DollarSign size={24} className="text-primary mb-2" />
                <h4 className="font-bold">View Bills</h4>
                <p className="text-sm text-muted-foreground">Check your bills</p>
              </a>
              <a href="/student/complaints" className="card hover:shadow-lg transition-shadow cursor-pointer">
                <AlertCircle size={24} className="text-primary mb-2" />
                <h4 className="font-bold">Submit Complaint</h4>
                <p className="text-sm text-muted-foreground">Report issues</p>
              </a>
              <a href="/student/announcements" className="card hover:shadow-lg transition-shadow cursor-pointer">
                <MapPin size={24} className="text-primary mb-2" />
                <h4 className="font-bold">Announcements</h4>
                <p className="text-sm text-muted-foreground">View notices</p>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
