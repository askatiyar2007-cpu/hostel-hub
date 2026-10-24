'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Complaint } from '@/types/database';
import { AlertCircle, Plus, MessageCircle, Clock, ShieldCheck, Zap, Wrench, Home, Wifi, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const CATEGORY_LABEL: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  wifi: 'WiFi',
  cleaning: 'Cleaning',
  furniture: 'Furniture',
  security: 'Security',
  other: 'Other'
};

const CATEGORY_ICON: Record<string, any> = {
  electrical: Zap,
  plumbing: Wrench,
  wifi: Wifi,
  cleaning: Trash2,
  furniture: Home,
  security: ShieldCheck,
  other: AlertCircle
};

export default function StudentComplaintsPage() {
  const { profile, user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'other' });

  const fetchComplaints = useCallback(async () => {
    try {
      const userId = user?.id || profile?.user_id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.user_id]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user?.id || profile?.user_id;
    if (!userId || !profile?.id) {
      toast.error('User profile not loaded');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Resolve student record
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentRecord?.id) {
        toast.error('No student record found. You must have a registered student profile to file a complaint.');
        return;
      }

      // 2. Resolve active room allocation to get hostel_id
      const { data: allocation, error: allocError } = await supabase
        .from('room_allocations')
        .select('hostel_id')
        .eq('student_id', studentRecord.id)
        .eq('active', true)
        .maybeSingle();

      if (allocError) throw allocError;
      if (!allocation?.hostel_id) {
        toast.error('No active room allocation found. You must be assigned to a hostel to file a complaint.');
        return;
      }

      // 3. Insert complaint with active hostel_id and status 'open'
      const { error: insertError } = await supabase.from('complaints').insert({
        hostel_id: allocation.hostel_id,
        student_id: userId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category as any,
        status: 'open',
        priority: 2
      });

      if (insertError) throw insertError;

      toast.success('Complaint submitted successfully');
      setDialogOpen(false);
      setForm({ title: '', description: '', category: 'other' });
      fetchComplaints();
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      toast.error(error.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved': return { color: 'bg-green-100 text-green-700', label: 'Resolved' };
      case 'in_progress': return { color: 'bg-blue-100 text-blue-700', label: 'In Progress' };
      case 'assigned': return { color: 'bg-purple-100 text-purple-700', label: 'Assigned' };
      case 'open': return { color: 'bg-amber-100 text-amber-700', label: 'Open' };
      case 'closed': return { color: 'bg-slate-100 text-slate-700', label: 'Closed' };
      case 'pending': return { color: 'bg-amber-100 text-amber-700', label: 'Pending' };
      default: return { color: 'bg-slate-100 text-slate-700', label: status };
    }
  };

  const getPriorityConfig = (priority: number) => {
    switch (priority) {
      case 1: return { color: 'bg-rose-100 text-rose-700', label: 'High' };
      case 2: return { color: 'bg-amber-100 text-amber-700', label: 'Medium' };
      default: return { color: 'bg-blue-100 text-blue-700', label: 'Low' };
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-[#1a3d52]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Complaints &amp; Maintenance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Report room issues and track resolution status in real time.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl shadow-xs font-semibold text-xs sm:text-sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl bg-white dark:bg-[#0e222e] border-slate-200 dark:border-[#1a3d52]" overlayClassName="backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-slate-100 font-sans font-semibold tracking-tight">Submit a Complaint</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-slate-700 dark:text-slate-300">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  required
                  className="border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full mt-1 h-10 rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900/60 px-3 text-sm text-slate-900 dark:text-white"
                >
                  {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-slate-300">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed description of the issue"
                  rows={4}
                  required
                  className="border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-200">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {complaints.length === 0 ? (
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No complaints filed yet</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">Report issues to help improve your hostel experience.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => {
            const statusConfig = getStatusConfig(complaint.status);
            const priorityConfig = getPriorityConfig(complaint.priority);
            const CategoryIcon = CATEGORY_ICON[complaint.category] || AlertCircle;
            
            return (
              <Card key={complaint.id} className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                      <CategoryIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                          <Clock size={12} className="mr-1" />
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 capitalize">{complaint.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">{complaint.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {CATEGORY_LABEL[complaint.category] || complaint.category}
                        </span>
                      </div>
                      
                      {complaint.status === 'resolved' && (
                        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm">
                          <MessageCircle size={16} />
                          <span>Your issue has been resolved.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}