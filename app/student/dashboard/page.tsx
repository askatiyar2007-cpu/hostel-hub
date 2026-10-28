/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Bed,
  CreditCard,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Phone,
  Mail,
  MapPin,
  Receipt,
  ChevronRight,
  Calendar,
  Wifi,
  Wrench,
  Sparkles,
  Home,
  Check,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";


function formatFeeTitle(monthYear?: string, dueDate?: string): string {
  if (monthYear) {
    const parts = monthYear.split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (!isNaN(year) && !isNaN(month)) {
        const d = new Date(year, month - 1, 1);
        return `${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Rent`;
      }
    }
    return `${monthYear} Rent`;
  }
  if (dueDate) {
    const d = new Date(dueDate);
    return `${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Rent`;
  }
  return 'Monthly Rent';
}

// Time-of-day greeting helper
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Format currency
function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// Category icons and colors for complaints
const COMPLAINT_CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  electrical: { label: "Electrical", icon: Zap, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  plumbing: { label: "Plumbing", icon: Wrench, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  wifi: { label: "Wi-Fi & Internet", icon: Wifi, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  cleaning: { label: "Cleaning & Hygiene", icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  furniture: { label: "Furniture & Bed", icon: Home, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  security: { label: "Security & Locks", icon: ShieldCheck, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  other: { label: "General Issue", icon: AlertCircle, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
};

// Root Page Entry
export default function StudentDashboardPage() {
  const { profile, loading: isAuthLoading } = useAuth();

  // 1. Fetch authenticated student record
  const { data: studentRecord, isLoading: isStudentLoading } = useQuery({
    queryKey: ["student-record", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      // Direct lookup by profile_id
      const { data, error } = await supabase
        .from('students')
        .select('id, profile_id, status, created_at')
        .eq('profile_id', profile!.id)
        .maybeSingle();

      if (error) {
        console.error("[Dashboard] Error fetching student record by profile_id:", error);
      }
      if (data) return data;

      // Fallback: lookup by student_email if student signed up with Google/email
      if (profile?.email) {
        const { data: emailData, error: emailErr } = await supabase
          .from('students')
          .select('id, profile_id, status, created_at')
          .eq('student_email', profile.email)
          .maybeSingle();

        if (!emailErr && emailData) {
          if (!emailData.profile_id) {
            await supabase
              .from('students')
              .update({ profile_id: profile!.id })
              .eq('id', emailData.id);
          }
          return emailData;
        }
      }

      return null;
    }
  });

  // 2. Fetch active room allocation with joined room and hostel
  const { data: allocation, isLoading: isAllocLoading } = useQuery({
    queryKey: ['active-allocation-simple', studentRecord?.id, profile?.id],
    enabled: !!profile?.id && !isStudentLoading,
    queryFn: async () => {
      // Find candidate student identifiers
      const candidateIds: string[] = [profile!.id];
      if (studentRecord?.id) candidateIds.push(studentRecord.id);

      // Query room_allocations by candidate IDs or email with joined rooms and hostels
      let alloc: any = null;

      const { data: allocList, error: allocErr } = await supabase
        .from('room_allocations')
        .select('*, rooms(*, hostels(*))')
        .in('student_id', candidateIds)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!allocErr && allocList && allocList.length > 0) {
        alloc = allocList[0];
      }

      if (!alloc && profile?.email) {
        const { data: emailAllocs } = await supabase
          .from('room_allocations')
          .select('*, rooms(*, hostels(*))')
          .ilike('student_email', profile.email)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (emailAllocs && emailAllocs.length > 0) {
          alloc = emailAllocs[0];
        }
      }

      if (!alloc) return null;

      // Extract joined hostels reference if already loaded
      if (alloc.rooms && !alloc.hostels) {
        alloc.hostels = (alloc.rooms as any).hostels;
      }

      // Safe fallback: fetch room details if not already loaded in join
      if (alloc.room_id && (!alloc.rooms || !alloc.hostels)) {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*, hostels(*)')
          .eq('id', alloc.room_id)
          .maybeSingle();

        if (roomError) {
          console.error('[Dashboard] Error fetching room details for allocation:', roomError);
          return {
            ...alloc,
            rooms: null,
            hostels: null,
          };
        }

        return {
          ...alloc,
          rooms: roomData,
          hostels: roomData?.hostels,
        };
      }

      return alloc;
    },
    staleTime: 10 * 1000,
    refetchOnMount: true
  });

  // 3. Fetch pending room request if no active allocation exists
  const { data: pendingRequest, isLoading: isPendingReqLoading } = useQuery({
    queryKey: ['student-pending-request', studentRecord?.id || profile?.id],
    enabled: (!!studentRecord?.id || !!profile?.id) && !allocation,
    queryFn: async () => {
      const candidateIds = [profile!.id];
      if (studentRecord?.id) candidateIds.push(studentRecord.id);

      const { data, error } = await supabase
        .from('room_requests')
        .select(`
          id,
          status,
          created_at,
          booking_type,
          rooms (
            id,
            room_number,
            rent,
            room_type,
            floor,
            hostels (
              id,
              name,
              address,
              city,
              contact_number,
              email
            )
          )
        `)
        .in('student_id', candidateIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Dashboard] Error fetching pending room request:', error);
        return null;
      }
      return data;
    }
  });

  // Loading State
  if (isAuthLoading || isStudentLoading || isAllocLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Syncing your dashboard...</p>
        </div>
      </div>
    );
  }

  // If no active allocation, show Onboarding / Pending Request View
  if (!allocation) {
    return (
      <NoAllocationView
        studentRecord={studentRecord}
        pendingRequest={pendingRequest}
        isPendingReqLoading={isPendingReqLoading}
        profile={profile}
      />
    );
  }

  // Main Active Resident Dashboard
  return (
    <ActiveResidentDashboard
      allocation={allocation}
      hostel={allocation?.hostels}
      room={allocation?.rooms}
      studentRecord={studentRecord}
    />
  );
}

// ============================================================================
// NO ALLOCATION VIEW (Pending Request Tracker or Empty Onboarding)
// ============================================================================
export function NoAllocationView({
  studentRecord: _studentRecord,
  pendingRequest,
  isPendingReqLoading: _isPendingReqLoading,
  profile,
}: {
  studentRecord: any;
  pendingRequest: any;
  isPendingReqLoading: boolean;
  profile: any;
}) {
  const reqRoom = pendingRequest?.rooms as any;
  const reqHostel = reqRoom?.hostels as any;
  const isPending = pendingRequest?.status === 'pending';
  const isRejected = pendingRequest?.status === 'rejected';

  return (
    <div className="space-y-6 w-full">
      {/* Welcome Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            {getGreeting()}, <span className="capitalize">{profile?.full_name?.split(' ')[0] || 'Student'}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome to StayKosh. Manage your accommodation, rent payments, and requests in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/find-hostel">
            <Button variant="outline" className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 text-sm">
              <Building2 className="mr-2 h-4 w-4 text-teal-600" />
              Browse Hostels
            </Button>
          </Link>
          <Link href="/student/room-request">
            <Button className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm text-sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Request a Room
            </Button>
          </Link>
        </div>
      </div>

      {/* If there is a pending request currently being reviewed */}
      {isPending && (
        <Card className="border border-teal-200 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40 dark:from-[#0e222e] dark:via-[#0b1b24] dark:to-[#081820] shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-800 dark:text-teal-300">
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                  Application Status: Pending Owner Approval
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Your Room Booking Request is Under Review
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your request for <span className="font-semibold text-slate-900 dark:text-slate-100">{reqHostel?.name || 'the hostel'}</span> has been submitted. The owner will review your tenant details and allocate your room and bed. You will receive immediate confirmation once approved.
                </p>

                {/* Requested Details Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-white dark:bg-[#122b3b] rounded-xl border border-slate-200/80 dark:border-[#1a3d52]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Hostel</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{reqHostel?.name || '—'}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{reqHostel?.city || ''}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#122b3b] rounded-xl border border-slate-200/80 dark:border-[#1a3d52]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Room</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Room {reqRoom?.room_number || '—'}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 capitalize">{reqRoom?.room_type || 'Standard'}</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#122b3b] rounded-xl border border-slate-200/80 dark:border-[#1a3d52]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Booking Type</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                      {pendingRequest?.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Bed'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Monthly Rent</p>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#122b3b] rounded-xl border border-slate-200/80 dark:border-[#1a3d52]">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Estimated Rent</p>
                    <p className="text-sm font-bold text-teal-700 dark:text-teal-400">₹{Number(reqRoom?.rent ?? 0).toLocaleString('en-IN')}/mo</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Excl. electricity</p>
                  </div>
                </div>
              </div>

              {/* Stepper Indicator */}
              <div className="p-5 bg-white dark:bg-[#122b3b] rounded-2xl border border-slate-200/90 dark:border-[#1a3d52] shadow-xs lg:w-72 shrink-0 space-y-4">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Onboarding Progress</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">1. Request Submitted</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(pendingRequest.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-teal-700 dark:text-teal-300">2. Owner Verification</p>
                      <p className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">In review by owner</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">3. Deposit & Check-In</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Pay deposit to move in</p>
                    </div>
                  </div>
                </div>

                {reqHostel?.contact_number && (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#1a3d52]">
                    <a
                      href={`tel:${reqHostel.contact_number}`}
                      className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-100 dark:border-teal-800 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call Hostel Office: {reqHostel.contact_number}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* If request was rejected */}
      {isRejected && (
        <Card className="border border-rose-200 bg-rose-50/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-slate-900">Previous Application Not Approved</h3>
                <p className="text-sm text-slate-600">
                  Your recent booking request was not accepted by the hostel management (usually due to room capacity or profile mismatch). You can request another room or discover available accommodations across our verified hostel network.
                </p>
                <div className="pt-2 flex gap-3">
                  <Link href="/find-hostel">
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                      Explore Other Hostels
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step-by-Step Onboarding Guide */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">How Accommodation on StayKosh Works</h3>
          <p className="text-sm text-slate-500">Fast, digital check-in with transparent billing and sub-metered electricity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h4 className="font-bold text-slate-900 text-base">Explore Hostels & Rooms</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Browse verified hostels, check genuine photos, examine room capacities, amenities, rules, and starting monthly rents.
            </p>
            <Link href="/find-hostel" className="inline-flex items-center text-xs font-semibold text-teal-700 hover:text-teal-800">
              Browse Discovery Directory <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="h-12 w-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h4 className="font-bold text-slate-900 text-base">Submit Room Booking</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select your room number or enter your hostel’s registration code. Fill in basic tenant details and guardian emergency contact.
            </p>
            <Link href="/student/room-request" className="inline-flex items-center text-xs font-semibold text-teal-700 hover:text-teal-800">
              Go to Room Request Form <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h4 className="font-bold text-slate-900 text-base">Check-In & Digital Pass</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upon owner approval, your bed is locked. Track your itemized rent and sub-metered electricity readings with instant receipts.
            </p>
            <span className="inline-flex items-center text-xs font-medium text-slate-400">
              Automatic upon approval
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVE RESIDENT DASHBOARD
// ============================================================================
interface ActiveResidentDashboardProps {
  allocation: any;
  hostel: any;
  room: any;
  studentRecord: any;
}

export function ActiveResidentDashboard({
  allocation,
  hostel,
  room,
  studentRecord,
}: ActiveResidentDashboardProps) {
  const { profile, user } = useAuth();
  const studentId = studentRecord?.id;
  const authUserId = profile?.user_id || user?.id;
  const qc = useQueryClient();
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);

  // 1. Fetch Student Fees with joined payments
  const { data: feesData } = useQuery({
    queryKey: ["student-fees-with-payments", studentId, allocation?.id],
    enabled: !!studentId && !!allocation?.id,
    queryFn: async () => {
      // Fetch Student Fees and payments concurrently
      const [feesRes, paymentsRes] = await Promise.all([
        supabase
          .from('student_fees').select('*').eq('student_id', studentId).eq('allocation_id', allocation.id).order('due_date', { ascending: true }),
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId),
      ]);

      if (feesRes.error) {
        console.error("[Dashboard] Error fetching fees:", feesRes.error);
        return { fees: [], total_due: 0, total_paid: 0, currentMonthFee: null, pendingFees: [] };
      }

      const feeList = feesRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      const formattedFees = feeList.map((fee: any) => {
        const matchingPayments = payments.filter((p: any) =>
          p.fee_id === fee.id || p.student_fees_id === fee.id
        );
        const payment = matchingPayments.find((p: any) => 
          p.payment_status === 'completed' || p.status === 'completed' || p.payment_status === 'pending_verification' || p.status === 'pending_verification'
        ) || matchingPayments[0] || null;

        const feeAmount = Number(fee.amount_due ?? fee.amount ?? 0);
        return {
          ...fee,
          amount: feeAmount,
          reference_number: payment?.reference_number,
          payment_method: payment?.payment_method || fee.payment_method,
          paid_date: payment?.paid_date || payment?.paid_at || fee.paid_date,
          payment_status: payment?.payment_status || payment?.status || fee.status
        };
      });

      const now = new Date();
      const currentMonthFee = formattedFees.find((f: any) => {
        if (!f.due_date && !f.month_year) return false;
        if (f.month_year) {
          const [y, m] = f.month_year.split('-').map(Number);
          if (y === now.getFullYear() && m === (now.getMonth() + 1)) return true;
        }
        if (f.due_date) {
          const d = new Date(f.due_date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return false;
      }) || formattedFees.find((f: any) => f.status !== 'paid') || formattedFees[0] || null;

      const pendingFees = formattedFees.filter((f: any) => f.status === 'pending' || f.status === 'overdue' || f.status === 'pending_verification');
      const total_due = formattedFees
        .filter((f: any) => f.status === 'pending' || f.status === 'overdue')
        .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

      const total_paid = formattedFees
        .filter((f: any) => f.status === 'paid')
        .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

      formattedFees.sort((a: any, b: any) => {
        const dateA = new Date(a.due_date || a.created_at).getTime();
        const dateB = new Date(b.due_date || b.created_at).getTime();
        return dateA - dateB;
      });
      return { fees: formattedFees,
        total_due,
        total_paid,
        currentMonthFee,
        pendingFees
      };
    }
  });

  // 2. Fetch deposit payments
  const { data: depositPayments } = useQuery({
    queryKey: ["student-deposit-payments", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('payments')
        .select('id, amount, payment_status, status, paid_date')
        .eq('student_id', studentId)
        .is('student_fees_id', null)
        .limit(1);
      return data ?? [];
    }
  });

  // 3. Fetch complaints
  const { data: complaints = [] } = useQuery({
    queryKey: ["student-complaints", authUserId],
    enabled: !!authUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("*")
        .eq("student_id", authUserId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // 4. Fetch announcements / notices
  const { data: notices = [] } = useQuery({
    queryKey: ["student-notices", allocation?.hostel_id],
    enabled: !!allocation?.hostel_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("hostel_id", allocation.hostel_id)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  // 5. Fetch current month electricity charges
  const { data: electricitySnapshot } = useQuery({
    queryKey: ["student-electricity-snapshot", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const res = await fetch(`/api/billing/student-charges?student_id=${studentId}&billing_month=${monthStr}`);
        if (!res.ok) return { total_rupees: 0, consumption_units: 0, charges: [] };
        const data = await res.json();
        const charges = data.charges || [];
        const consumption_units = data.total_student_consumption_units ?? charges.reduce((sum: number, c: any) => sum + (c.student_consumption_units || c.consumption_units || 0), 0);
        const total_rupees = data.total_rupees || 0;
        return { total_rupees, consumption_units, charges };
      } catch (e) {
        return { total_rupees: 0, consumption_units: 0, charges: [] };
      }
    }
  });

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!allocation) return;
      const { error } = await supabase.rpc('vacate_room_allocation', { p_alloc_id: allocation.id });
      if (error) throw error;

      // Mark pre-checkout fee-schedule and rent notifications as read
      if (user?.id) {
        try {
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false)
            .in('type', ['fees', 'payment']);

          // Add checkout confirmation record
          const targetUserId = user?.id || authUserId;
          if (targetUserId) {
            await supabase
              .from('notifications')
              .insert({
                user_id: targetUserId,
                title: 'Checkout Completed',
                message: `You have successfully vacated Room ${room?.room_number || ''} at ${hostel?.name || 'the hostel'}.`,
                type: 'system',
                read: false,
              });
          }
        } catch (e) {
          console.warn('[checkoutMutation] Notification lifecycle update:', e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Successfully checked out from hostel room.");
      setIsCheckoutDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["student-actionable-notifications"] });
      qc.invalidateQueries({ queryKey: ["active-allocation-simple"] });
      qc.invalidateQueries({ queryKey: ["has-active-allocation"] });
      qc.invalidateQueries({ queryKey: ["student-record"] });
      qc.invalidateQueries({ queryKey: ["student-fees-with-payments"] });
      qc.invalidateQueries({ queryKey: ["student-deposit-payments"] });
      qc.clear();
      window.location.href = '/student/dashboard';
    },
    onError: (e: Error) => {
      toast.error(e.message || "Checkout failed");
    }
  });

  // Financial calculations
  const hasPaidDeposit = allocation?.deposit_status === 'paid' || 
    (depositPayments && depositPayments.some((p: any) => p.payment_status === 'completed' || p.status === 'completed'));
  const depositStatus = hasPaidDeposit ? 'Paid' : 'Pending';
  const depositAmount = Number(room?.security_deposit ?? allocation?.deposit_amount ?? 5000);

  const currentMonthFee = feesData?.currentMonthFee;
  const currentRentAmount = currentMonthFee
    ? Number(currentMonthFee.amount_due ?? currentMonthFee.amount ?? room?.rent ?? 0)
    : Number(room?.rent ?? 0);

  const monthlyRentStatus = currentMonthFee
    ? currentMonthFee.status === 'paid'
      ? 'Paid'
      : currentMonthFee.status === 'pending_verification'
      ? 'Pending Verification'
      : currentMonthFee.status === 'overdue'
      ? 'Overdue'
      : 'Pending'
    : 'Pending';

  const totalOutstanding = (feesData?.total_due || 0);
  const activeComplaints = complaints.filter((c: any) => c.status !== 'resolved' && c.status !== 'closed');

  return (
    <div className="space-y-4 sm:space-y-4.5 w-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-3.5 border-b border-slate-200/80 dark:border-[#1a3d52]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {getGreeting()}, <span className="capitalize">{profile?.full_name?.split(' ')[0] || 'Student'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>Room <strong className="text-slate-900 dark:text-slate-100 font-bold">{room?.room_number || '—'}</strong></span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{hostel?.name || 'Hostel'}</span>
            {hostel?.city && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="capitalize">{hostel.city}</span>
              </>
            )}
          </p>
        </div>

        {/* Right CTA cluster */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <NewComplaintDialog
            studentId={authUserId ?? ''}
            hostelId={allocation.hostel_id}
            onCreated={() => qc.invalidateQueries({ queryKey: ["student-complaints"] })}
          />

          <Link href="/student/bills">
            <Button
              className="rounded-xl shadow-xs hover:shadow text-xs sm:text-sm font-semibold transition-all bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white flex items-center gap-1.5 h-9 px-3.5 sm:px-4 cursor-pointer active:scale-95"
            >
              <CreditCard className="h-4 w-4" />
              {totalOutstanding > 0 ? (
                <>
                  <span>Pay Dues</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide">
                    {formatCurrency(totalOutstanding)}
                  </span>
                </>
              ) : (
                'Billing Ledger'
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Digital Resident Room Pass & Living Hub */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#0e222e] p-4 sm:p-5.5 shadow-xs border border-slate-200/90 dark:border-[#1a3d52] transition-all hover:border-teal-500/30">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-5">
          {/* Left: Room Badge, Specs & Amenities */}
          <div className="space-y-3 max-w-2xl flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Resident Pass
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {allocation.start_date ? `Checked In: ${new Date(allocation.start_date).toLocaleDateString()}` : 'Active Residency'}
              </span>
            </div>

            <div>
              <p className="text-xs text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="capitalize">{hostel?.name || 'Student Residence'}</span>
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-0.5">
                Room {room?.room_number || '—'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="capitalize font-medium text-slate-700 dark:text-slate-200">{room?.room_type || room?.type || 'Standard Room'}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>{room?.floor ? `Floor ${room.floor}` : 'Ground Floor'}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200">
                  <Bed className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  {allocation.booking_type === 'entire_room' ? 'Entire Room Booking' : 'Shared Bed Space'}
                </span>
              </p>
            </div>

            {/* Room Inclusions / Amenities Tags */}
            <div className="pt-0.5 flex flex-wrap gap-1.5 sm:gap-2">
              {Array.isArray(room?.facilities) && room.facilities.length > 0 ? (
                room.facilities.map((fac: string, idx: number) => {
                  const label = fac.replace(/laundary/gi, 'Laundry');
                  return (
                    <span key={idx} className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#1a3d52]">
                      {label}
                    </span>
                  );
                })
              ) : (
                <>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#1a3d52]">
                    High-Speed Wi-Fi
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#1a3d52]">
                    Study Desk &amp; Chair
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#1a3d52]">
                    Wardrobe Storage
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#1a3d52]">
                    Ceiling Fan &amp; Light
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Warden Desk Contact & Quick Actions */}
          <div className="flex flex-col gap-2.5 lg:w-76 shrink-0">
            {/* Warden Quick Contact Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/90 dark:border-[#1a3d52] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Hostel Warden Desk</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Need key assistance, curfew extension, or room maintenance help?
              </p>
              <div className="space-y-1.5 pt-0.5">
                {hostel?.contact_number && (
                  <a
                    href={`tel:${hostel.contact_number}`}
                    className="flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call Warden ({hostel.contact_number})
                  </a>
                )}
                {hostel?.email && (
                  <a
                    href={`mailto:${hostel.email}`}
                    className="flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded-lg bg-white dark:bg-[#16364a] hover:bg-slate-100 dark:hover:bg-[#1c435c] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#1a3d52] text-xs font-medium transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    Email Hostel Office
                  </a>
                )}
              </div>
            </div>

            {/* Public profile & Vacate buttons */}
            <div className="flex items-center gap-2">
              <Link href={`/hostels/${allocation.hostel_id}`} className="flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center rounded-xl py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#16364a] border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] h-9 shadow-2xs transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-teal-600 dark:text-teal-400" />
                  Hostel Profile
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#122b3b] font-semibold transition-all h-9 shadow-2xs"
                onClick={() => setIsCheckoutDialogOpen(true)}
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Vacate Room
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Four Student Living Essentials Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Card 1: Monthly Rent Status */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs hover:border-teal-500/30 transition-all rounded-2xl">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Rent</span>
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {totalOutstanding > 0 ? formatCurrency(totalOutstanding) : formatCurrency(currentRentAmount)}
              </h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className={cn(
                  "font-semibold px-2 py-0.5 rounded-full text-[10px]",
                  totalOutstanding === 0
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20"
                )}>
                  {totalOutstanding === 0 ? "Rent Up to Date" : `${monthlyRentStatus} (${feesData?.pendingFees?.length || 1} Due)`}
                </span>
                <Link href="/student/bills" className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 text-xs">
                  Bills <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Electricity Usage */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs hover:border-teal-500/30 transition-all rounded-2xl">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Electricity Usage</span>
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {electricitySnapshot?.consumption_units ? `${electricitySnapshot.consumption_units} kWh` : 'Active'}
              </h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  {electricitySnapshot?.total_rupees ? `${formatCurrency(electricitySnapshot.total_rupees)} current` : 'Sub-meter linked'}
                </span>
                <Link href="/student/electricity" className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 text-xs">
                  Meter <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Room Maintenance */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs hover:border-teal-500/30 transition-all rounded-2xl">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Maintenance Desk</span>
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeComplaints.length > 0 ? `${activeComplaints.length} Active` : "All Good"}
              </h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className={cn(
                  "font-semibold px-2 py-0.5 rounded-full text-[10px]",
                  activeComplaints.length > 0
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800"
                    : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                )}>
                  {activeComplaints.length > 0 ? "Under Repair" : "No Open Issues"}
                </span>
                <Link href="/student/complaints" className="font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 text-xs">
                  Tickets <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Security Deposit */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs hover:border-teal-500/30 transition-all rounded-2xl">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Security Deposit</span>
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {formatCurrency(depositAmount)}
              </h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className={cn(
                  "font-semibold px-2 py-0.5 rounded-full text-[10px]",
                  depositStatus === 'Paid'
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border border-amber-200 dark:border-amber-500/20"
                )}>
                  {depositStatus}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px]">Refundable</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Split Two-Column Operations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-start">
        {/* Left Column: Recent Fee Invoices & Payment Ledger */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#1a3d52]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Recent Rent &amp; Fees</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Upcoming and recent rent bills</p>
                </div>
              </div>

              <Link href="/student/bills" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {feesData?.fees && feesData.fees.length > 0 ? (
              <div className="space-y-2">
                {feesData.fees.slice(0, 4).map((fee: any) => {
                  const isPaid = fee.status === 'paid';
                  const isPendingVerif = fee.status === 'pending_verification';
                  const isOverdue = fee.status === 'overdue' || (!isPaid && !isPendingVerif && fee.due_date && new Date(fee.due_date).getTime() < Date.now());

                  return (
                    <div
                      key={fee.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {formatFeeTitle(fee.month_year, fee.due_date)}
                          </p>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0",
                            isPaid ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" :
                            isOverdue ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" :
                            isPendingVerif ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300" :
                            "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300"
                          )}>
                            {fee.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {fee.due_date ? `Due: ${new Date(fee.due_date).toLocaleDateString()}` : 'Monthly invoice'}
                          {fee.payment_method && ` • ${fee.payment_method.toUpperCase()}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(fee.amount)}
                        </p>
                        {!isPaid ? (
                          <Link href="/student/bills">
                            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline">
                              Pay Now →
                            </span>
                          </Link>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Receipt available
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-7">
                <Receipt className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Fee Invoices Yet</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Monthly rent invoices issued by the hostel owner will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Maintenance & Support Tickets */}
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#1a3d52]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Maintenance &amp; Complaints</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Service requests and repair tracking</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/student/complaints" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1">
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {complaints && complaints.length > 0 ? (
              <div className="space-y-2">
                {complaints.slice(0, 4).map((c: any) => {
                  const cat = COMPLAINT_CATEGORY_CONFIG[c.category] || COMPLAINT_CATEGORY_CONFIG.other;
                  const Icon = cat.icon;
                  const isResolved = c.status === 'resolved' || c.status === 'closed';

                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={cn("h-7.5 w-7.5 rounded-lg flex items-center justify-center shrink-0 border mt-0.5", cat.bg)}>
                          <Icon className={cn("h-3.5 w-3.5", cat.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate capitalize">
                            {c.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                            {cat.label} • {new Date(c.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                          isResolved ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" :
                          c.status === 'in_progress' ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300" :
                          "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                        )}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-7">
                <ShieldCheck className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Support Issues Reported</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Have a maintenance or electrical issue? Raise a ticket and the warden will resolve it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Hostel Announcements & Notices */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
        <CardContent className="p-4 sm:p-4.5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#1a3d52]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Hostel Notice Board</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Official updates, curfew, mess menu &amp; policies from management</p>
              </div>
            </div>

            <Link href="/student/announcements" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1">
              All Notices <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {notices && notices.length > 0 ? (
            <div className={cn("grid gap-3 sm:gap-3.5", notices.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
              {notices.map((n: any) => {
                const isEmergency = n.notice_type === 'emergency';
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all",
                      notices.length === 1 && "w-full col-span-full",
                      "bg-slate-50 border border-slate-200/80 dark:bg-white/[0.03] dark:border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                        isEmergency ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300" : "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300"
                      )}>
                        {n.notice_type || 'General Notice'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-0.5 capitalize">{n.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{n.body}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No active announcements from hostel management</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkout / Vacate Room Confirmation Modal Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-2xs shrink-0">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Vacate Room {room?.room_number || ''}?
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {hostel?.name ? `${hostel.name}` : 'Hostel Resident Checkout'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 space-y-3.5">
            {/* Allocation summary mini-card */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Space</span>
                <span className="font-bold text-slate-900">
                  Room {room?.room_number || '—'} &bull; {allocation.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Bed'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Check-in Date</span>
                <span className="font-semibold text-slate-700">
                  {allocation.start_date ? new Date(allocation.start_date).toLocaleDateString() : 'Active Residency'}
                </span>
              </div>
            </div>

            {/* What vacating entails checklist */}
            <div className="space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900 text-xs">What happens when you vacate:</p>
              <div className="space-y-1.5 pl-1">
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">1</div>
                  <span>Your active room pass and bed allocation will be released.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">2</div>
                  <span>Please hand over physical room keys to the hostel warden.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">3</div>
                  <span>Refundable deposit settlement will be initiated by the owner.</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border-slate-300 w-full sm:w-auto cursor-pointer"
              onClick={() => setIsCheckoutDialogOpen(false)}
              disabled={checkoutMutation.isPending}
            >
              Cancel &amp; Keep Stay
            </Button>
            <Button
              type="button"
              className="rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white w-full sm:w-auto shadow-sm cursor-pointer transition-all"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? "Vacating Room..." : "Confirm & Vacate Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// RAISE COMPLAINT DIALOG
// ============================================================================
function NewComplaintDialog({
  studentId,
  hostelId,
  onCreated,
}: {
  studentId: string;
  hostelId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "electrical" });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!studentId || !hostelId) {
        throw new Error("Student or hostel details missing.");
      }

      const { error } = await supabase.from("complaints").insert({
        hostel_id: hostelId,
        student_id: studentId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category as any,
        status: "open",
        priority: 2,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Complaint filed successfully. The hostel staff will attend to it shortly.");
      setOpen(false);
      setForm({ title: "", description: "", category: "electrical" });
      onCreated();
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to submit complaint");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 text-xs">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Raise Complaint
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Raise a Maintenance Issue</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <Label className="text-xs font-semibold text-slate-700">Category</Label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="electrical">Electrical (Fan, Light, Sockets)</option>
              <option value="plumbing">Plumbing (Tap, Leak, Washroom)</option>
              <option value="wifi">Wi-Fi &amp; Internet</option>
              <option value="cleaning">Cleaning &amp; Housekeeping</option>
              <option value="furniture">Furniture &amp; Bedding</option>
              <option value="security">Security &amp; Door Locks</option>
              <option value="other">General / Other Issues</option>
            </select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Issue Summary</Label>
            <Input
              required
              placeholder="e.g. Washroom geyser not heating"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 rounded-xl text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Detailed Description</Label>
            <Textarea
              required
              rows={3}
              placeholder="Describe the issue, location in the room, and when it started..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 rounded-xl text-sm"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
            >
              {mutation.isPending ? "Submitting..." : "Submit Complaint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
