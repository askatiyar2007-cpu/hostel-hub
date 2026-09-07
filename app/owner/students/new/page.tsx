'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, ExternalLink, CheckCircle2, AlertCircle, Building2, User, Mail, Phone, Calendar, Home } from 'lucide-react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type BookingType = 'shared_bed' | 'entire_room';

// User-facing labels for the two booking modes. The underlying persisted
// value (BookingType) and public.booking_type enum are unchanged -- only
// the displayed text differs: "entire_room" reads as "Entire Room" (the
// student gets the whole room exclusively) and "shared_bed" reads as
// "Shared Room" (the student shares the room with other students
// under the existing bed-level allocation model).
const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  entire_room: 'Entire Room',
  shared_bed: 'Shared Room'
};

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
    booking_type: BookingType;
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
    start_date: new Date().toISOString().split('T')[0],
    booking_type: 'shared_bed' as 'shared_bed' | 'entire_room'
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
          start_date: formData.start_date,
          booking_type: formData.booking_type
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
        invitation_url: result.invitation_url,
        booking_type: formData.booking_type as BookingType,
        email_sent: result.email_sent
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

  const handleRetryEmail = async () => {
    if (!invitationData) return;

    try {
      const response = await fetch('/api/owner/students/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitation_url: invitationData.invitation_url,
          student_name: invitationData.student_name,
          hostel_name: invitationData.hostel_name,
          room_number: invitationData.room_number,
          booking_type: invitationData.booking_type,
          email: invitationData.email
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('Invitation email resent successfully!');
        setInvitationData(prev => prev ? { ...prev, email_sent: true } : null);
      } else {
        toast.error(result.error || 'Failed to resend email');
      }
    } catch (err) {
      console.error('Retry email error:', err);
      toast.error('Failed to resend email. Please try again.');
    }
  };

  return (
    <DashboardShell
      title="Assign Student"
      subtitle="Complete student registration, choose an available room, and generate an allocation invitation."
      badge="Owner"
    >
      <div className="mb-6">
        <Link href="/owner/students" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={16} className="mr-2" /> Back to Student List
        </Link>
      </div>

      {/* Workflow Stepper Guide */}
      <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-teal-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs border border-teal-100">1</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Student Profile</p>
            <p className="text-[11px] text-gray-500 truncate">Name, email & phone</p>
          </div>
        </div>
        <div className="bg-white border border-teal-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs border border-teal-100">2</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Parent & Address</p>
            <p className="text-[11px] text-gray-500 truncate">Emergency details</p>
          </div>
        </div>
        <div className="bg-white border border-teal-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs border border-teal-100">3</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Select Room</p>
            <p className="text-[11px] text-gray-500 truncate">Live availability</p>
          </div>
        </div>
        <div className="bg-white border border-teal-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold text-xs border border-teal-100">4</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">Confirm & Assign</p>
            <p className="text-[11px] text-gray-500 truncate">Create allocation</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Information Fields */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Student Information */}
          <div className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">1</span>
              Student Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Student Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="text"
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Student Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="email"
                    placeholder="student@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.student_email}
                    onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Student Mobile Number (10 Digits) *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.student_phone}
                    onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Parent/Guardian Details */}
          <div className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">2</span>
              Parent / Guardian Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Parent / Guardian Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="text"
                    placeholder="Parent's Name"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Parent Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="email"
                    placeholder="parent@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.parent_email}
                    onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Parent Phone Number (10 Digits) *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    required
                    type="tel"
                    placeholder="10-digit parent phone"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                    value={formData.parent_phone}
                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Address & Emergency Contact */}
          <div className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">3</span>
              Permanent Address & Emergency Contact
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">Full Permanent Address *</label>
                <div className="relative">
                  <textarea
                    required
                    rows={3}
                    placeholder="House No, Street, City, State, PIN code"
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 resize-none transition-all"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Emergency Contact Person *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      required
                      type="text"
                      placeholder="Emergency contact name"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                      value={formData.emergency_name}
                      onChange={(e) => setFormData({ ...formData, emergency_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Emergency Contact Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      required
                      type="tel"
                      placeholder="10-digit phone"
                      maxLength={10}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Room & Review Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-xs sticky top-6 space-y-5">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">4</span>
              Room Assignment
            </h3>

            {/* Hostel Selection */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Select Hostel *</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
                <select
                  required
                  className="w-full h-11 pl-10 pr-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm font-medium text-gray-900 transition-all"
                  value={formData.hostel_id}
                  onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                >
                  <option value="">Select Hostel Property</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Room Selection with Availability */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Select Room & View Availability *</label>
              <div className="relative">
                <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  required
                  disabled={!formData.hostel_id}
                  className="w-full h-11 pl-10 pr-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                >
                  <option value="">Select Room</option>
                  {rooms.map(r => {
                    const capacity = r.capacity || 0;
                    const occupied = r.occupied_count || 0;
                    const available = Math.max(0, capacity - occupied);
                    return (
                      <option key={r.id} value={r.id} disabled={available <= 0}>
                        Room {r.room_number} ({capacity} sharing) &bull; {available > 0 ? `${available} bed${available > 1 ? 's' : ''} free` : 'Full'} &bull; ₹{Number(r.rent).toLocaleString()}/mo
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Check-in Date */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Check-in Date *</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="date"
                  className="w-full h-11 pl-10 pr-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm text-gray-900 transition-all"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
            </div>

            {/* Booking Option */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Booking Option *</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                  formData.booking_type === 'entire_room' 
                    ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-500' 
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="booking_type"
                    value="entire_room"
                    checked={formData.booking_type === 'entire_room'}
                    onChange={() => setFormData(prev => ({ ...prev, booking_type: 'entire_room' }))}
                    className="sr-only"
                  />
                  <span className="text-xs">{BOOKING_TYPE_LABEL.entire_room}</span>
                </label>
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                  formData.booking_type === 'shared_bed' 
                    ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold ring-1 ring-teal-500' 
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="booking_type"
                    value="shared_bed"
                    checked={formData.booking_type === 'shared_bed'}
                    onChange={() => setFormData(prev => ({ ...prev, booking_type: 'shared_bed' }))}
                    className="sr-only"
                  />
                  <span className="text-xs">{BOOKING_TYPE_LABEL.shared_bed}</span>
                </label>
              </div>
            </div>

            {/* Assignment Review Details */}
            {selectedRoomObj && (
              <div className="rounded-xl bg-slate-50 p-4 border border-teal-200/70 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                  <span className="font-semibold text-gray-900">Room {selectedRoomObj.room_number} Details</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    (selectedRoomObj.capacity - selectedRoomObj.occupied_count) > 0 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {(selectedRoomObj.capacity - selectedRoomObj.occupied_count) > 0 
                      ? `${selectedRoomObj.capacity - selectedRoomObj.occupied_count} available` 
                      : 'Full'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Room Capacity:</span>
                  <span className="font-medium text-gray-900">{selectedRoomObj.capacity} sharing</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Current Occupancy:</span>
                  <span className="font-medium text-gray-900">{selectedRoomObj.occupied_count} beds occupied</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Booking Type:</span>
                  <span className="font-medium text-gray-900">{BOOKING_TYPE_LABEL[formData.booking_type]}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200/60">
                  <span className="font-semibold text-gray-700">Monthly Rent:</span>
                  <span className="font-bold text-teal-700 text-sm">₹{Number(selectedRoomObj.rent || 0).toLocaleString()}/mo</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading || !formData.hostel_id || !formData.room_id}
              className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Assigning Student...</span>
                </>
              ) : (
                'Confirm & Assign Student'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Success Dialog with Invitation Link */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md bg-white border border-teal-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 font-bold">
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
              Student Assigned Successfully!
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-xs">
              The student has been assigned to the selected room. Share the invitation link with them to complete onboarding.
            </DialogDescription>
          </DialogHeader>
          
          {invitationData && (
            <div className="space-y-4 py-3">
              {invitationData.email_sent !== undefined && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${invitationData.email_sent ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                  {invitationData.email_sent ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <span>Invitation email sent successfully</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Email delivery failed. Please copy and share the link manually.</span>
                    </>
                  )}
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-4 border border-gray-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Student:</span>
                  <span className="font-semibold text-gray-900">{invitationData.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-semibold text-gray-900">{invitationData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hostel:</span>
                  <span className="font-semibold text-gray-900">{invitationData.hostel_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Room:</span>
                  <span className="font-semibold text-gray-900">Room {invitationData.room_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Booking Type:</span>
                  <span className="font-semibold text-gray-900">{BOOKING_TYPE_LABEL[invitationData.booking_type]}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">Direct Invitation Link</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={invitationData.invitation_url}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-gray-200 rounded-lg text-xs text-gray-700 outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-xs transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={handleOpenLink}
                    className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {invitationData && invitationData.email_sent === false ? (
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleRetryEmail}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-xl font-medium text-xs transition-colors"
                >
                  Retry Email
                </button>
                <button
                  onClick={handleDone}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 px-4 rounded-xl font-medium text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                onClick={handleDone}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 px-4 rounded-xl font-medium text-xs transition-colors"
              >
                Done
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}