'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Plus, 
  Building2, 
  Users, 
  CreditCard, 
  Activity
} from "lucide-react";
import { DashboardShell, StatCard, AnalyticsCard } from "@/components/dashboard-shell";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";

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
        .select("room_id")
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

  // Calculate real occupancy from active allocations
  const occupiedBeds = allocations?.length ?? 0;
  const totalBeds = rooms?.reduce((s, r) => s + (r.capacity ?? 0), 0) ?? 0;
  const pending = bills?.filter((b) => b.status === "pending").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const collected = bills?.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;

  // Mock data for analytics
  const revenueData = [
    { name: 'Jan', amount: 45000 },
    { name: 'Feb', amount: 52000 },
    { name: 'Mar', amount: 48000 },
    { name: 'Apr', amount: 61000 },
    { name: 'May', amount: 55000 },
    { name: 'Jun', amount: collected > 0 ? collected : 65000 },
  ];

  const occupancyData = [
    { name: 'Occupied', value: occupiedBeds || 1 },
    { name: 'Vacant', value: (totalBeds - occupiedBeds) || 1 },
  ];

  const COLORS = ['#f97316', '#e2e8f0'];

  return (
    <DashboardShell title="Welcome back" subtitle="Here's how your hostels are doing today." badge="Owner">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total Hostels" 
          value={hostels?.length ?? 0} 
          hint="Listed properties" 
          icon={Building2}
          trend={{ value: "+2", label: "this month", positive: true }}
        />
        <StatCard 
          label="Total Residents" 
          value={occupiedBeds} 
          hint={`${totalBeds - occupiedBeds} beds available`} 
          icon={Users}
          trend={{ value: "+12%", label: "growth", positive: true }}
        />
        <StatCard 
          label="Revenue" 
          value={`₹${collected.toLocaleString()}`} 
          hint="Collected this month" 
          icon={CreditCard}
          trend={{ value: "+8%", label: "vs last month", positive: true }}
        />
        <StatCard 
          label="Pending dues" 
          value={`₹${pending.toLocaleString()}`} 
          hint="Awaiting payment" 
          icon={Activity}
          trend={{ value: "-5%", label: "improvement", positive: true }}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <AnalyticsCard 
          title="Revenue Overview" 
          description="Monthly collection trends for all hostels."
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsCard>

        <AnalyticsCard 
          title="Occupancy" 
          description="Current bed availability."
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={occupancyData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {occupancyData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#f97316]" />
              <span className="text-xs text-muted-foreground">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#e2e8f0]" />
              <span className="text-xs text-muted-foreground">Vacant</span>
            </div>
          </div>
        </AnalyticsCard>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold font-display">Your hostels</h2>
          <NewHostelDialog onCreated={() => qc.invalidateQueries({ queryKey: ["owner-hostels"] })} />
        </div>
        {hostels && hostels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hostels.map((h) => (
              <div key={h.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold font-display">{h.name}</h3>
                    <p className="text-xs text-muted-foreground">{h.city}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    h.status === "approved" ? "bg-green-100 text-green-700" :
                    h.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{h.status}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{h.description || "No description yet."}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>From ₹{Number(h.starting_price ?? 0).toLocaleString()}</span>
                  <AddRoomDialog hostelId={h.id} onCreated={() => qc.invalidateQueries({ queryKey: ["owner-rooms"] })} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold font-display">Recent bills</h2>
        {bills && bills.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Amount</th><th className="px-4 py-3 text-left">Due</th><th className="px-4 py-3 text-left">Status</th></tr>
              </thead>
              <tbody>
                {bills.slice(0, 8).map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3 capitalize">{b.bill_type}</td>
                    <td className="px-4 py-3">₹{Number(b.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">{new Date(b.due_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 capitalize">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No bills yet.</p>
        )}
      </section>
    </DashboardShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
      <Building2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <h3 className="mt-3 font-semibold">No hostels yet</h3>
      <p className="text-sm text-muted-foreground">Add your first hostel to start managing rooms, bills and residents.</p>
    </div>
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
        <Button className="rounded-full shadow-md">
          <Plus className="mr-1 h-4 w-4" /> New hostel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new hostel</DialogTitle>
          <DialogDescription>Enter the details for the new hostel you want to add.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>City</Label><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Area</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Starting price (₹/month)</Label><Input type="number" value={form.starting_price} onChange={(e) => setForm({ ...form, starting_price: e.target.value })} /></div>
          <DialogFooter><Button type="submit" disabled={mutation.isPending}>Create hostel</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRoomDialog({ hostelId, onCreated }: { hostelId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ room_number: "", room_type: "single", capacity: "1", rent: "" });
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").insert({
        hostel_id: hostelId,
        room_number: form.room_number,
        room_type: form.room_type as "single" | "double" | "triple" | "quad",
        capacity: Number(form.capacity),
        rent: Number(form.rent),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Room added"); setOpen(false); onCreated(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs"><Plus className="mr-1 h-3 w-3" /> Room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add room</DialogTitle>
          <DialogDescription>Enter the details for the new room you want to add to this hostel.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Room number</Label><Input required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
                <option value="single">Single</option><option value="double">Double</option>
                <option value="triple">Triple</option><option value="quad">Quad</option>
              </select>
            </div>
            <div><Label>Capacity</Label><Input type="number" min={1} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            <div><Label>Rent (₹)</Label><Input type="number" required value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={mutation.isPending}>Add room</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}