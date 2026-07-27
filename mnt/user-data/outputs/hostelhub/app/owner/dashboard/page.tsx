'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Building2, Users, DollarSign, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalHostels: number;
  totalRooms: number;
  totalStudents: number;
  occupancyRate: number;
  totalRevenue: number;
  pendingPayments: number;
  openComplaints: number;
}

export default function OwnerDashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalHostels: 0,
    totalRooms: 0,
    totalStudents: 0,
    occupancyRate: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    openComplaints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      if (!profile?.id) return;

      // Fetch hostels
      const { data: hostelsData } = await supabase
        .from('hostels')
        .select('*')
        .eq('owner_id', profile.id);

      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .in('hostel_id', hostelsData?.map(h => h.id) || []);

      // Fetch students
      const { data: studentsData } = await supabase
        .from('room_assignments')
        .select('*')
        .in('hostel_id', hostelsData?.map(h => h.id) || [])
        .eq('status', 'active');

      // Fetch bills (unpaid)
      const { data: billsData } = await supabase
        .from('bills')
        .select('amount')
        .in('hostel_id', hostelsData?.map(h => h.id) || [])
        .eq('status', 'pending');

      // Fetch complaints (open)
      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .in('hostel_id', hostelsData?.map(h => h.id) || [])
        .eq('status', 'open');

      const totalRooms = roomsData?.length || 0;
      const totalStudents = studentsData?.length || 0;
      const occupancy = totalRooms > 0 
        ? Math.round(totalStudents / totalRooms * 100)
        : 0;

      const totalRevenue = billsData?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0;

      setStats({
        totalHostels: hostelsData?.length || 0,
        totalRooms: totalRooms,
        totalStudents: totalStudents,
        occupancyRate: occupancy,
        totalRevenue: totalRevenue,
        pendingPayments: billsData?.length || 0,
        openComplaints: complaintsData?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="card flex items-center space-x-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display">{value}</p>
      </div>
    </div>
  );

  const revenueData = [
    { month: 'Jan', revenue: 45000 },
    { month: 'Feb', revenue: 52000 },
    { month: 'Mar', revenue: 48000 },
    { month: 'Apr', revenue: 61000 },
    { month: 'May', revenue: 55000 },
    { month: 'Jun', revenue: stats.totalRevenue },
  ];

  const occupancyData = [
    { name: 'Occupied', value: stats.totalStudents },
    { name: 'Available', value: Math.max(0, stats.totalRooms - stats.totalStudents) },
  ];

  const COLORS = ['#3b82f6', '#10b981'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Welcome back, {profile?.full_name}! 👋</h1>
        <p className="text-muted-foreground mt-2">Here's your hostel performance overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Hostels"
          value={stats.totalHostels}
          color="bg-blue-500"
        />
        <StatCard
          icon={Users}
          label="Total Students"
          value={stats.totalStudents}
          color="bg-green-500"
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          color="bg-amber-500"
        />
        <StatCard
          icon={AlertCircle}
          label="Open Complaints"
          value={stats.openComplaints}
          color="bg-red-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-display font-bold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                name="Revenue (₹)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Chart */}
        <div className="card">
          <h3 className="text-lg font-display font-bold mb-4">Room Occupancy</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={occupancyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/owner/hostels/new" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <Building2 size={24} className="text-primary mb-2" />
          <h4 className="font-bold">Add New Hostel</h4>
          <p className="text-sm text-muted-foreground">Create a new hostel listing</p>
        </Link>
        <Link href="/owner/students/new" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <Users size={24} className="text-primary mb-2" />
          <h4 className="font-bold">Add Student</h4>
          <p className="text-sm text-muted-foreground">Register a new student</p>
        </Link>
        <Link href="/owner/billing" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <DollarSign size={24} className="text-primary mb-2" />
          <h4 className="font-bold">Generate Bills</h4>
          <p className="text-sm text-muted-foreground">Create rent & utility bills</p>
        </Link>
      </div>
    </div>
  );
}
