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
  MapPin,
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
import { colors } from "@/lib/design-tokens";
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Welcome back, {user?.user_metadata?.full_name || 'Owner'}
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Here's what's happening across your hostels today.
          </p>
        </div>
        <NewHostelDialog onCreated={() => qc.invalidateQueries({ queryKey: ["owner-hostels"] })} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <StatCard
          title="Total Hostels"
          value={totalHostels}
          subtitle="Active properties"
          icon={<Building2 className="h-6 w-6" />}
        />
        <StatCard
          title="Total Rooms"
          value={totalRooms}
          subtitle={`${availableBeds} beds available`}
          icon={<Bed className="h-6 w-6" />}
        />
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle={`${overallOccupancy}% occupancy`}
          icon={<Users className="h-6 w-6" />}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${monthlyRevenue.toLocaleString()}`}
          subtitle="This month"
          icon={<CreditCard className="h-6 w-6" />}
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Your Hostels - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Hostels</h2>
            {hostelOccupancy.length > 4 && (
              <Link href="/owner/hostels">
                <Button variant="outline" size="sm" className="text-teal-600 border-teal-600 hover:bg-teal-50">
                  View all {totalHostels} hostels
                </Button>
              </Link>
            )}
          </div>
          
          {displayHostels.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
              {displayHostels.map((hostel) => (
                <Card key={hostel.id} className="border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{hostel.name}</h3>
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{hostel.city}</span>
                        </div>
                      </div>
                      <StatusBadge status={hostel.status} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Rooms</p>
                        <p className="text-xl font-semibold text-gray-900">{hostel.totalRooms}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Residents</p>
                        <p className="text-xl font-semibold text-gray-900">{hostel.occupiedBeds}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Occupancy</p>
                        <p className="text-xl font-semibold text-gray-900">{hostel.occupancy}%</p>
                      </div>
                    </div>

                    {/* Occupancy Progress Bar */}
                    <div className="mb-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-500 rounded-full"
                          style={{ 
                            width: `${hostel.occupancy}%`,
                            backgroundColor: colors.primary.teal[500]
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600">
                        {hostel.occupiedBeds}/{hostel.totalBeds} beds occupied
                      </p>
                      <Link href={`/owner/hostels/${hostel.id}`}>
                        <Button variant="ghost" size="sm" className="h-9 text-teal-600 hover:text-teal-700 font-medium">
                          View hostel <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState type="hostels" />
          )}
        </div>

        {/* Right Column - Occupancy Overview & Needs Attention */}
        <div className="space-y-6">
          {/* Occupancy Overview */}
          <Card className="border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy Overview</h3>
              
              <div className="text-center mb-6">
                <p className="text-5xl font-bold text-gray-900 mb-2">{overallOccupancy}%</p>
                <p className="text-sm text-gray-600">
                  {totalStudents} occupied · {availableBeds} available
                </p>
              </div>

              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full transition-all duration-500 rounded-full"
                  style={{ 
                    width: `${overallOccupancy}%`,
                    backgroundColor: colors.primary.teal[500]
                  }}
                />
              </div>

              <p className="text-xs text-gray-500 text-center">Across your hostels</p>

              {/* Hostel Breakdown */}
              {hostelOccupancy.length > 1 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">By Hostel</p>
                  <div className="space-y-3">
                    {hostelOccupancy.slice(0, 5).map((hostel) => (
                      <div key={hostel.id} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate pr-2">{hostel.name}</span>
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{hostel.occupancy}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Needs Attention */}
          {(unpaidBillsCount > 0 || (roomRequests && roomRequests.length > 0)) && (
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Needs Attention</h3>
                
                <div className="space-y-3">
                  {roomRequests && roomRequests.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Room requests</p>
                          <p className="text-xs text-gray-600">{roomRequests.length} pending</p>
                        </div>
                      </div>
                      <Link href="/owner/room-requests">
                        <Button variant="ghost" size="sm" className="h-8 text-teal-600">
                          View
                        </Button>
                      </Link>
                    </div>
                  )}

                  {unpaidBillsCount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Unpaid dues</p>
                          <p className="text-xs text-gray-600">₹{pendingDues.toLocaleString()} outstanding</p>
                        </div>
                      </div>
                      <Link href="/owner/payments">
                        <Button variant="ghost" size="sm" className="h-8 text-teal-600">
                          View
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Everything Up to Date */}
          {unpaidBillsCount === 0 && (!roomRequests || roomRequests.length === 0) && totalHostels > 0 && (
            <Card className="border-gray-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Everything is up to date</p>
                    <p className="text-sm text-gray-600">No immediate action required</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Room Requests */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Room Requests</h2>
          <Link href="/owner/room-requests">
            <Button variant="ghost" size="sm" className="text-teal-600">
              View all
            </Button>
          </Link>
        </div>

        {roomRequests && roomRequests.length > 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {roomRequests.map((request: any) => (
                  <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.profiles?.full_name}</p>
                            <p className="text-sm text-gray-600">
                              Requested {request.room_type} room
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <StatusBadge status={request.status} />
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState type="requests" />
        )}
      </section>
    </div>
  );
}

function EmptyState({ type }: { type: 'hostels' | 'requests' }) {
  if (type === 'hostels') {
    return (
      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hostels yet</h3>
          <p className="text-sm text-gray-600">Add your first hostel to start managing rooms and students.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-gray-300 bg-gray-50">
      <CardContent className="p-12 text-center">
        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No recent requests</h3>
        <p className="text-sm text-gray-600">Room requests will appear here when students apply.</p>
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
        <Button className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
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
            <Button type="submit" disabled={mutation.isPending} className="bg-teal-600 hover:bg-teal-700">
              Create hostel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
