'use client';

import { useQuery } from "@tanstack/react-query";
import { Users, Receipt } from "lucide-react";
import { DashboardShell, StatCard } from "@/components/dashboard-shell";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";

export default function ParentDashboard() {
  const { user } = useAuth();

  // Query parent_links and resolve both student profile and student database ID
  const { data: links } = useQuery({
    queryKey: ["parent-links", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data: rows, error } = await supabase.from("parent_links").select("*").eq("parent_id", user!.id);
        if (error) throw error;
        if (!rows || rows.length === 0) return [];

        const authUserIds = rows.map((r) => r.student_id);

        // In profiles, the auth user ID is stored in profiles.user_id
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, full_name")
          .in("user_id", authUserIds);

        const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        const profileIds = (profiles ?? []).map((p) => p.id);

        // Next resolve the public.students primary key (students.id) from profile_id
        let studentIdByProfileId = new Map<string, string>();
        if (profileIds.length > 0) {
          const { data: students } = await supabase
            .from("students")
            .select("id, profile_id")
            .in("profile_id", profileIds);

          if (students) {
            studentIdByProfileId = new Map(students.map((s) => [s.profile_id, s.id]));
          }
        }

        return rows.map((r) => {
          const prof = profileByUserId.get(r.student_id);
          const studentDbId = prof ? studentIdByProfileId.get(prof.id) : null;
          return {
            ...r,
            student_name: prof?.full_name ?? null,
            student_db_id: studentDbId ?? null,
          };
        });
      } catch (err: any) {
        console.warn("[ParentDashboard] parent_links query error:", err?.message);
        return [];
      }
    },
  });

  // Collect the resolved students.id values for the student_fees table query
  const studentDbIds = (links ?? []).map((l: any) => l.student_db_id).filter(Boolean);
  const fallbackAuthStudentIds = (links ?? []).map((l: any) => l.student_id).filter(Boolean);
  const targetStudentIds = studentDbIds.length > 0 ? studentDbIds : fallbackAuthStudentIds;

  // Use authoritative student_fees table
  const { data: fees } = useQuery({
    queryKey: ["parent-fees", targetStudentIds.join(",")],
    enabled: targetStudentIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("student_fees")
          .select("id, student_id, month_year, amount_due, amount, due_date, status, created_at")
          .in("student_id", targetStudentIds)
          .order("due_date", { ascending: false });

        if (error) {
          // Note: Parent RLS policy checks is_parent_of(auth.uid(), student_id).
          // If parent_links.student_id is auth.users.id while student_fees.student_id is students.id,
          // RLS may block records until parent identity is unified in Phase 2.
          console.warn("[ParentDashboard] Note on student_fees query:", error.message);
          return [];
        }
        return data ?? [];
      } catch (err: any) {
        console.warn("[ParentDashboard] Error fetching student_fees:", err?.message);
        return [];
      }
    },
  });

  const pending = (fees ?? []).filter((f: any) => f.status === "pending" || f.status === "overdue").reduce((s: number, f: any) => s + Number(f.amount_due ?? f.amount ?? 0), 0);
  const paid = (fees ?? []).filter((f: any) => f.status === "paid").reduce((s: number, f: any) => s + Number(f.amount_due ?? f.amount ?? 0), 0);

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
        <h2 className="mb-4 flex items-center gap-2 font-semibold font-display"><Receipt className="h-4 w-4 text-primary" /> Recent fees</h2>
        {fees && fees.length > 0 ? (
          <div className="space-y-2">
            {fees.slice(0, 8).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{f.month_year ? `Rent (${f.month_year})` : 'Monthly Rent'}</div>
                  <div className="text-xs text-muted-foreground">Due {new Date(f.due_date).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">₹{Number(f.amount_due ?? f.amount ?? 0).toLocaleString()}</span>
                  {f.status === "paid" ? (
                    <span className="text-[10px] font-semibold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">paid</span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{f.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground py-4 text-center">No fee records available.</p>}
      </section>
    </DashboardShell>
  );
}
