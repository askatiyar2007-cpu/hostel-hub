/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Megaphone, Receipt, MessageSquareWarning, Plus, Building2, Bed, CreditCard, Zap, FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

// Student Dashboard Container
export default function StudentDashboardPage() {
  return (
    <StudentDashboard />
  );
}

function StudentDashboard() {
  const { profile, loading: isAuthLoading } = useAuth();

  const { data: studentRecord, isLoading: isStudentLoading } = useQuery({
    queryKey: ["student-record", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data: existing, error } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile!.id)
        .maybeSingle();

      if (error) {
        console.error("[Dashboard] Error fetching student record:", error);
        throw error;
      }
      return existing;
    }
  });

  // Simplify the allocation query with direct fetch and subsequent room/hostel fetch
  const fetchAllocation = async () => {
    if (!studentRecord?.id) {
      return null;
    }

    const { data, error } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('student_id', studentRecord.id)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('[Dashboard] Error fetching allocation:', error);
      return null;
    }

    return data;
  };

  const { data: allocation, isLoading: isAllocLoading } = useQuery({
    queryKey: ['student-allocation-simple', studentRecord?.id],
    enabled: !!studentRecord?.id,
    queryFn: fetchAllocation,
    staleTime: 0,
    refetchOnMount: true
  });

  const { data: roomData, isLoading: isRoomLoading } = useQuery({
    queryKey: ['allocation-room', allocation?.room_id],
    enabled: !!allocation?.room_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, hostels(*)')
        .eq('id', allocation!.room_id)
        .single();
      if (error) {
        console.error('[Dashboard] Error fetching room details:', error);
        throw error;
      }
      return data;
    }
  });

  // 4. Update conditional rendering
  // Make sure auth and studentRecord load first
  if (isAuthLoading || isStudentLoading) {
    console.log('[Dashboard] Student record or auth is loading...');
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const isLoading = isAllocLoading || (!!allocation && isRoomLoading);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!allocation) {
    return (
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            {getGreeting()}, {profile?.full_name || 'Student'} 👋
          </h1>
          <p className="text-slate-600">Welcome to your HostelHub.</p>
        </div>

        {/* No Allocation Card */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Room Allocation</h3>
            <p className="text-slate-600 mb-6">You haven't been assigned to any room yet.</p>
            <Link href="/student/room-request">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm">
                Request a Room
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AllocationCard
      allocation={allocation}
      hostel={roomData?.hostels}
      room={roomData}
    />
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// AllocationCard Component rendering the details when data exists
interface AllocationCardProps {
  allocation: any;
  hostel: any;
  room: any;
}

function AllocationCard({ allocation, hostel, room }: AllocationCardProps) {
  const { profile } = useAuth();
  const studentId = allocation.student_id;
  const authUserId = profile?.user_id;
  const qc = useQueryClient();
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!allocation) return;
      const { error } = await supabase.rpc('checkout_student', { p_alloc_id: allocation.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Successfully checked out!");
      setConfirmingCheckout(false);
      qc.invalidateQueries({ queryKey: ["student-allocation"] });
      qc.invalidateQueries({ queryKey: ["allocation"] });
      qc.invalidateQueries({ queryKey: ["student-record"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    }
  });

  const { data: approvedRequest } = useQuery({
    queryKey: ["approved-request", studentId, allocation?.room_id],
    enabled: !!studentId && !!allocation?.room_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("room_requests")
        .select("booking_type")
        .eq("student_id", studentId)
        .eq("room_id", allocation.room_id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: bills } = useQuery({
    queryKey: ["student-bills", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase.from("bills").select("*").eq("student_id", studentId).order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: complaints } = useQuery({
    queryKey: ["student-complaints", authUserId],
    enabled: !!authUserId,
    queryFn: async () => {
      const { data } = await supabase.from("complaints").select("*").eq("student_id", authUserId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: notices } = useQuery({
    queryKey: ["student-notices", allocation?.hostel_id],
    enabled: !!allocation?.hostel_id,
    queryFn: async () => {
      const { data } = await supabase.from("notices").select("*").eq("hostel_id", allocation.hostel_id).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const depositBill = (bills ?? []).find((b: any) => b.bill_type === 'deposit');
  const depositStatus = depositBill ? (depositBill.status === 'paid' ? 'Paid' : 'Pending') : 'Pending';

  const rentBill = (bills ?? []).find((b: any) => b.bill_type === 'rent');
  const monthlyRentStatus = rentBill ? (rentBill.status === 'paid' ? 'Paid' : 'Pending') : 'Pending';

  const pendingBills = (bills ?? []).filter((b: any) => b.status !== 'paid');
  const unpaidComplaints = (complaints ?? []).filter((c: any) => c.status !== 'resolved');

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          {getGreeting()}, {profile?.full_name || 'Student'} 👋
        </h1>
        <p className="text-sm text-slate-600">Welcome back to HostelHub.</p>
      </div>

      {/* Approved Request Confirmation Card */}
      {approvedRequest && (
        <Card className="border border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-emerald-50/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Student Profile Photo */}
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile?.full_name || 'Student'}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-400/30 shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-lg font-bold ring-2 ring-emerald-400/30 shrink-0">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-bold text-emerald-900">Room Allocation Confirmed</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Approved
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mb-3">Welcome to your new home, {profile?.full_name?.split(' ')[0] || 'Student'}.</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-slate-500 mb-0.5">Hostel</p>
                    <p className="font-semibold text-slate-900 text-xs truncate">{hostel?.name || '—'}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-slate-500 mb-0.5">Room</p>
                    <p className="font-semibold text-slate-900 text-xs">Room {room?.room_number || '—'}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-slate-500 mb-0.5">Type</p>
                    <p className="font-semibold text-slate-900 text-xs capitalize">{approvedRequest.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <p className="text-[10px] text-slate-500 mb-0.5">Rent</p>
                    <p className="font-semibold text-slate-900 text-xs">₹{Number(room?.rent ?? 0).toLocaleString()}/month</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/student/bills" className="block">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">
                      View Payment Details
                    </Button>
                  </Link>
                  <Link href="/student/dashboard" className="block">
                    <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium">
                      View Room
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Hostel</p>
                <p className="font-semibold text-slate-900 text-sm truncate max-w-[100px]">{hostel?.name || '—'}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">{hostel?.city || ''}</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Bed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Room</p>
                <p className="font-semibold text-slate-900 text-sm">Room {room?.room_number || '—'}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">{room?.room_type || room?.type || '—'}</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Monthly Rent</p>
                <p className="font-semibold text-slate-900 text-sm">₹{Number(room?.rent ?? 0).toLocaleString()}</p>
              </div>
            </div>
            <p className={cn("text-xs font-medium", monthlyRentStatus === 'Paid' ? 'text-green-600' : 'text-amber-600')}>
              {monthlyRentStatus}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="font-semibold text-slate-900 text-sm">Active</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">Since {allocation.start_date ? new Date(allocation.start_date).toLocaleDateString() : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Stay Card */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Current Stay</h2>
              <p className="text-sm text-slate-500">Hostel and room information</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Allocation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Hostel Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Building2 className="h-4 w-4 text-blue-600" />
                Hostel Information
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Hostel Name</p>
                  <p className="font-semibold text-slate-900">{hostel?.name || '—'}</p>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="text-sm text-slate-700">
                    {hostel?.address && hostel?.area && hostel?.city && hostel?.state 
                      ? `${hostel.address}, ${hostel.area}, ${hostel.city}, ${hostel.state}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Room Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Bed className="h-4 w-4 text-purple-600" />
                Room Information
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Room Number</p>
                    <p className="font-semibold text-slate-900">Room {room?.room_number || '—'}</p>
                  </div>
                  <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-1 rounded-lg">
                    {approvedRequest?.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Capacity</p>
                  <p className="text-sm text-slate-700">
                    {room?.capacity ?? 2} beds • {room?.occupied_beds ?? room?.occupancy ?? 1} occupied
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Monthly Rent</p>
                  <p className="font-semibold text-slate-900">₹{Number(room?.rent ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <CreditCard className="h-4 w-4 text-amber-600" />
                Financial Status
              </div>
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">Security Deposit</p>
                  <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", 
                    depositStatus === 'Paid' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  )}>
                    {depositStatus}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <p className="text-xs text-slate-500">Monthly Fees</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">₹{Number(room?.rent ?? 0).toLocaleString()}</span>
                    <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", 
                      monthlyRentStatus === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {monthlyRentStatus}
                    </span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <p className="text-xs text-slate-500">Check-in Date</p>
                  <span className="text-sm text-slate-700">
                    {allocation.start_date ? new Date(allocation.start_date).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/hostels/${allocation.hostel_id}`}>
              <Button variant="outline" className="rounded-xl">View Hostel</Button>
            </Link>
            <Link href="/student/documents">
              <Button variant="outline" className="rounded-xl">Download Agreement</Button>
            </Link>
            <Link href="/student/bills">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">Pay Fees</Button>
            </Link>
            {confirmingCheckout ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                <span className="text-xs text-rose-700 font-medium">Checkout?</span>
                <div className="flex gap-1">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="rounded-lg text-xs h-7 px-3"
                    onClick={() => checkoutMutation.mutate()}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? '...' : 'Yes'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-lg text-xs h-7 px-3"
                    onClick={() => setConfirmingCheckout(false)}
                  >
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => setConfirmingCheckout(true)}
              >
                Check Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/student/bills" className="block">
          <Card className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Pay Bill</p>
                  <p className="text-xs text-slate-500">{pendingBills.length} pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/electricity" className="block">
          <Card className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Electricity</p>
                  <p className="text-xs text-slate-500">View usage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/complaints" className="block">
          <Card className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <MessageSquareWarning className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Complaints</p>
                  <p className="text-xs text-slate-500">{unpaidComplaints.length} active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/student/documents" className="block">
          <Card className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Documents</p>
                  <p className="text-xs text-slate-500">View & download</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Bills & Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900">Recent Bills</h3>
              </div>
              <Link href="/student/bills" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                View all →
              </Link>
            </div>
            {bills && bills.length > 0 ? (
              <div className="space-y-3">
                {bills.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-medium text-slate-900 capitalize text-sm">{b.bill_type}</p>
                      <p className="text-xs text-slate-500">Due {new Date(b.due_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">₹{Number(b.amount).toLocaleString()}</p>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", 
                        b.status === 'paid' ? 'bg-green-100 text-green-700' : 
                        b.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 
                        'bg-amber-100 text-amber-700'
                      )}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No bills yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-slate-900">Complaints</h3>
              </div>
              <NewComplaintDialog studentId={authUserId ?? ''} hostelId={allocation.hostel_id} onCreated={() => qc.invalidateQueries({ queryKey: ["student-complaints"] })} />
            </div>
            {complaints && complaints.length > 0 ? (
              <div className="space-y-3">
                {complaints.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-slate-900 text-sm">{c.title}</p>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full capitalize", 
                        c.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                        c.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                        'bg-amber-100 text-amber-700'
                      )}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">{c.category}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No complaints yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Announcements</h3>
            </div>
            <Link href="/student/announcements" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
              View all →
            </Link>
          </div>
          {notices && notices.length > 0 ? (
            <div className="space-y-3">
              {notices.map((n: any) => (
                <div key={n.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm text-slate-600">{n.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No announcements right now</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewComplaintDialog({ studentId, hostelId, onCreated }: { studentId: string; hostelId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "other" });
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("complaints").insert({
        hostel_id: hostelId, student_id: studentId,
        title: form.title, description: form.description,
        category: form.category as "electrical" | "plumbing" | "wifi" | "cleaning" | "furniture" | "security" | "other",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Complaint raised"); setOpen(false); setForm({ title: "", description: "", category: "other" }); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl"><Plus className="mr-1 h-4 w-4" /> New</Button>
      </DialogTrigger>
      <DialogContent className="rounded-xl">
        <DialogHeader><DialogTitle>Raise a complaint</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Category</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["electrical","plumbing","wifi","cleaning","furniture","security","other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Describe the issue</Label><Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={mutation.isPending} className="rounded-xl">Submit</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
