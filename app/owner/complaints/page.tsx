'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Complaint } from '@/types/database';
import { MessageSquare, Clock, Search, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardShell } from '@/components/dashboard-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORY_LABEL: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  wifi: 'WiFi',
  cleaning: 'Cleaning',
  furniture: 'Furniture',
  security: 'Security',
  other: 'Other'
};

interface ExtendedComplaint extends Complaint {
  hostels: {
    name: string;
  } | null;
  student_full_name: string | null;
}

export default function OwnerComplaintsPage() {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<ExtendedComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');

  // complaints.student_id is a foreign key to auth.users.id (confirmed via
  // schema), not public.students.id -- there is no direct FK from
  // complaints to students, so a `students!inner(...)` embed cannot resolve.
  // Fetch complaints scoped to this owner's hostels first, then resolve each
  // complaint's student name via profiles.user_id (the same pattern already
  // used correctly in app/owner/students/[id]/page.tsx).
  const fetchComplaints = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          hostels!inner (name)
        `)
        .eq('hostels.owner_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data as unknown as (Complaint & { hostels: { name: string } | null })[]) || [];

      const studentUserIds = Array.from(new Set(rows.map((c) => c.student_id).filter(Boolean)));
      let namesByUserId = new Map<string, string>();
      if (studentUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', studentUserIds);

        if (profilesError) throw profilesError;

        namesByUserId = new Map((profilesData ?? []).map((p) => [p.user_id, p.full_name]));
      }

      const withNames: ExtendedComplaint[] = rows.map((c) => ({
        ...c,
        student_full_name: namesByUserId.get(c.student_id) || null
      }));

      setComplaints(withNames);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success('Status updated!');
      fetchComplaints();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-rose-700 bg-rose-50 border border-rose-200/80 shadow-2xs font-semibold text-[11px]';
      case 2: return 'text-amber-700 bg-amber-50 border border-amber-200/80 shadow-2xs font-semibold text-[11px]';
      default: return 'text-blue-700 bg-blue-50 border border-blue-200/80 shadow-2xs font-semibold text-[11px]';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200/80 shadow-2xs text-[11px] font-semibold"><CheckCircle2 className="mr-1 h-3 w-3" /> Resolved</Badge>;
      case 'in_progress': return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200/80 shadow-2xs text-[11px] font-semibold"><Clock className="mr-1 h-3 w-3" /> In Progress</Badge>;
      case 'open': return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200/80 shadow-2xs text-[11px] font-semibold"><Circle className="mr-1 h-3 w-3" /> Open</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs text-[11px] font-semibold capitalize">{status}</Badge>;
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const matchesSearch = 
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.student_full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusTab === 'all' || c.status === statusTab;
      
      return matchesSearch && matchesStatus;
    });
  }, [complaints, searchQuery, statusTab]);

  return (
    <DashboardShell 
      title="Complaints" 
      subtitle="Track and resolve issues reported by students" 
      badge="Maintenance"
    >
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="all" className="w-full sm:w-auto" onValueChange={setStatusTab}>
            <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold data-[state=active]:bg-teal-600 data-[state=active]:text-white">All</TabsTrigger>
              <TabsTrigger value="open" className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white">Open</TabsTrigger>
              <TabsTrigger value="in_progress" className="rounded-lg text-xs font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white">In Progress</TabsTrigger>
              <TabsTrigger value="resolved" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search complaints..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 border-slate-200 bg-white rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Clock className="h-10 w-10 text-teal-600 animate-spin" />
            <p className="text-slate-500 font-medium text-sm">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-slate-200 bg-white">
            <div className="rounded-full bg-slate-100 p-4">
              <MessageSquare size={32} className="text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-slate-900">No complaints found</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                {searchQuery || statusTab !== 'all' 
                  ? "Try adjusting your filters or search terms." 
                  : "Everything looks good! No issues have been reported yet."}
              </p>
            </div>
            {(searchQuery || statusTab !== 'all') && (
              <Button variant="outline" onClick={() => {setSearchQuery(''); setStatusTab('all');}} className="border-slate-200 text-xs">
                Clear all filters
              </Button>
            )}
          </div>
        ) : filteredComplaints.map((complaint) => (
          <div key={complaint.id} className="group rounded-xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-md transition-all duration-200">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                    {complaint.priority === 1 ? 'HIGH' : complaint.priority === 2 ? 'MEDIUM' : 'LOW'} PRIORITY
                  </Badge>
                  <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-[11px] font-semibold">
                    {CATEGORY_LABEL[complaint.category] || complaint.category}
                  </Badge>
                  {getStatusBadge(complaint.status)}
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{complaint.title}</h3>
                <p className="text-slate-600 text-xs mb-4 line-clamp-2 md:line-clamp-none leading-relaxed">
                  {complaint.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center text-[10px] text-violet-700 font-bold">
                      {complaint.student_full_name?.[0] || '?'}
                    </div>
                    <span>{complaint.student_full_name || 'Unknown student'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-400" />
                    <span>{new Date(complaint.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-blue-500" />
                    <span className="text-slate-700 font-semibold">{complaint.hostels?.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                <span className="text-xs text-slate-400 font-semibold hidden md:inline">Update Status:</span>
                <select 
                  className="rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
                  defaultValue={complaint.status}
                  onChange={(e) => updateStatus(complaint.id, e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}