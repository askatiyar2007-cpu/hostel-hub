'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Plus, Edit2, Trash2, Megaphone, Calendar, Building2, Bell, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NoticeWithHostel {
  id: string;
  hostel_id: string;
  title: string;
  body: string;
  notice_type: string;
  created_at: string;
  hostels: {
    id: string;
    name: string;
    owner_id: string;
  } | null;
}

export default function OwnerAnnouncementsPage() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<NoticeWithHostel[]>([]);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [selectedHostelFilter, setSelectedHostelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    hostel_id: '',
    title: '',
    body: '',
    notice_type: 'general', // 'general' = Normal, 'emergency' = Important
  });

  const [announcementToDelete, setAnnouncementToDelete] = useState<NoticeWithHostel | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('notices')
        .select(`
          *,
          hostels!inner (
            id,
            name,
            owner_id
          )
        `)
        .eq('hostels.owner_id', profile.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements((data as unknown as NoticeWithHostel[]) || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  const fetchHostels = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', profile.user_id)
        .order('name');

      if (error) throw error;
      setHostels(data || []);
      
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, hostel_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchHostels();
    fetchAnnouncements();
  }, [fetchHostels, fetchAnnouncements]);

  const handleCreateOpen = () => {
    setFormData({
      id: '',
      hostel_id: hostels[0]?.id || '',
      title: '',
      body: '',
      notice_type: 'general',
    });
    setIsCreateOpen(true);
  };

  const handleEditOpen = (item: NoticeWithHostel) => {
    setFormData({
      id: item.id,
      hostel_id: item.hostel_id,
      title: item.title,
      body: item.body,
      notice_type: item.notice_type,
    });
    setIsEditOpen(true);
  };

  const handleDeleteOpen = (item: NoticeWithHostel) => {
    setAnnouncementToDelete(item);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostel_id) {
      toast.error('Please select a hostel');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.body.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('notices')
        .insert({
          hostel_id: formData.hostel_id,
          title: formData.title.trim(),
          body: formData.body.trim(),
          notice_type: formData.notice_type,
        });

      if (error) throw error;

      toast.success('Announcement created successfully');
      setIsCreateOpen(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create announcement');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) return;
    if (!formData.hostel_id) {
      toast.error('Please select a hostel');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.body.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('notices')
        .update({
          hostel_id: formData.hostel_id,
          title: formData.title.trim(),
          body: formData.body.trim(),
          notice_type: formData.notice_type,
        })
        .eq('id', formData.id);

      if (error) throw error;

      toast.success('Announcement updated successfully');
      setIsEditOpen(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update announcement');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!announcementToDelete) return;
    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', announcementToDelete.id);

      if (error) throw error;

      toast.success('Announcement deleted successfully');
      setIsDeleteOpen(false);
      setAnnouncementToDelete(null);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete announcement');
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(item => 
      selectedHostelFilter === 'all' || item.hostel_id === selectedHostelFilter
    );
  }, [announcements, selectedHostelFilter]);

  const getPriorityStyle = (type: string) => {
    switch (type) {
      case 'emergency':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'maintenance':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'fee_reminder':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityLabel = (type: string) => {
    switch (type) {
      case 'emergency':
        return 'Important';
      case 'maintenance':
        return 'Maintenance';
      case 'fee_reminder':
        return 'Fee Reminder';
      default:
        return 'Normal';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Announcements</h1>
          <p className="text-muted-foreground">Publish news, reminders, and alerts for your students</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedHostelFilter}
            onChange={(e) => setSelectedHostelFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Hostels</option>
            {hostels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <Button onClick={handleCreateOpen}>
            <Plus size={20} className="mr-2" />
            Create Announcement
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Loading announcements...</p>
          </div>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/40">
          <div className="rounded-full bg-muted p-4">
            <Megaphone size={32} className="text-muted-foreground/60" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground font-display">No announcements found</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
              Create your first announcement to share updates with your students.
            </p>
          </div>
          <Button onClick={handleCreateOpen} variant="ghost">
            Create Announcement &rarr;
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {filteredAnnouncements.map((item) => (
            <div key={item.id} className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${getPriorityStyle(item.notice_type)}`}>
                    {getPriorityLabel(item.notice_type)}
                  </span>
                  {item.hostels && (
                    <span className="text-xs text-muted-foreground flex items-center bg-muted px-2 py-0.5 rounded">
                      <Building2 size={12} className="mr-1" />
                      {item.hostels.name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center ml-auto">
                    <Calendar size={12} className="mr-1" />
                    {new Date(item.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 mt-2 text-sm whitespace-pre-wrap leading-relaxed">{item.body}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-end gap-2">
                <button 
                  onClick={() => handleEditOpen(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors p-1.5 hover:bg-muted rounded-lg"
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>
                <button 
                  onClick={() => handleDeleteOpen(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:text-red-700 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>Publish news or alerts for students</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="hostel">Select Hostel <span className="text-red-500">*</span></Label>
              <select
                id="hostel"
                required
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.hostel_id}
                onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
              >
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                required
                placeholder="e.g. Water Supply Maintenance"
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="priority">Priority / Type <span className="text-red-500">*</span></Label>
              <select
                id="priority"
                required
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.notice_type}
                onChange={(e) => setFormData({ ...formData, notice_type: e.target.value })}
              >
                <option value="general">Normal</option>
                <option value="emergency">Important</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="body">Message / Announcement Body <span className="text-red-500">*</span></Label>
              <Textarea
                id="body"
                required
                rows={5}
                placeholder="Write the announcement details here..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitLoading}
              >
                {submitLoading ? 'Publishing...' : 'Publish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>Update the announcement details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-hostel">Select Hostel <span className="text-red-500">*</span></Label>
              <select
                id="edit-hostel"
                required
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.hostel_id}
                onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
              >
                {hostels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-title">Title <span className="text-red-500">*</span></Label>
              <Input
                id="edit-title"
                required
                placeholder="e.g. Water Supply Maintenance"
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-priority">Priority / Type <span className="text-red-500">*</span></Label>
              <select
                id="edit-priority"
                required
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.notice_type}
                onChange={(e) => setFormData({ ...formData, notice_type: e.target.value })}
              >
                <option value="general">Normal</option>
                <option value="emergency">Important</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-body">Message / Announcement Body <span className="text-red-500">*</span></Label>
              <Textarea
                id="edit-body"
                required
                rows={5}
                placeholder="Write the announcement details here..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitLoading}
              >
                {submitLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone, and students will no longer be able to see it.
            </DialogDescription>
          </DialogHeader>
          {announcementToDelete && (
            <div className="mb-4 p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-xs font-bold uppercase text-muted-foreground">{getPriorityLabel(announcementToDelete.notice_type)}</span>
              <h4 className="font-bold text-foreground mt-1">{announcementToDelete.title}</h4>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={submitLoading}
            >
              {submitLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
