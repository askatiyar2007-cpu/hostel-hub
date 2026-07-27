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

interface ExtendedComplaint extends Complaint {
  students: {
    profiles: {
      full_name: string;
    } | null;
  } | null;
  hostels: {
    name: string;
  } | null;
}

export default function OwnerComplaintsPage() {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<ExtendedComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');

  const fetchComplaints = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          students!inner (
            profiles (full_name)
          ),
          hostels!inner (name)
        `)
        .eq('hostels.owner_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints((data as ExtendedComplaint[]) || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

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
      case 1: return 'text-red-600 bg-red-100 border-red-200';
      case 2: return 'text-amber-600 bg-amber-100 border-amber-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none"><CheckCircle2 className="mr-1 h-3 w-3" /> Resolved</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none"><Clock className="mr-1 h-3 w-3" /> In Progress</Badge>;
      case 'open': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"><Circle className="mr-1 h-3 w-3" /> Open</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const matchesSearch = 
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.students?.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
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
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Search complaints..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Clock className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border border-dashed border-border bg-muted/30">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare size={32} className="text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">No complaints found</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {searchQuery || statusTab !== 'all' 
                  ? "Try adjusting your filters or search terms." 
                  : "Everything looks good! No issues have been reported yet."}
              </p>
            </div>
            {(searchQuery || statusTab !== 'all') && (
              <Button variant="outline" onClick={() => {setSearchQuery(''); setStatusTab('all');}}>
                Clear all filters
              </Button>
            )}
          </div>
        ) : filteredComplaints.map((complaint) => (
          <div key={complaint.id} className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                    {complaint.priority === 1 ? 'HIGH' : complaint.priority === 2 ? 'MEDIUM' : 'LOW'} PRIORITY
                  </Badge>
                  {getStatusBadge(complaint.status)}
                </div>
                
                <h3 className="text-xl font-semibold font-display mb-2">{complaint.title}</h3>
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2 md:line-clamp-none">
                  {complaint.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                      {complaint.students?.profiles?.full_name?.[0]}
                    </div>
                    <span>{complaint.students?.profiles?.full_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{new Date(complaint.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={14} />
                    <span>{complaint.hostels?.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                <span className="text-xs text-muted-foreground font-medium hidden md:inline">Update Status:</span>
                <select 
                  className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
