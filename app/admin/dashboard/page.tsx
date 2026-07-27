'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Shield, BarChart3 } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data: hostels } = useQuery({
    queryKey: ["admin-hostels"],
    enabled: profile?.role === "super_admin", // HH role for admin is super_admin
    queryFn: async () => {
      const { data } = await supabase.from("hostels").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: profile?.role === "super_admin",
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role");
      return data ?? [];
    },
  });

  const { data: totalRevenue } = useQuery({
    queryKey: ["admin-revenue"],
    enabled: profile?.role === "super_admin",
    queryFn: async () => {
      const { data } = await supabase.from("bills").select("amount").eq("status", "paid");
      return data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "suspended" }) => {
      const { error } = await supabase.from("hostels").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hostel status updated");
      qc.invalidateQueries({ queryKey: ["admin-hostels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return null;
  
  if (profile?.role !== "super_admin") {
    return (
      <DashboardShell title="Access Denied" subtitle="You don't have administrative permissions.">
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold font-display">Admin Only</h3>
          <p className="mt-2 text-muted-foreground">Please contact the system administrator to request access.</p>
        </div>
      </DashboardShell>
    );
  }

  const pending = hostels?.filter((h) => h.status === "pending").length ?? 0;
  const owners = profiles?.filter((p) => p.role === "hostel_owner").length ?? 0;
  const students = profiles?.filter((p) => p.role === "student").length ?? 0;

  return (
    <DashboardShell title="Platform Control" subtitle="Approve hostels and monitor the platform." badge="Admin">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Hostels" value={hostels?.length ?? 0} />
        <StatCard label="Pending Approval" value={pending} hint="Review required" />
        <StatCard label="Total Owners" value={owners} />
        <StatCard label="Total Students" value={students} />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold font-display">Hostel Management</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hostels?.map((h) => (
                <tr key={h.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{h.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{h.city}</td>
                  <td className="px-4 py-3 capitalize">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      h.status === "approved" ? "bg-green-100 text-green-700" :
                      h.status === "pending" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{h.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {h.status !== "approved" ? (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => mutation.mutate({ id: h.id, status: "approved" })}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                      ) : null}
                      {h.status !== "suspended" ? (
                        <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => mutation.mutate({ id: h.id, status: "suspended" })}>
                          <X className="mr-1 h-3.5 w-3.5" /> Suspend
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {(!hostels || hostels.length === 0) ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No hostels found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold font-display">Global Revenue</h3>
           </div>
           <p className="text-4xl font-bold font-display">₹{totalRevenue?.toLocaleString() || 0}</p>
           <p className="text-sm text-muted-foreground mt-2">Total collected from all paid bills.</p>
        </div>
      </div>
    </DashboardShell>
  );
}
