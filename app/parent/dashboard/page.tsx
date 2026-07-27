'use client';

import { useQuery } from "@tanstack/react-query";
import { Wallet, Users, Receipt } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";

export default function ParentDashboard() {
  const { user } = useAuth();

  // In Phase D we will create parent_links. For now, this is a placeholder
  // that will return an empty array or handle error gracefully.
  const { data: links } = useQuery({
    queryKey: ["parent-links", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data: rows, error } = await supabase.from("parent_links").select("*").eq("parent_id", user!.id);
        if (error) throw error;
        if (!rows || rows.length === 0) return [];
        const ids = rows.map((r) => r.student_id);
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
        return rows.map((r) => ({ ...r, student_name: nameById.get(r.student_id) ?? null }));
      } catch {
        console.log("parent_links table might not exist yet");
        return [];
      }
    },
  });

  const studentIds = links?.map((l) => l.student_id) ?? [];

  const { data: bills } = useQuery({
    queryKey: ["parent-bills", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("bills").select("*").in("student_id", studentIds).order("due_date", { ascending: false });
      return data ?? [];
    },
  });

  const pending = bills?.filter((b) => b.status === "pending").reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const paid = bills?.filter((b) => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0) ?? 0;

  return (
    <DashboardShell title="Family overview" subtitle="Keep track of your child's hostel and dues." badge="Parent">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Students linked" value={links?.length ?? 0} hint="Family members" />
        <StatCard label="Pending dues" value={`₹${pending.toLocaleString()}`} hint="Across all kids" />
        <StatCard label="Paid this year" value={`₹${paid.toLocaleString()}`} />
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold font-display"><Users className="h-4 w-4 text-primary" /> Linked students</h2>
        {links && links.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {links.map((l: { id: string; student_name: string | null; student_id: string; created_at: string }) => (
              <li key={l.id} className="flex items-center justify-between py-3">
                <span className="font-medium">{l.student_name ?? l.student_id}</span>
                <span className="text-xs text-muted-foreground">Linked {new Date(l.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No students linked yet. Ask your child for their account email to connect.</p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold font-display"><Receipt className="h-4 w-4 text-primary" /> Recent bills</h2>
        {bills && bills.length > 0 ? (
          <div className="space-y-2">
            {bills.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{b.bill_type}</div>
                  <div className="text-xs text-muted-foreground">Due {new Date(b.due_date).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">₹{Number(b.amount).toLocaleString()}</span>
                  {b.status === "pending" ? (
                    <button className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity">
                      <Wallet className="mr-1 inline h-3 w-3" /> Pay
                    </button>
                  ) : <span className="text-[10px] font-semibold uppercase text-green-600">paid</span>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No bills available.</p>}
      </section>
    </DashboardShell>
  );
}
