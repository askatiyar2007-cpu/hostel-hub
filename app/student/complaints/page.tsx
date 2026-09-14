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
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'other' });

  const fetchComplaints = useCallback(async () => {
    try {
      if (!profile?.user_id) return;

      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('student_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id) return;

    try {
      const { error } = await supabase.from('complaints').insert({
        student_id: profile.user_id,
        title: form.title,
        description: form.description,
        category: form.category as any,
        status: 'pending',
        priority: 2
      });

      if (error) throw error;
      toast.success('Complaint submitted successfully');
      setDialogOpen(false);
      setForm({ title: '', description: '', category: 'other' });
      fetchComplaints();
    } catch (error) {
      console.error('Error submitting complaint:', error);
      toast.error('Failed to submit complaint');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved': return { color: 'bg-green-100 text-green-700', label: 'Resolved' };
      case 'in_progress': return { color: 'bg-blue-100 text-blue-700', label: 'In Progress' };
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
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 font-display">Complaints</h1>
          <p className="text-slate-600">Report and track issues in your hostel</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              New Complaint
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Submit a Complaint</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full mt-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detailed description of the issue"
                  rows={4}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
                  Submit
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {complaints.length === 0 ? (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No complaints filed yet</h3>
            <p className="text-slate-600 max-w-md mx-auto">Report issues to help improve your hostel experience.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => {
            const statusConfig = getStatusConfig(complaint.status);
            const priorityConfig = getPriorityConfig(complaint.priority);
            const CategoryIcon = CATEGORY_ICON[complaint.category] || AlertCircle;
            
            return (
              <Card key={complaint.id} className="border border-slate-200 bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
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
                        <span className="text-xs text-slate-500 flex items-center">
                          <Clock size={12} className="mr-1" />
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{complaint.title}</h3>
                      <p className="text-slate-600 text-sm mb-3">{complaint.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {CATEGORY_LABEL[complaint.category] || complaint.category}
                        </span>
                      </div>
                      
                      {complaint.status === 'resolved' && (
                        <div className="mt-4 p-3 bg-emerald-50 rounded-lg flex items-center gap-2 text-emerald-700 text-sm">
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