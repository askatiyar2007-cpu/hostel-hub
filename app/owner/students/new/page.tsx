'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function AssignStudentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [invitationData, setInvitationData] = useState<{
    student_name: string;
    email: string;
    hostel_name: string;
    room_number: string;
    invitation_url: string;
    email_sent?: boolean;
  } | null>(null);

  const [formData, setFormData] = useState({
    // Student Personal Info
    student_name: '',
    student_email: '',
    student_phone: '',

    // Address
    address: '',

    // Parent/Guardian Info
    parent_name: '',
    parent_phone: '',
    parent_email: '',

    // Emergency Contact
    emergency_name: '',
    emergency_phone: '',

    // Assignment Details
    hostel_id: '',
    room_id: '',
    start_date: new Date().toISOString().split('T')[0]
  });

  // Fetch hostels owned by this owner
  const { data: hostelsResponse } = useQuery({
    queryKey: ['owner-hostels'],
    queryFn: async () => {
      return supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', user?.id);
    }
  });

  // Use memoization to avoid infinite re-render loop due to unstable array references
  const hostels = useMemo(() => hostelsResponse?.data || [], [hostelsResponse?.data]);

  // Fetch rooms when hostel selection changes
  const { data: roomsResponse } = useQuery({
    queryKey: ['hostel-rooms', formData.hostel_id],
    queryFn: async () => {
      return supabase
        .from('rooms')
        .select('id, room_number, occupied_count, capacity, rent')
        .eq('hostel_id', formData.hostel_id);
    },
    enabled: !!formData.hostel_id
  });

  // Use memoization to avoid infinite re-render loop due to unstable array references
  const rooms = useMemo(() => roomsResponse?.data || [], [roomsResponse?.data]);

  // Auto-select first hostel
  useEffect(() => {
    if (hostels.length > 0 && !formData.hostel_id) {
      setFormData(prev => ({ ...prev, hostel_id: hostels[0].id }));
    }
  }, [hostels, formData.hostel_id]);

  // Auto-select first room when rooms list loads
  useEffect(() => {
    if (rooms.length > 0) {
      const roomExists = rooms.some(r => r.id === formData.room_id);
      if (!roomExists) {
        setFormData(prev => ({ ...prev, room_id: rooms[0].id }));
      }
    } else {
      setFormData(prev => ({ ...prev, room_id: '' }));
    }
  }, [rooms, formData.room_id]);

  const selectedRoomObj = rooms.find(r => r.id === formData.room_id);
  const isShared = selectedRoomObj ? selectedRoomObj.capacity > 1 : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;

    if (!formData.student_name.trim()) return toast.error('Student Name is required');
    if (!formData.student_email.trim() || !emailRegex.test(formData.student_email)) return toast.error('Valid Student Email is required');
    if (!formData.student_phone.trim() || !phoneRegex.test(formData.student_phone)) return toast.error('Student Phone must be exactly 10 digits');
    if (!formData.address.trim()) return toast.error('Address is required');
    if (!formData.parent_name.trim()) return toast.error('Parent Name is required');
    if (!formData.parent_phone.trim() || !phoneRegex.test(formData.parent_phone)) return toast.error('Parent Phone must be exactly 10 digits');
    if (!formData.parent_email.trim() || !emailRegex.test(formData.parent_email)) return toast.error('Valid Parent Email is required');
    if (!formData.emergency_name.trim()) return toast.error('Emergency Contact Name is required');
    if (!formData.emergency_phone.trim() || !phoneRegex.test(formData.emergency_phone)) return toast.error('Emergency Contact Phone must be exactly 10 digits');
    if (!formData.hostel_id) return toast.error('Please select a Hostel');
    if (!formData.room_id) return toast.error('Please select a Room');
    if (!formData.start_date) return toast.error('Check-in Date is required');

    setLoading(true);

    try {
      // Call the new secure API endpoint for manual assignment with invitation
      const response = await fetch('/api/owner/students/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_name: formData.student_name,
          student_email: formData.student_email,
          student_phone: formData.student_phone,
          parent_name: formData.parent_name,
          parent_phone: formData.parent_phone,
          parent_email: formData.parent_email,
          address: formData.address,
          emergency_name: formData.emergency_name,
          emergency_phone: formData.emergency_phone,
          hostel_id: formData.hostel_id,
          room_id: formData.room_id,
          start_date: formData.start_date
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign student');
      }

      // Get hostel and room names for the success dialog
      const selectedHostel = hostels.find(h => h.id === formData.hostel_id);
      const selectedRoom = rooms.find(r => r.id === formData.room_id);

      // Show success dialog with invitation URL
      setInvitationData({
        student_name: formData.student_name,
        email: formData.student_email,
        hostel_name: selectedHostel?.name || 'Selected Hostel',
        room_number: selectedRoom?.room_number || 'Selected Room',
        invitation_url: result.invitation_url
      });
      setShowSuccessDialog(true);
      
      // Show appropriate success message based on email status
      if (result.email_sent) {
        toast.success('Student assigned successfully! Invitation email sent.');
      } else {
        toast.success('Student assigned successfully! Please copy the invitation link manually.');
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during student assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationData?.invitation_url) return;
    
    try {
      await navigator.clipboard.writeText(invitationData.invitation_url);
      toast.success('Invitation link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link. Please copy manually.');
    }
  };

  const handleOpenLink = () => {
    if (!invitationData?.invitation_url) return;
    window.open(invitationData.invitation_url, '_blank');
  };

  const handleDone = () => {
    setShowSuccessDialog(false);
    setInvitationData(null);
    router.push('/owner/students');
  };

  return (
    <DashboardShell
      title="Manual Student Assignment"
      subtitle="Fill in student details and assign them to a hostel room directly without OTP."
      badge="Hostel Owner"
    >
      <div className="mb-6">
        <Link href="/owner/students" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} className="mr-2" /> Back to Student List
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Information Fields */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Student Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-bold font-display mb-4 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">1</span>
              Student Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Student Name *</label>
                <input
                  required
                  type="text"
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.student_name}
                  onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Student Email *</label>
                <input
                  required
                  type="email"
                  placeholder="student@example.com"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.student_email}
                  onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Student Phone *</label>
                <input
                  required
                  type="tel"
                  placeholder="10-digit phone number"
                  maxLength={10}
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.student_phone}
                  onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Parent/Guardian Details */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-bold font-display mb-4 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">2</span>
              Parent / Guardian Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Parent Name *</label>
                <input
                  required
                  type="text"
                  placeholder="Father's or Mother's Name"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Parent Email *</label>
                <input
                  required
                  type="email"
                  placeholder="parent@example.com"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.parent_email}
                  onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Parent Phone *</label>
                <input
                  required
                  type="tel"
                  placeholder="10-digit parent phone number"
                  maxLength={10}
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Address & Emergency Contact */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-bold font-display mb-4 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">3</span>
              Address & Emergency Contact
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Full Permanent Address *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="House No, Street, City, State, Pincode"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground resize-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Emergency Contact Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Emergency Contact Person"
                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                    value={formData.emergency_name}
                    onChange={(e) => setFormData({ ...formData, emergency_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Emergency Contact Phone *</label>
                  <input
                    required
                    type="tel"
                    placeholder="10-digit emergency phone number"
                    maxLength={10}
                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Room & Confirmation Details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-6">
            <h3 className="text-lg font-bold font-display mb-4 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-semibold">4</span>
              Room Assignment
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Hostel *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.hostel_id}
                  onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                >
                  <option value="">Select Hostel</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Room *</label>
                <select
                  required
                  disabled={!formData.hostel_id}
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                >
                  <option value="">Select Room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>Room {r.room_number} ({r.capacity} sharing)</option>
                  ))}
                </select>
              </div>

              {/* Bed selection removed */}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Check-in Date *</label>
                <input
                  required
                  type="date"
                  className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              {selectedRoomObj && (
                <div className="rounded-xl bg-muted/50 p-4 border border-border mt-4 space-y-2 text-xs">
                  <span className="font-bold text-foreground block font-display uppercase tracking-wider">Assignment Details</span>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking Option:</span>
                    <span className="font-semibold text-foreground">{isShared ? 'Shared Bed' : 'Entire Room'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Rent:</span>
                    <span className="font-bold text-primary">₹{Number(selectedRoomObj.rent || 0).toLocaleString()}/mo</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !formData.hostel_id || !formData.room_id}
                className="w-full mt-6 bg-primary hover:bg-primary/95 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Assigning Student...</span>
                  </>
                ) : (
                  'Confirm Assignment'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Success Dialog with Invitation Link */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Student Assigned Successfully!
            </DialogTitle>
          </DialogHeader>
          
          {invitationData && (
            <div className="space-y-4 py-4">
              {invitationData.email_sent !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${invitationData.email_sent ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  {invitationData.email_sent ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-800">Invitation email sent successfully</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm text-amber-800">Email delivery failed. Please copy the link manually.</span>
                    </>
                  )}
                </div>
              )}
              <div className="rounded-xl bg-muted/50 p-4 border border-border space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Student</p>
                  <p className="font-semibold text-foreground">{invitationData.student_name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                  <p className="font-semibold text-foreground">{invitationData.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Hostel</p>
                  <p className="font-semibold text-foreground">{invitationData.hostel_name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Room</p>
                  <p className="font-semibold text-foreground">{invitationData.room_number}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Invitation Link</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={invitationData.invitation_url}
                    className="flex-1 px-3 py-2 bg-muted border border-input rounded-lg text-xs text-muted-foreground outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg font-semibold text-xs transition-all flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    onClick={handleOpenLink}
                    className="px-3 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-lg font-semibold text-xs transition-all flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={handleDone}
              className="w-full bg-primary hover:bg-primary/95 text-white py-2 px-4 rounded-xl font-bold text-sm transition-all"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
