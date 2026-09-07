'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Plus, 
  Building2, 
  Users, 
  CreditCard, 
  ArrowRight,
  Bed,
  Clock,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { StatCard } from "@/components/owner/stat-card";
import { StatusBadge } from "@/components/owner/status-badge";
import { IconWrapper } from "@/components/owner/icon-wrapper";
import { OwnerHostelCard } from "@/components/owner/owner-hostel-card";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hostels } = useQuery({
    queryKey: ["owner-hostels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("hostels").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["owner-rooms", user?.id],
    enabled: !!hostels?.length,
    queryFn: async () => {
      const ids = hostels!.map((h) => h.id);
      const { data } = await supabase.from("rooms").select("*").in("hostel_id", ids);
      return data ?? [];
    },
  });

  const { data: allocations } = useQuery({
    queryKey: ["owner-allocations", user?.id],
    enabled: !!hostels?.length,
    queryFn: async () => {
      const ids = hostels!.map((h) => h.id);
      const { data } = await supabase
        .from("room_allocations")
        .select("room_id, hostel_id, student_id, student_name, start_date")
        .in("hostel_id", ids)
        .eq("active", true);
      return data ?? [];
    },
  });

  const { data: bills } = useQuery({
    queryKey: ["owner-bills", user?.id],
    enabled: !!hostels?.length,
    queryFn: async () => {
      const ids = hostels!.map((h) => h.id);
      const { data } = await supabase.from("bills").select("*").in("hostel_id", ids);
      return data ?? [];
    },
  });

  const { data: roomRequests } = useQuery({
    queryKey: ["owner-room-requests", user?.id],
    enabled: !!hostels?.length,
    queryFn: async () => {
      const ids = hostels!.map((h) => h.id);
      const { data } = await supabase
        .from("room_requests")
        .select(`
          *,
          profiles!inner (
            full_name,
            email
          )
        `)
        .in("hostel_id", ids)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Calculate real metrics
  const totalHostels = hostels?.length ?? 0;
  const totalRooms = rooms?.length ?? 0;
  const totalStudents = allocations?.length ?? 0;
  const totalBeds = rooms?.reduce((s, r) => s + (r.capacity ?? 0), 0) ?? 0;
  const availableBeds = totalBeds - totalStudents;
  const pendingDues = bills?.filter((b) => b.status === "pending").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const unpaidBillsCount = bills?.filter((b) => b.status === "pending").length ?? 0;
  const monthlyRevenue = bills?.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const overallOccupancy = totalBeds > 0 ? Math.round((totalStudents / totalBeds) * 100) : 0;

  // Calculate occupancy per hostel
  const hostelOccupancy = hostels?.map(hostel => {
    const hostelRooms = rooms?.filter(r => r.hostel_id === hostel.id) ?? [];
    const hostelAllocations = allocations?.filter(a => a.hostel_id === hostel.id) ?? [];
    const hostelTotalBeds = hostelRooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
    const hostelOccupiedBeds = hostelAllocations.length;
    const hostelOccupancy = hostelTotalBeds > 0 ? Math.round((hostelOccupiedBeds / hostelTotalBeds) * 100) : 0;
    
    return {
      ...hostel,
      totalRooms: hostelRooms.length,
      totalBeds: hostelTotalBeds,
      occupiedBeds: hostelOccupiedBeds,
      occupancy: hostelOccupancy,
    };
  }) ?? [];

  // Limit dashboard to 4 hostels max for better composition
  const displayHostels = hostelOccupancy.slice(0, 4);

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-[1800px] mx-auto">
      {/* Welcome + Add Hostel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.user_metadata?.full_name || 'Owner'}
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-600">
            Here's what's happening across your hostels today.
          </p>
        </div>
        <NewHostelDialog onCreated={() => qc.invalidateQueries({ queryKey: ["owner-hostels"] })} />
      </div>

      {/* Summary Stats - 5 Cards matching reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 mb-8">
        <StatCard
          title="Total Hostels"
          value={totalHostels}
          subtitle="Active properties"
          icon={<Building2 className="h-5 w-5" />}
          color="teal"
          trend={{ value: "↑ Active & operational", isPositive: true }}
        />
        <StatCard
          title="Total Rooms"
          value={totalRooms}
          subtitle={`${availableBeds} beds available`}
          icon={<Bed className="h-5 w-5" />}
          color="blue"
          trend={{ value: `${totalBeds} total beds`, isPositive: true }}
        />
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle={`${overallOccupancy}% occupancy`}
          icon={<Users className="h-5 w-5" />}
          color="purple"
          trend={{ value: `${totalStudents} currently residing`, isPositive: true }}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${monthlyRevenue.toLocaleString()}`}
          subtitle="Collected this month"
          icon={<CreditCard className="h-5 w-5" />}
          color="emerald"
          trend={{ value: "Paid collections", isPositive: true }}
        />
        <StatCard
          title="Pending Dues"
          value={`₹${pendingDues.toLocaleString()}`}
          subtitle={`From ${unpaidBillsCount} student bills`}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
          trend={{ value: unpaidBillsCount > 0 ? "Requires follow-up" : "All cleared", isPositive: unpaidBillsCount === 0 }}
        />
      </div>

      {/* Your Hostels Section - Prominent full-width grid matching reference */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Your Hostels</h2>
            <p className="text-xs md:text-sm text-slate-500">Manage your hostel properties, location details, and operations.</p>
          </div>
          {hostelOccupancy.length > 4 && (
            <Link href="/owner/hostels">
              <Button variant="outline" size="sm" className="text-teal-700 border-teal-200 bg-white hover:bg-teal-50">
                View all {totalHostels} hostels
              </Button>
            </Link>
          )}
        </div>
        
        {displayHostels.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {displayHostels.map((hostel) => (
              <OwnerHostelCard key={hostel.id} hostel={hostel} variant="dashboard" />
            ))}
          </div>
        ) : (
          <EmptyState type="hostels" />
        )}
      </section>

      {/* Bottom Operational Cards Row - 3 Balanced Cards matching reference (Recent Activity, Quick Actions, Need Attention) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* 1. Recent Activity */}
        <Card className="border border-sky-100/90 bg-white rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 flex flex-col justify-between">
          <CardContent className="p-5 md:p-6 flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <IconWrapper color="blue" size="sm">
                    <Clock className="h-4 w-4" />
                  </IconWrapper>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-xs text-slate-500">Latest updates across your hostels</p>
                  </div>
                </div>
                <Link href="/owner/requests" className="inline-flex items-center gap-1 shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700 active:scale-95 transition-all cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {roomRequests && roomRequests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {roomRequests.slice(0, 3).map((req: any) => (
                    <Link key={req.id} href="/owner/requests" className="py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-50/90 active:bg-slate-100 transition-colors flex items-center justify-between gap-2 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 block">
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IconWrapper color="violet" size="sm" className="shrink-0">
                            <Users className="h-3.5 w-3.5" />
                          </IconWrapper>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 group-hover:text-teal-700 transition-colors truncate">{req.profiles?.full_name || 'Student'}</p>
                            <p className="text-xs text-slate-500 truncate">Requested {req.room_type || 'room'}</p>
                          </div>
                        </div>
                        <StatusBadge status={req.status} className="text-[11px] shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-left pl-2">No recent activity</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3">
              <Link href="/owner/requests" className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline active:scale-95 transition-all block text-center cursor-pointer rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                Manage room applications →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 2. Quick Actions */}
        <Card className="border border-sky-100/90 bg-white rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 flex flex-col justify-between">
          <CardContent className="p-5 md:p-6 flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <IconWrapper color="teal" size="sm">
                  <Plus className="h-4 w-4" />
                </IconWrapper>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
                  <p className="text-xs text-slate-500">Common tasks and shortcuts</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/owner/hostels/new" className="p-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] transition-all flex items-center justify-between group cursor-pointer shadow-2xs hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-white shrink-0" />
                    <span className="text-xs font-semibold text-white whitespace-nowrap">Add Hostel</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-white group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                <Link href="/owner/rooms" className="p-3 rounded-xl border border-blue-200/80 bg-blue-50/60 hover:bg-blue-100/60 active:scale-[0.98] transition-all flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">Add Room</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                <Link href="/owner/requests" className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/60 hover:bg-amber-100/60 active:scale-[0.98] transition-all flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">View Requests</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                <Link href="/owner/students" className="p-3 rounded-xl border border-purple-200/80 bg-purple-50/60 hover:bg-purple-100/60 active:scale-[0.98] transition-all flex items-center justify-between group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">View Students</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-purple-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3">
              <Link href="/owner/electricity/billing" className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline active:scale-95 transition-all block text-center cursor-pointer rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                Open electricity & billing hub →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 3. Need Attention */}
        <Card className="border border-sky-100/90 bg-white rounded-2xl shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 flex flex-col justify-between">
          <CardContent className="p-5 md:p-6 flex flex-col flex-1 justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <IconWrapper color="amber" size="sm">
                  <Clock className="h-4 w-4" />
                </IconWrapper>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Need Attention</h3>
                  <p className="text-xs text-slate-500">Items that need your attention</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {roomRequests && roomRequests.length > 0 ? (
                  <Link href="/owner/requests" className="flex items-center justify-between p-3 rounded-xl border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100/70 active:scale-[0.98] transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{roomRequests.length} pending room requests</p>
                        <p className="text-xs text-amber-700 font-medium">Requires your approval</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                ) : null}

                {unpaidBillsCount > 0 ? (
                  <Link href="/owner/payments" className="flex items-center justify-between p-3 rounded-xl border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100/70 active:scale-[0.98] transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <CreditCard className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{unpaidBillsCount} overdue payments</p>
                        <p className="text-xs text-rose-700 font-medium">Total amount ₹{pendingDues.toLocaleString()}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-rose-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                ) : null}

                {unpaidBillsCount === 0 && (!roomRequests || roomRequests.length === 0) && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl cursor-default">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">All systems up to date</p>
                      <p className="text-xs text-slate-600">No pending requests or overdue dues.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3">
              <Link href="/owner/complaints" className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline active:scale-95 transition-all block text-center cursor-pointer rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                Review complaints & feedback →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: 'hostels' | 'requests' }) {
  if (type === 'hostels') {
    return (
      <Card className="border-dashed border-sky-200 bg-white/95 rounded-2xl shadow-xs cursor-default relative z-10">
        <CardContent className="p-12 text-center">
          <IconWrapper color="teal" size="lg" className="mx-auto mb-3">
            <Building2 className="h-5 w-5" />
          </IconWrapper>
          <h3 className="text-base font-bold text-slate-900 mb-1">No hostels yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">Add your first hostel to start managing rooms and students.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-sky-200 bg-white/95 rounded-2xl shadow-xs cursor-default relative z-10">
      <CardContent className="p-12 text-center">
        <IconWrapper color="blue" size="lg" className="mx-auto mb-3">
          <Clock className="h-5 w-5" />
        </IconWrapper>
        <h3 className="text-base font-bold text-slate-900 mb-1">No recent requests</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">Room requests will appear here when students apply.</p>
      </CardContent>
    </Card>
  );
}

function NewHostelDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", area: "", description: "", starting_price: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hostels").insert({
        owner_id: user!.id,
        name: form.name,
        city: form.city,
        area: form.area || null,
        description: form.description || null,
        starting_price: form.starting_price ? Number(form.starting_price) : 0,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hostel created — pending admin approval.");
      setOpen(false);
      setForm({ name: "", city: "", area: "", description: "", starting_price: "" });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
          <Plus className="mr-2 h-4 w-4" /> Add Hostel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new hostel</DialogTitle>
          <DialogDescription>Enter the details for the new hostel you want to add.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div>
            <Label>Name</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>City</Label>
              <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Area</Label>
              <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Starting price (₹/month)</Label>
            <Input type="number" value={form.starting_price} onChange={(e) => setForm({ ...form, starting_price: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-semibold rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
              Create hostel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
