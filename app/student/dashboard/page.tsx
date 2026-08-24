/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Megaphone, Receipt, MessageSquareWarning, Plus, Building2 } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";

// Error Boundary Component
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DashboardErrorBoundary] Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-900 m-4">
          <h2 className="text-lg font-bold mb-2">Something went wrong.</h2>
          <p className="text-sm mb-4">{this.state.error?.message || "An unexpected error occurred in the dashboard."}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Student Dashboard Container
export default function StudentDashboardPage() {
  return (
    <DashboardErrorBoundary>
      <StudentDashboard />
    </DashboardErrorBoundary>
  );
}

function StudentDashboard() {
  const { profile, loading: isAuthLoading } = useAuth();

  const { data: studentRecord, isLoading: isStudentLoading } = useQuery({
    queryKey: ["student-record", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      console.log('[Dashboard] Fetching student record for profile_id:', profile?.id);
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

  // 1. Ensure studentRecord is loaded and logged
  useEffect(() => {
    console.log('[Dashboard] studentRecord:', studentRecord);
    console.log('[Dashboard] studentRecord?.id:', studentRecord?.id);
  }, [studentRecord]);

  // 2. Simplify the allocation query with direct fetch and subsequent room/hostel fetch
  const fetchAllocation = async () => {
    console.log('[Dashboard] Starting allocation query...');
    console.log('[Dashboard] Using student_id:', studentRecord?.id);
    
    if (!studentRecord?.id) {
      console.log('[Dashboard] ERROR: studentRecord?.id is undefined!');
      return null;
    }

    const { data, error } = await supabase
      .from('room_allocations')
      .select('*')
      .eq('student_id', studentRecord.id)
      .eq('active', true)
      .maybeSingle();

    console.log('[ALLOCATION] Raw query result:', data);
    console.log('[ALLOCATION] Error:', error);

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

  // 3. In render, log what's happening
  useEffect(() => {
    console.log('[Dashboard] allocation:', allocation);
    console.log('[Dashboard] roomData:', roomData);
    console.log('[Dashboard] isAllocLoading:', isAllocLoading);
    console.log('[Dashboard] isRoomLoading:', isRoomLoading);
  }, [allocation, roomData, isAllocLoading, isRoomLoading]);

  // 4. Update conditional rendering
  // Make sure auth and studentRecord load first
  if (isAuthLoading || isStudentLoading) {
    console.log('[Dashboard] Student record or auth is loading...');
    return (
      <DashboardShell title="Loading..." badge="Student">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardShell>
    );
  }

  const isLoading = isAllocLoading || (!!allocation && isRoomLoading);

  if (isLoading) {
    console.log('[Dashboard] Allocation or room details are loading...');
    return (
      <DashboardShell title="Loading..." badge="Student">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardShell>
    );
  }

  console.log('[Dashboard] Checking allocation...');
  if (!allocation) {
    console.log('[Dashboard] No allocation found, showing request room option');
    return (
      <DashboardShell title="Hi there 👋" subtitle="Welcome to your dashboard." badge="Student">
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold font-display">No Hostel Assigned</h3>
          <p className="mt-2 text-muted-foreground">You haven&apos;t been assigned to any room yet.</p>
          <Link href="/student/room-request" className="mt-4 inline-block">
            <Button className="rounded-full shadow-md">Request a Room</Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  console.log('[Dashboard] Allocation found! Rendering card:', allocation);
  return (
    <AllocationCard
      allocation={allocation}
      hostel={roomData?.hostels}
      room={roomData}
    />
  );
}

// AllocationCard Component rendering the details when data exists
interface AllocationCardProps {
  allocation: any;
  hostel: any;
  room: any;
}

function AllocationCard({ allocation, hostel, room }: AllocationCardProps) {
  const { profile } = useAuth();
  // room_requests.student_id and room_allocations.student_id are FKs to
  // public.students.id -- this remains the correct identifier for those uses.
  const studentId = allocation.student_id;
  // complaints.student_id is a FK to auth.users.id (confirmed via schema), a
  // different identifier space than public.students.id. Use the signed-in
  // user's id here, matching the pattern already used in
  // app/owner/students/[id]/page.tsx (profiles.user_id).
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

  return (
    <DashboardShell title="Hi there 👋" subtitle="Your hostel at a glance." badge="Student">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current Hostel" value={hostel?.name ?? "—"} hint={hostel?.city ?? ""} />
        <StatCard label="Current Room" value={`Room ${room?.room_number ?? "—"}`} hint={room?.room_type || room?.type || "double"} />
        <StatCard label="Monthly Rent" value={`₹${Number(room?.rent ?? 0).toLocaleString()}`} />
        <StatCard label="Booking Type" value={approvedRequest?.booking_type === 'entire_room' ? 'Entire Room' : 'Entire Shared Room'} />
      </div>

      {/* Your Allocated Room Card */}
      <div className="mt-6">
        <div className="rounded-3xl border border-border bg-card shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
          {/* Header Banner: ✅ YOUR ACTIVE ALLOCATION */}
          <div className="bg-emerald-500/10 dark:bg-emerald-500/20 border-b border-border/60 px-6 py-4 flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-400 text-lg">✅</span>
            <h4 className="font-bold text-sm tracking-wider uppercase text-emerald-800 dark:text-emerald-300 font-display">
              Your Active Allocation
            </h4>
          </div>

          {/* Details Body */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            {/* Group 1: Hostel Details */}
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1 font-semibold">🏢 Hostel Information</h5>
              <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border">
                <div>
                  <span className="text-xs text-muted-foreground">Hostel</span>
                  <p className="font-bold text-foreground text-base mt-0.5">{hostel?.name || 'Blue Sky'}</p>
                </div>
                <div className="border-t border-border/40 pt-2.5">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <p className="font-medium text-foreground text-xs mt-0.5 leading-relaxed">
                    {hostel?.address || 'Keshavpura Sector 7'}, {hostel?.area || 'Keshavpura'}, {hostel?.city || 'Kota'}, {hostel?.state || 'Rajasthan'} - {hostel?.pincode || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Group 2: Room Details */}
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1 font-semibold">🛏️ Room Information</h5>
              <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-muted-foreground">Room</span>
                    <p className="font-bold text-foreground text-base mt-0.5">Room {room?.room_number}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-1 rounded-lg">
                    {approvedRequest?.booking_type === 'entire_room' ? 'Entire Room' : 'Entire Shared Room'}
                  </span>
                </div>
                <div className="border-t border-border/40 pt-2.5">
                  <span className="text-xs text-muted-foreground">Capacity</span>
                  <p className="font-semibold text-foreground text-xs mt-0.5">
                    {room?.capacity ?? 2} beds | Occupied: {room?.occupied_beds ?? room?.occupancy ?? 1}
                  </p>
                </div>
                <div className="border-t border-border/40 pt-2.5">
                  <span className="text-xs text-muted-foreground">Monthly Rent</span>
                  <p className="font-bold text-primary text-base mt-0.5">₹{Number(room?.rent ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Group 3: Logistics & Financials */}
            <div className="space-y-4 md:col-span-2 lg:col-span-1">
              <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1 font-semibold">📋 Logistics & Financials</h5>
              <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-xs text-muted-foreground">Allocated Date</span>
                  <span className="font-semibold text-foreground">
                    {allocation.start_date ? new Date(allocation.start_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-border/40 pt-2">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                    ✅ ACTIVE
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-border/40 pt-2">
                  <span className="text-xs text-muted-foreground">Security Deposit</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    depositStatus === 'Paid' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' 
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {depositStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-border/40 pt-2">
                  <span className="text-xs text-muted-foreground">Monthly Fees</span>
                  <span className="font-semibold text-foreground">
                    ₹{Number(room?.rent ?? 0).toLocaleString()}{' '}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      monthlyRentStatus === 'Paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {monthlyRentStatus}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="border-t bg-muted/10 px-6 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href={`/hostel/${allocation.hostel_id}`}>
                <Button variant="outline" className="w-full rounded-xl">View Hostel</Button>
              </Link>
              <Link href="/student/documents">
                <Button variant="outline" className="w-full rounded-xl">Download Agreement</Button>
              </Link>
              <Link href="/student/bills">
                <Button variant="outline" className="w-full rounded-xl bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-semibold">Pay Fees</Button>
              </Link>
              {confirmingCheckout ? (
                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 border border-red-200/50 p-1 rounded-xl w-full justify-between">
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold pl-2">Checkout?</span>
                  <div className="flex gap-1">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="rounded-lg font-semibold text-[10px] h-7 px-2"
                      onClick={() => checkoutMutation.mutate()}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? '...' : 'Yes'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="rounded-lg text-[10px] h-7 px-2"
                      onClick={() => setConfirmingCheckout(false)}
                    >
                      No
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setConfirmingCheckout(true)}
                >
                  Check Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="mt-6">
        <h3 className="font-semibold text-base mb-3 font-display">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/student/bills" className="block">
            <Button variant="outline" className="w-full h-16 justify-start gap-3 rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted/50 p-4">
              <Receipt className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left leading-tight">
                <p className="font-semibold text-sm">Pay Bill</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">View and settle dues</p>
              </div>
            </Button>
          </Link>
          
          <Link href="/student/dashboard#complaints" className="block">
            <Button variant="outline" className="w-full h-16 justify-start gap-3 rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted/50 p-4">
              <MessageSquareWarning className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left leading-tight">
                <p className="font-semibold text-sm">Raise Complaint</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Report hostel issues</p>
              </div>
            </Button>
          </Link>

          <Link href="/student/documents" className="block">
            <Button variant="outline" className="w-full h-16 justify-start gap-3 rounded-xl border border-border bg-card text-foreground shadow-sm hover:bg-muted/50 p-4">
              <Megaphone className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left leading-tight">
                <p className="font-semibold text-sm">Download Documents</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Agreement, forms & slips</p>
              </div>
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold font-display"><Receipt className="h-4 w-4 text-primary" /> Bills</h2>
          {bills && bills.length > 0 ? (
            <div className="space-y-2">
              {bills.slice(0, 6).map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                  <div>
                    <div className="font-medium capitalize">{b.bill_type}</div>
                    <div className="text-xs text-muted-foreground">Due {new Date(b.due_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">₹{Number(b.amount).toLocaleString()}</div>
                    <span className={`text-[10px] font-semibold uppercase ${b.status === "paid" ? "text-green-600" : b.status === "overdue" ? "text-red-600" : "text-amber-600"}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No bills yet.</p>}
        </section>

        <section id="complaints" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold font-display"><MessageSquareWarning className="h-4 w-4 text-primary" /> Complaints</h2>
            <NewComplaintDialog studentId={authUserId ?? ''} hostelId={allocation.hostel_id} onCreated={() => qc.invalidateQueries({ queryKey: ["student-complaints"] })} />
          </div>
          {complaints && complaints.length > 0 ? (
            <div className="space-y-2">
              {complaints.slice(0, 6).map((c) => (
                <div key={c.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">{c.status.replace("_", " ")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{c.category}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No complaints yet.</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold font-display"><Megaphone className="h-4 w-4 text-primary" /> Announcements</h2>
          {notices && notices.length > 0 ? (
            <div className="space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="rounded-xl bg-muted/40 p-3">
                  <div className="font-medium">{n.title}</div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No announcements right now.</p>}
        </section>
      </div>
    </DashboardShell>
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
        <Button size="sm" variant="outline" className="rounded-full shadow-sm"><Plus className="mr-1 h-3 w-3" /> New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Raise a complaint</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Category</Label>
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["electrical","plumbing","wifi","cleaning","furniture","security","other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Describe the issue</Label><Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={mutation.isPending}>Submit</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
