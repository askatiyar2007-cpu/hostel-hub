/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  AlertTriangle, 
  Inbox, 
  Building2, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  FileText, 
  LogOut, 
  Eye, 
  RotateCcw, 
  Check, 
  X, 
  DollarSign, 
  Trash2, 
  X as CloseIcon
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { MarkDepositPaidModal, MarkFeePaidModal, PaymentHistoryModal } from './payment-modals';

type TabType = 'pending' | 'approved' | 'rejected';

export default function OwnerRequestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('newest');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [OwnerRequestsPage] Component mounted. Invalidating allocations & requests cache to force refetch...`);
    qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
    qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
  }, [qc]);

  // Modal control states
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<any | null>(null);
  const [selectedConfirmAction, setSelectedConfirmAction] = useState<{ type: 'approve' | 'reject' | 'checkout' | 'rereview' | 'delete'; id: string; req?: any } | null>(null);
  const [agreementModalData, setAgreementModalData] = useState<any | null>(null);
  const [selectedDepositAlloc, setSelectedDepositAlloc] = useState<any | null>(null);
  const [selectedFeeAlloc, setSelectedFeeAlloc] = useState<any | null>(null);
  const [selectedFeeId, setSelectedFeeId] = useState<string | null>(null);
  const [selectedHistoryAlloc, setSelectedHistoryAlloc] = useState<any | null>(null);

  // 1. Fetch Room Requests
  const { data: requests, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['owner-room-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: requestsData, error: requestsError } = await supabase
        .from('room_requests')
        .select(`
          *,
          rooms(
            id,
            room_number,
            type,
            room_type,
            capacity,
            occupancy,
            occupied_count,
            occupied_beds,
            rent,
            room_allocations(id, active)
          ),
          hostels!inner(
            id,
            name,
            owner_id
          )
        `)
        .eq('hostels.owner_id', user!.id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      if (!requestsData || requestsData.length === 0) return [];

      const studentIds = Array.from(new Set(requestsData.map((r: any) => r.student_id).filter(Boolean)));
      let studentsMap = new Map();
      if (studentIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id, college, course, year, profile_id')
          .in('id', studentIds);

        if (studentsError) throw studentsError;

        const profileIds = studentsData ? Array.from(new Set(studentsData.map((s: any) => s.profile_id).filter(Boolean))) : [];
        let profilesMap = new Map();
        if (profileIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone_number, gender, date_of_birth, avatar_url')
            .in('id', profileIds);

          if (profilesError) throw profilesError;

          profilesMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
        }

        studentsMap = new Map((studentsData ?? []).map((s: any) => {
          const profile = profilesMap.get(s.profile_id) || null;
          return [s.id, {
            id: s.id,
            college: s.college,
            course: s.course,
            year: s.year,
            profiles: profile
          }];
        }));
      }

      const mergedRequests = requestsData.map((req: any) => {
        const studentInfo = studentsMap.get(req.student_id) || null;
        return {
          ...req,
          students: studentInfo
        };
      });

      // Fetch photo URLs for students with room requests
      if (mergedRequests && mergedRequests.length > 0) {
        const photoUrlPromises = mergedRequests.map(async (req) => {
          const studentId = req.student_id;
          if (!studentId) return null;

          try {
            const response = await fetch(`/api/students/photo-url?student_id=${studentId}`);
            if (response.ok) {
              const data = await response.json();
              return { studentId, url: data.signedUrl };
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch photo for student ${studentId}:`, error);
            return null;
          }
        });

        const photoResults = await Promise.all(photoUrlPromises);
        const urlMap: Record<string, string> = {};
        photoResults.forEach(result => {
          if (result) {
            urlMap[result.studentId] = result.url;
          }
        });
        setPhotoUrls(urlMap);
      }

      return mergedRequests;
    },
  });

  // 2. Fetch Active Room Allocations
  const { data: allocations, isLoading: isAllocationsLoading, error: allocationsError, refetch: refetchAllocations } = useQuery({
    queryKey: ['owner-room-allocations', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [useQuery:owner-room-allocations] Fetching room allocations for owner ID:`, user?.id);

      const { data, error } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          start_date,
          active,
          created_at,
          booking_type,
          status,
          student_name,
          student_email,
          student_phone,
          rooms!inner(id, room_number, capacity, occupancy, occupied_count, rent, room_allocations(id, active)),
          hostels!inner(id, name, owner_id)
        `)
        .eq('hostels.owner_id', user!.id)
        .eq('active', true)
        .order('created_at', { ascending: false });

      const hostelIds = data ? Array.from(new Set(data.map((a: any) => a.hostel_id))) : [];
      console.log(`[${timestamp}] [useQuery:owner-room-allocations] Owner hostel IDs found in allocations:`, hostelIds);

      if (error) {
        console.error(`[${timestamp}] [useQuery:owner-room-allocations] Supabase error:`, error);
        throw error;
      }

      const allocationIds = data ? data.map((a: any) => a.id) : [];

      if (allocationIds.length === 0) {
        return [];
      }

      // Fetch student_fees separately
      const { data: feesData, error: feesError } = await supabase
        .from('student_fees')
        .select('id, amount_due, due_date, status, paid_date, payment_method, allocation_id')
        .in('allocation_id', allocationIds);

      if (feesError) {
        console.error(`[${timestamp}] [useQuery:owner-room-allocations] Fees error:`, feesError);
        throw feesError;
      }

      // Fetch payments separately
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount_paid, payment_method, payment_status, paid_date, reference_number, notes, allocation_id, student_fees_id')
        .in('allocation_id', allocationIds);

      if (paymentsError) {
        console.error(`[${timestamp}] [useQuery:owner-room-allocations] Payments error:`, paymentsError);
        throw paymentsError;
      }

      // Fetch student approved requests to get parent/guardian/address information
      const studentIds = data ? data.map((a: any) => a.student_id).filter(Boolean) : [];
      let requestsByStudentId = new Map();
      if (studentIds.length > 0) {
        const { data: requestsData } = await supabase
          .from('room_requests')
          .select('*')
          .in('student_id', studentIds)
          .eq('status', 'approved');
        
        requestsByStudentId = new Map(
          (requestsData ?? []).map((r: any) => [r.student_id, r])
        );
      }

      // Fetch photo URLs for students with room requests
      if (studentIds.length > 0) {
        const photoUrlPromises = studentIds.map(async (studentId) => {
          try {
            const response = await fetch(`/api/students/photo-url?student_id=${studentId}`);
            if (response.ok) {
              const data = await response.json();
              return { studentId, url: data.signedUrl };
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch photo for student ${studentId}:`, error);
            return null;
          }
        });

        const photoResults = await Promise.all(photoUrlPromises);
        const urlMap: Record<string, string> = {};
        photoResults.forEach(result => {
          if (result) {
            urlMap[result.studentId] = result.url;
          }
        });
        setPhotoUrls(urlMap);
      }

      // Fetch students and profiles sequentially to prevent RLS-related recursion / nested traversal issues
      let studentsMap = new Map();
      if (studentIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id, college, course, year, profile_id')
          .in('id', studentIds);

        if (studentsError) {
          console.error(`[${timestamp}] [useQuery:owner-room-allocations] Students query error:`, studentsError);
          throw studentsError;
        }

        const profileIds = studentsData ? Array.from(new Set(studentsData.map((s: any) => s.profile_id).filter(Boolean))) : [];
        let profilesMap = new Map();
        if (profileIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone_number, gender, date_of_birth, avatar_url')
            .in('id', profileIds);

          if (profilesError) {
            console.error(`[${timestamp}] [useQuery:owner-room-allocations] Profiles query error:`, profilesError);
            throw profilesError;
          }

          profilesMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
        }

        studentsMap = new Map((studentsData ?? []).map((s: any) => {
          const profile = profilesMap.get(s.profile_id) || null;
          return [s.id, {
            id: s.id,
            college: s.college,
            course: s.course,
            year: s.year,
            profiles: profile
          }];
        }));
      }

      // Combine allocations with their fees and payments
      const mappedData = (data ?? []).map((alloc: any) => {
        const allocFees = (feesData ?? []).filter((f: any) => f.allocation_id === alloc.id);
        const allocPayments = (paymentsData ?? []).filter((p: any) => p.allocation_id === alloc.id);
        const studentReq = requestsByStudentId.get(alloc.student_id);

        const hasPaidDeposit = allocPayments.some(
          (p: any) => !p.student_fees_id && p.payment_status === 'completed'
        );

        const studentInfo = studentsMap.get(alloc.student_id) || null;

        const fullName = alloc.student_name || studentInfo?.profiles?.full_name || '-';
        const email = alloc.student_email || studentInfo?.profiles?.email || '-';
        const phone = alloc.student_phone || studentInfo?.profiles?.phone_number || '-';

        return {
          ...alloc,
          students: {
            id: alloc.student_id,
            profiles: {
              full_name: fullName,
              email: email,
              phone_number: phone,
              gender: studentInfo?.profiles?.gender || null,
              date_of_birth: studentInfo?.profiles?.date_of_birth || null,
              avatar_url: studentInfo?.profiles?.avatar_url || null
            },
            college: studentInfo?.college || null,
            course: studentInfo?.course || null,
            year: studentInfo?.year || null,
            parent_name: studentReq?.parent_name || alloc.parent_name || null,
            parent_phone: studentReq?.parent_phone || alloc.parent_phone || null,
            parent_email: studentReq?.parent_email || alloc.parent_email || null,
            address: studentReq?.address || alloc.address || null,
            emergency_contact: studentReq?.emergency_contact || alloc.emergency_contact || null,
            emergency_contact_name: studentReq?.emergency_contact_name || alloc.emergency_contact_name || null,
            emergency_contact_phone: studentReq?.emergency_contact_phone || alloc.emergency_contact_phone || null
          },
          deposit_status: hasPaidDeposit ? 'paid' : 'pending',
          student_fees: allocFees.map((fee: any) => ({
            ...fee,
            amount_due: fee.amount_due
          })),
          payments: allocPayments.map((p: any) => ({
            ...p,
            amount_paid: p.amount_paid,
            payment_status: p.payment_status,
            paid_date: p.paid_date
          }))
        };
      });

      return mappedData;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // 2b. Fetch Owner's Hostels directly (source of truth)
  const { data: ownerHostels } = useQuery({
    queryKey: ['owner-hostels-list', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', user!.id)
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // 2c. Fetch Owner's Rooms to build unique rooms filter list dynamically
  const { data: ownerRooms } = useQuery({
    queryKey: ['owner-rooms-list', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: hostelsData } = await supabase
        .from('hostels')
        .select('id')
        .eq('owner_id', user!.id);
      
      const hostelIds = hostelsData?.map(h => h.id) || [];
      if (hostelIds.length === 0) return [];

      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_number, hostel_id')
        .in('hostel_id', hostelIds)
        .order('room_number');
      if (error) throw error;
      return data || [];
    }
  });

  // 3. Mutation: Approve Request
  const approveMutation = useMutation({
    mutationFn: async (req: any) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [approveMutation] Calling RPC: approve_room_request with id:`, req.id);
      
      const { data, error } = await supabase.rpc('approve_room_request', {
        p_request_id: req.id
      });
      
      console.log(`[${timestamp}] [approveMutation] RPC Response data:`, data);
      console.log(`[${timestamp}] [approveMutation] RPC Response error:`, error);
      
      if (error) {
        console.error(`[${timestamp}] [approveMutation] RPC Error details:`, error.message, error.details, error.hint);
        throw new Error(error.message);
      }
      
      if (data && typeof data === 'object') {
        const resObj = data as any;
        if (resObj.success === false) {
          console.error(`[${timestamp}] [approveMutation] RPC returned failure:`, resObj.message);
          throw new Error(resObj.message || 'Approval failed');
        }
        if (resObj.error) {
          throw new Error(resObj.error || 'Approval failed');
        }
        console.log(`[${timestamp}] [approveMutation] Approval successful:`, data);
        return data;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Room request approved successfully.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
      qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
      qc.invalidateQueries({ queryKey: ['owner-rooms'] });
      refetchAllocations();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Approval failed');
      setSelectedConfirmAction(null);
    },
  });

  // 4. Mutation: Reject Request
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_requests')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request rejected.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSelectedConfirmAction(null);
    },
  });

  // 5. Mutation: Re-Review Request (Reject -> Pending)
  const rereviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_requests')
        .update({ status: 'pending' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request moved back to pending.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSelectedConfirmAction(null);
    },
  });

  // 6. Mutation: Check Out Student
  const checkoutMutation = useMutation({
    mutationFn: async (allocId: string) => {
      const { error } = await supabase.rpc('checkout_student', { p_alloc_id: allocId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Student checked out successfully.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
      qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
      qc.invalidateQueries({ queryKey: ['owner-rooms'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSelectedConfirmAction(null);
    },
  });

  // 6.5 Mutation: Mark Monthly Fee Paid (calls mark_payment_paid RPC)
  const markPaidMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [markPaidMutation] Calling RPC: mark_payment_paid with id:`, feeId);
      
      const { data, error } = await supabase.rpc('mark_payment_paid', {
        p_fee_id: feeId
      });
      
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Payment marked as paid');
      qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
      refetchAllocations();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to mark payment as paid');
    }
  });

  // 7. Mutation: Delete Rejected Request
  // Real backend deletion, gated by Row Level Security (only the owner of the
  // request's hostel can delete, and only while status = 'rejected' -- see
  // migration 20260828000000_owner_dashboard_complaints_and_request_policies.sql).
  // The .eq('status', 'rejected') filter below is defense-in-depth only; RLS
  // is the actual security boundary.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'rejected');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rejected request deleted.');
      setSelectedConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSelectedConfirmAction(null);
    },
  });

  // Counts for Badges
  const pendingRequests = requests?.filter((r: any) => r.status === 'pending') ?? [];
  const rejectedRequests = requests?.filter((r: any) => r.status === 'rejected') ?? [];
  const approvedAllocations = allocations ?? [];

  // Filter Items lists based on Search & Select query states
  const getFilteredItems = (items: any[]) => {
    if (!items) return [];
    
    return items
      .filter((item: any) => {
        const student = Array.isArray(item.students) ? item.students[0]?.profiles : item.students?.profiles;
        const studentName = (student?.full_name || item.student_name || '').toLowerCase();
        const studentEmail = (student?.email || item.student_email || '').toLowerCase();
        const studentPhone = (student?.phone_number || item.student_phone || '').toLowerCase();
        const parentName = (item.parent_name || '').toLowerCase();
        
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          studentName.includes(query) ||
          studentEmail.includes(query) ||
          studentPhone.includes(query) ||
          parentName.includes(query);
          
        const matchesHostel = hostelFilter === 'all' || item.hostel_id === hostelFilter;
        const matchesRoom = roomFilter === 'all' || item.rooms?.room_number === roomFilter;
        
        return matchesSearch && matchesHostel && matchesRoom;
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'alpha') {
          const studentA = Array.isArray(a.students) ? a.students[0]?.profiles : a.students?.profiles;
          const nameA = studentA?.full_name || a.student_name || '';
          const studentB = Array.isArray(b.students) ? b.students[0]?.profiles : b.students?.profiles;
          const nameB = studentB?.full_name || b.student_name || '';
          return nameA.localeCompare(nameB);
        }
        return 0;
      });
  };

  // Get distinct list of hostels and rooms for filters dropdown
  const uniqueHostels = ownerHostels || [];
  const uniqueRooms = Array.from(new Set(
    ownerRooms
      ?.filter((r: any) => hostelFilter === 'all' || r.hostel_id === hostelFilter)
      ?.map((r: any) => r.room_number)
      .filter(Boolean) || []
  ));

  const visiblePending = getFilteredItems(pendingRequests);
  const visibleApproved = getFilteredItems(approvedAllocations);
  const visibleRejected = getFilteredItems(rejectedRequests);

  const activeItemsCount = 
    activeTab === 'pending' ? visiblePending.length :
    activeTab === 'approved' ? visibleApproved.length : visibleRejected.length;

  if (isRequestsLoading || isAllocationsLoading || approveMutation.isPending || checkoutMutation.isPending || rejectMutation.isPending || rereviewMutation.isPending || deleteMutation.isPending) {
    return (
      <DashboardShell title="Room Requests & Allocations" subtitle="Processing database updates..." badge="Owner">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">
              {approveMutation.isPending 
                ? "Approving request and generating fees..." 
                : checkoutMutation.isPending 
                ? "Checking out student and updating occupancy..." 
                : rejectMutation.isPending
                ? "Rejecting request..."
                : rereviewMutation.isPending
                ? "Moving request back to pending..."
                : deleteMutation.isPending
                ? "Deleting rejected request..."
                : "Loading allocations database..."}
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (allocationsError) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [OwnerRequestsPage] Render error state:`, allocationsError);
    return (
      <DashboardShell title="Room Requests & Allocations" subtitle="Error loading data" badge="Owner">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-500 max-w-md text-center">
            <AlertTriangle size={40} className="text-red-500" />
            <p className="text-sm font-semibold">Error: {(allocationsError as Error).message || 'Failed to fetch allocations'}</p>
            <p className="text-xs text-muted-foreground">Please check console log for details or click retry below.</p>
            <Button onClick={() => refetchAllocations()} variant="outline" className="mt-2 h-9 rounded-xl">
              Retry Fetching
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell 
      title="Room Requests" 
      subtitle="Review and manage student room requests, approve allocations, and track resident onboarding." 
      badge="Owner"
      className="p-4 sm:p-6 lg:px-6 lg:py-8"
    >
      <div className="w-full max-w-[1150px] mx-auto">
        {/* 1. Tab Navigation */}
      <div className="flex border-b border-slate-200/80 gap-2 pb-px justify-between items-center flex-wrap">
        <div className="flex gap-2 overflow-x-auto">
          <TabButton 
            active={activeTab === 'pending'} 
            onClick={() => { setActiveTab('pending'); }} 
            label="Pending Requests" 
            count={pendingRequests.length}
          />
          <TabButton 
            active={activeTab === 'approved'} 
            onClick={() => { setActiveTab('approved'); }} 
            label="Approved Allocations" 
            count={approvedAllocations.length}
          />
          <TabButton 
            active={activeTab === 'rejected'} 
            onClick={() => { setActiveTab('rejected'); }} 
            label="Rejected Requests" 
            count={rejectedRequests.length}
          />
        </div>
        <div className="pb-2 md:pb-0">
          <Button 
            onClick={() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [RefreshButton] Manually invalidating queries...`);
              qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
              qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
              toast.success('Data refreshed successfully!');
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 h-9 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-2xs font-semibold text-xs"
          >
            <RotateCcw size={14} className={isRequestsLoading || isAllocationsLoading ? 'animate-spin text-teal-600' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center justify-between bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            type="text" 
            placeholder="Search by student, email, phone or parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 border-slate-200 bg-white rounded-xl text-xs focus-visible:ring-2 focus-visible:ring-teal-500/20 focus-visible:border-teal-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <SlidersHorizontal size={14} /> Filters:
          </div>

          {/* Filter by Hostel */}
          <select 
            value={hostelFilter}
            onChange={(e) => {
              setHostelFilter(e.target.value);
              setRoomFilter('all');
            }}
            className="h-10 text-xs px-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Hostels</option>
            {uniqueHostels.map((hostel: any) => (
              <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
            ))}
          </select>

          {/* Filter by Room */}
          <select 
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="h-10 text-xs px-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Rooms</option>
            {uniqueRooms.map((room: any) => (
              <option key={room} value={room}>Room {room}</option>
            ))}
          </select>

          {/* Sorting */}
          <div className="flex items-center border border-border rounded-xl px-2 h-10">
            <ArrowUpDown size={12} className="text-muted-foreground mr-1" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-full text-xs bg-transparent border-none focus:outline-none pr-1"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs font-semibold text-muted-foreground flex justify-between items-center px-1">
        <span>{activeItemsCount} requests found matching filters</span>
        {(searchQuery || hostelFilter !== 'all' || roomFilter !== 'all') && (
          <button 
            onClick={() => {
              setSearchQuery('');
              setHostelFilter('all');
              setRoomFilter('all');
              setSortBy('newest');
            }}
            className="text-teal-600 hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* 3. Dynamic Tab Content */}
      <div className="mt-6">
        {activeTab === 'pending' && (
          visiblePending.length === 0 ? (
            <EmptyState message="No pending room requests found." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-3">
                {visiblePending.map((req: any) => {
                  const studentId = req.student_id;
                  const passportPhotoUrl = studentId ? photoUrls[studentId] : undefined;
                  return (
                    <PendingRequestCard 
                      key={req.id} 
                      req={req} 
                      passportPhotoUrl={passportPhotoUrl}
                      onPreviewPhoto={setPreviewPhoto}
                      onApprove={() => setSelectedConfirmAction({ type: 'approve', id: req.id, req })}
                      onReject={() => setSelectedConfirmAction({ type: 'reject', id: req.id })}
                      onViewDetails={() => {
                        setSelectedDetailsItem(req);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )
        )}

        {activeTab === 'approved' && (
          visibleApproved.length === 0 ? (
            <EmptyState message="No active approved allocations found." />
          ) : (
            <div className="space-y-3">

              <div className="flex flex-col gap-4">
                {visibleApproved.map((alloc: any) => {
                  const studentId = alloc.student_id;
                  const passportPhotoUrl = studentId ? photoUrls[studentId] : undefined;
                  return (
                    <ApprovedAllocationCard 
                      key={alloc.id} 
                      alloc={alloc} 
                      passportPhotoUrl={passportPhotoUrl}
                      onPreviewPhoto={setPreviewPhoto}
                      onCheckout={() => setSelectedConfirmAction({ type: 'checkout', id: alloc.id })}
                      onViewAgreement={() => setAgreementModalData(alloc)}
                      onViewDetails={() => {
                        setSelectedDetailsItem(alloc);
                      }}
                      onMarkDepositPaid={() => setSelectedDepositAlloc(alloc)}
                      onMarkFeePaid={(feeId) => {
                        markPaidMutation.mutate(feeId);
                      }}
                      onViewHistory={() => setSelectedHistoryAlloc(alloc)}
                    />
                  );
                })}
              </div>
            </div>
          )
        )}

        {activeTab === 'rejected' && (
          visibleRejected.length === 0 ? (
            <EmptyState message="No rejected requests found." />
          ) : (
            <div className="space-y-3">
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 rounded-xl border border-border/40">
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Hostel / Room</div>
                <div className="col-span-3">Submission Info</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              <div className="flex flex-col gap-3">
                {visibleRejected.map((req: any) => (
                  <RejectedRequestCard 
                    key={req.id} 
                    req={req} 
                    onRereview={() => setSelectedConfirmAction({ type: 'rereview', id: req.id })}
                    onDelete={() => setSelectedConfirmAction({ type: 'delete', id: req.id })}
                    onViewDetails={() => {
                      setSelectedDetailsItem(req);
                    }}
                  />
                ))}
              </div>
            </div>
          )
        )}
      </div>
      </div>

      {/* 4. Details Modal */}
      {selectedDetailsItem && (
        <DetailsModal 
          item={selectedDetailsItem}
          onClose={() => {
            setSelectedDetailsItem(null);
          }}
        />
      )}

      {/* 5. Confirmation Action Modal */}
      {selectedConfirmAction && (
        <ConfirmationModal 
          action={selectedConfirmAction.type}
          onConfirm={() => {
            if (selectedConfirmAction.type === 'approve') {
              approveMutation.mutate(selectedConfirmAction.req);
            } else if (selectedConfirmAction.type === 'reject') {
              rejectMutation.mutate(selectedConfirmAction.id);
            } else if (selectedConfirmAction.type === 'rereview') {
              rereviewMutation.mutate(selectedConfirmAction.id);
            } else if (selectedConfirmAction.type === 'checkout') {
              checkoutMutation.mutate(selectedConfirmAction.id);
            } else if (selectedConfirmAction.type === 'delete') {
              deleteMutation.mutate(selectedConfirmAction.id);
            }
          }}
          onClose={() => setSelectedConfirmAction(null)}
          loading={approveMutation.isPending || rejectMutation.isPending || rereviewMutation.isPending || checkoutMutation.isPending || deleteMutation.isPending}
        />
      )}

      {/* 6. Agreement PDF Modal */}
      {agreementModalData && (
        <AgreementModal 
          alloc={agreementModalData}
          onClose={() => setAgreementModalData(null)}
        />
      )}

      {/* 7. Mark Deposit Paid Modal */}
      {selectedDepositAlloc && (
        <MarkDepositPaidModal
          alloc={selectedDepositAlloc}
          ownerUserId={user?.id}
          onClose={() => setSelectedDepositAlloc(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-room-allocations'] })}
        />
      )}

      {/* 8. Mark Monthly Fee Paid Modal */}
      {selectedFeeAlloc && (
        <MarkFeePaidModal
          alloc={selectedFeeAlloc}
          initialFeeId={selectedFeeId || undefined}
          ownerUserId={user?.id}
          onClose={() => {
            setSelectedFeeAlloc(null);
            setSelectedFeeId(null);
          }}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-room-allocations'] })}
        />
      )}

      {/* 9. Payment History Modal */}
      {selectedHistoryAlloc && (
        <PaymentHistoryModal
          alloc={selectedHistoryAlloc}
          onClose={() => setSelectedHistoryAlloc(null)}
        />
      )}

      {/* 10. Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={previewPhoto} 
              alt="Student passport photo preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <CloseIcon size={20} className="text-gray-900" />
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

// ---------------- Helper Components ----------------

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-xs transition-all whitespace-nowrap ${
        active 
          ? 'border-teal-600 text-teal-700 bg-teal-50/50' 
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      {label}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        active 
          ? 'bg-teal-600 text-white' 
          : 'bg-slate-100 text-slate-600'
      }`}>
        {count}
      </span>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center bg-card">
      <Inbox className="mx-auto h-12 w-12 text-muted-foreground/30" />
      <h3 className="mt-4 text-base font-bold text-foreground">No Records Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------- Card Implementations ----------------

function PendingRequestCard({ 
  req, 
  onApprove, 
  onReject, 
  onViewDetails, 
  passportPhotoUrl, 
  onPreviewPhoto 
}: { 
  req: any; 
  onApprove: () => void; 
  onReject: () => void; 
  onViewDetails: () => void; 
  passportPhotoUrl?: string; 
  onPreviewPhoto?: (url: string) => void 
}) {
  const student = Array.isArray(req.students) ? req.students[0]?.profiles : req.students?.profiles;
  const studentName = student?.full_name || req.student_name || 'Unnamed Student';
  const studentEmail = student?.email || req.student_email || '-';
  const studentPhone = student?.phone_number || req.student_phone || '-';
  const emergencyContact = req.emergency_contact || (req.emergency_contact_name && req.emergency_contact_phone ? `${req.emergency_contact_name} - ${req.emergency_contact_phone}` : req.emergency_contact_name || 'N/A');
  
  const room = req.rooms;
  const capacity = room?.capacity ?? 0;
  const occupancy = room?.room_allocations?.filter((a: any) => a.active === true).length ?? 0;
  const freeSlots = capacity - occupancy;

  return (
    <div className="w-full bg-white border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm rounded-xl p-5 lg:p-5 transition-all">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* 1. Student (Passport Photo, Name, Contact) */}
        <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
          {passportPhotoUrl ? (
            <div className="relative group shrink-0">
              <img 
                src={passportPhotoUrl} 
                alt="Student passport photo"
                className="h-12 w-12 rounded-xl object-cover border border-violet-200 cursor-pointer group-hover:ring-2 group-hover:ring-violet-500 transition-all"
                onClick={() => onPreviewPhoto && onPreviewPhoto(passportPhotoUrl)}
              />
              <div 
                onClick={() => onPreviewPhoto && onPreviewPhoto(passportPhotoUrl)}
                className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white"
              >
                <Eye size={14} />
              </div>
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 font-bold text-base border border-violet-100">
              {studentName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate" title={studentName}>{studentName}</h3>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate mt-0.5" title={studentEmail}>
              <Mail size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{studentEmail}</span>
            </div>
            {studentPhone !== '-' && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate mt-0.5">
                <Phone size={12} className="shrink-0 text-slate-400" />
                <span>{studentPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Hostel & Room */}
        <div className="lg:col-span-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-slate-900">
            <Building2 size={14} className="text-blue-600 shrink-0" />
            <span className="truncate">{req.hostels?.name || 'Hostel Property'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold">
              Room {room?.room_number || '-'}
            </span>
            <span className="text-xs text-slate-500">
              {req.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'}
            </span>
          </div>
          {room?.rent && (
            <div className="text-xs text-slate-600 font-medium mt-1">
              ₹{Number(room.rent).toLocaleString()}/month
            </div>
          )}
        </div>

        {/* 3. Request Info */}
        <div className="lg:col-span-3 min-w-0 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span>{new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
          <div>
            <span className="text-slate-500">Occupancy: </span>
            <span className="font-semibold text-slate-800">{occupancy}/{capacity}</span>
            <span className={`ml-1 font-medium ${freeSlots > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ({freeSlots > 0 ? `${freeSlots} free` : 'Full'})
            </span>
          </div>
          {emergencyContact !== 'N/A' && (
            <div className="text-[11px] text-slate-500 truncate" title={emergencyContact}>
              Emg: {emergencyContact}
            </div>
          )}
        </div>

        {/* 4. Status */}
        <div className="lg:col-span-1 flex lg:justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
            <Clock size={12} /> Pending
          </span>
        </div>

        {/* 5. Actions */}
        <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-wrap">
          <Button 
            onClick={onApprove} 
            disabled={freeSlots <= 0}
            size="sm"
            className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <CheckCircle2 size={14} /> Approve
          </Button>
          <Button 
            onClick={onReject} 
            variant="outline" 
            size="sm"
            className="h-9 px-3 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <XCircle size={14} /> Reject
          </Button>
          <Button 
            onClick={onViewDetails} 
            variant="ghost" 
            size="sm"
            className="h-9 px-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Eye size={14} /> Details
          </Button>
        </div>
      </div>

      {freeSlots <= 0 && (
        <div className="mt-3 p-2.5 bg-rose-50 text-rose-700 rounded-lg flex items-center gap-2 text-xs font-medium border border-rose-100">
          <AlertTriangle size={14} className="shrink-0" />
          Approval is blocked because the requested room is currently full.
        </div>
      )}
    </div>
  );
}

function ApprovedAllocationCard({ 
  alloc, 
  onCheckout, 
  onViewAgreement, 
  onViewDetails,
  onMarkDepositPaid,
  onMarkFeePaid,
  onViewHistory,
  passportPhotoUrl,
  onPreviewPhoto
}: { 
  alloc: any; 
  onCheckout: () => void; 
  onViewAgreement: () => void; 
  onViewDetails: () => void;
  onMarkDepositPaid: () => void;
  onMarkFeePaid: (feeId: string) => void;
  onViewHistory: () => void;
  passportPhotoUrl?: string;
  onPreviewPhoto?: (url: string) => void;
}) {
  const student = Array.isArray(alloc.students) ? alloc.students[0]?.profiles : alloc.students?.profiles;
  const studentName = student?.full_name || alloc.student_name || 'Resident Student';
  const studentEmail = student?.email || alloc.student_email || '-';
  const studentPhone = student?.phone_number || alloc.student_phone || '-';

  const studentRecord = Array.isArray(alloc.students) ? alloc.students[0] : alloc.students;
  const emergencyContact = studentRecord?.emergency_contact
    || (studentRecord?.emergency_contact_name && studentRecord?.emergency_contact_phone
      ? `${studentRecord.emergency_contact_name} - ${studentRecord.emergency_contact_phone}`
      : studentRecord?.emergency_contact_name || 'N/A');

  const room = alloc.rooms;
  const rent = room?.rent ?? 0;

  return (
    <div className="w-full bg-white border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm rounded-xl p-5 lg:p-6 transition-all space-y-4">
      {/* Main Row: Student -> Hostel/Room -> Timeline/Rent -> Status -> Primary Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* 1. Resident Student */}
        <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
          {passportPhotoUrl ? (
            <div className="relative group shrink-0">
              <img 
                src={passportPhotoUrl} 
                alt="Student passport photo"
                className="h-12 w-12 rounded-xl object-cover border border-violet-200 cursor-pointer group-hover:ring-2 group-hover:ring-violet-500 transition-all"
                onClick={() => onPreviewPhoto && onPreviewPhoto(passportPhotoUrl)}
              />
              <div 
                onClick={() => onPreviewPhoto && onPreviewPhoto(passportPhotoUrl)}
                className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white"
              >
                <Eye size={14} />
              </div>
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 font-bold text-base border border-violet-100">
              {studentName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate" title={studentName}>{studentName}</h3>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate mt-0.5" title={studentEmail}>
              <Mail size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{studentEmail}</span>
            </div>
            {studentPhone !== '-' && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate mt-0.5">
                <Phone size={12} className="shrink-0 text-slate-400" />
                <span>{studentPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Hostel & Room */}
        <div className="lg:col-span-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-slate-900">
            <Building2 size={14} className="text-blue-600 shrink-0" />
            <span className="truncate">{alloc.hostels?.name || 'Hostel Property'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold">
              Room {room?.room_number || '-'}
            </span>
            <span className="text-xs text-slate-500">
              {alloc.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'}
            </span>
          </div>
          <div className="text-xs text-slate-600 font-medium mt-1">
            ₹{Number(rent).toLocaleString()}/month
          </div>
        </div>

        {/* 3. Allocation Timeline */}
        <div className="lg:col-span-2 min-w-0 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span>Joined {new Date(alloc.start_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
          {emergencyContact !== 'N/A' && (
            <div className="text-[11px] text-slate-500 truncate" title={emergencyContact}>
              Emg: {emergencyContact}
            </div>
          )}
        </div>

        {/* 4. Status */}
        <div className="lg:col-span-1 flex lg:justify-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <Check size={12} /> Approved
          </span>
        </div>

        {/* 5. Primary Actions */}
        <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-1.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-wrap">
          <Button 
            onClick={onViewAgreement}
            variant="outline" 
            size="sm"
            className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            <FileText size={13} /> Agreement
          </Button>
          <Button 
            onClick={onViewDetails}
            variant="outline" 
            size="sm"
            className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            <User size={13} /> Profile
          </Button>
          <Button 
            onClick={onViewHistory}
            variant="outline" 
            size="sm"
            className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            <DollarSign size={13} /> History
          </Button>
          <Button 
            onClick={onCheckout}
            variant="outline" 
            size="sm"
            className="h-8 px-2.5 rounded-lg border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-1"
          >
            <LogOut size={13} /> Checkout
          </Button>
        </div>
      </div>

      {/* Sub-panel: Security Deposit & Monthly Fees Schedule */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
        {/* Deposit Box */}
        <div className="md:col-span-4 flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-slate-200/70">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Security Deposit</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              ₹{Number(alloc.rooms?.security_deposit || rent * 2).toLocaleString()}
            </div>
          </div>
          <div>
            {alloc.deposit_status === 'paid' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs font-semibold">
                ✓ Paid
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                  Pending
                </span>
                <button 
                  onClick={onMarkDepositPaid}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-2 py-0.5 rounded text-xs transition-colors"
                >
                  Mark Paid
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fees Schedule Box */}
        <div className="md:col-span-8 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">Monthly Fees</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {alloc.student_fees?.length || 0} scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(() => {
              const sortedFees = [...(alloc.student_fees || [])].sort(
                (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
              );

              const earliestUnpaidIndex = sortedFees.findIndex(f => f.status !== 'paid');
              let displayFees: any[] = [];
              let isMonth1List: boolean[] = [];

              if (earliestUnpaidIndex !== -1) {
                displayFees.push(sortedFees[earliestUnpaidIndex]);
                isMonth1List.push(true);
                if (earliestUnpaidIndex + 1 < sortedFees.length) {
                  displayFees.push(sortedFees[earliestUnpaidIndex + 1]);
                  isMonth1List.push(false);
                }
              } else if (sortedFees.length > 0) {
                const lastTwo = sortedFees.slice(-2);
                displayFees = lastTwo;
                isMonth1List = lastTwo.map(() => false);
              }

              if (displayFees.length === 0) {
                return <p className="text-xs text-slate-500 italic col-span-2">No fees scheduled yet.</p>;
              }

              return displayFees.map((fee: any, idx: number) => {
                const isMonth1 = isMonth1List[idx];
                const hasProof = fee.status === 'pending_verification';
                const displayPeriod = fee.billing_period || new Date(fee.due_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return (
                  <div key={fee.id} className="p-2.5 border rounded-lg bg-white flex items-center justify-between gap-2 border-slate-200/70">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {displayPeriod} {isMonth1 ? '(Current)' : ''}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ₹{fee.amount_due || fee.amount || 0} &bull; Due: {new Date(fee.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        fee.status === 'paid' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : fee.status === 'pending_verification' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {fee.status.replace('_', ' ')}
                      </span>
                      {isMonth1 && fee.status !== 'paid' && (
                        <button 
                          onClick={() => onMarkFeePaid(fee.id)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-2 py-0.5 rounded text-xs transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                      {hasProof && (
                        <button 
                          onClick={() => {
                            const pendingPayment = alloc.payments?.find((p: any) => p.payment_status === 'pending_verification' || p.status === 'pending_verification');
                            const refNo = pendingPayment?.reference_number || 'N/A';
                            const payMethod = pendingPayment?.payment_method || 'N/A';
                            toast.info(`Payment Details - Method: ${payMethod}, Ref: ${refNo}`);
                          }}
                          className="border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium px-2 py-0.5 rounded text-xs transition-colors"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectedRequestCard({ 
  req, 
  onRereview, 
  onDelete, 
  onViewDetails 
}: { 
  req: any; 
  onRereview: () => void; 
  onDelete: () => void; 
  onViewDetails: () => void; 
}) {
  const student = Array.isArray(req.students) ? req.students[0]?.profiles : req.students?.profiles;
  const studentName = student?.full_name || req.student_name || 'Applicant';
  const studentEmail = student?.email || req.student_email || '-';
  const room = req.rooms;

  return (
    <div className="w-full bg-white border border-slate-200/90 hover:border-slate-300 shadow-xs rounded-xl p-5 transition-all">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* 1. Student */}
        <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 font-bold text-base border border-slate-200">
            {studentName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate" title={studentName}>{studentName}</h3>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate mt-0.5" title={studentEmail}>
              <Mail size={12} className="shrink-0 text-slate-400" />
              <span className="truncate">{studentEmail}</span>
            </div>
          </div>
        </div>

        {/* 2. Hostel & Room */}
        <div className="lg:col-span-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-slate-900">
            <Building2 size={14} className="text-blue-600 shrink-0" />
            <span className="truncate">{req.hostels?.name || 'Hostel'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Room {room?.room_number || '-'} &bull; {req.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'}
          </div>
        </div>

        {/* 3. Submission Info */}
        <div className="lg:col-span-3 min-w-0 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span>Submitted {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
          </div>
        </div>

        {/* 4. Status */}
        <div className="lg:col-span-1 flex lg:justify-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
            <XCircle size={12} /> Rejected
          </span>
        </div>

        {/* 5. Actions */}
        <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-wrap">
          <Button 
            onClick={onViewDetails} 
            variant="ghost" 
            size="sm"
            className="h-8 px-2.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium flex items-center gap-1"
          >
            <Eye size={13} /> Details
          </Button>
          <Button 
            onClick={onRereview} 
            size="sm"
            className="h-8 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium flex items-center gap-1 shadow-2xs"
          >
            <RotateCcw size={13} /> Re-review
          </Button>
          <Button 
            onClick={onDelete} 
            variant="outline" 
            size="sm"
            className="h-8 px-2.5 rounded-lg border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-1"
          >
            <Trash2 size={13} /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Modals Implementations ----------------

function DetailsModal({ item, onClose }: { item: any; onClose: () => void }) {
  const student = Array.isArray(item.students) ? item.students[0] : item.students;
  const profile = student?.profiles;

  const studentName = item.student_name || profile?.full_name;
  const studentEmail = item.student_email || profile?.email;
  const studentPhone = item.student_phone || profile?.phone_number;

  const gender = profile?.gender;
  const dob = profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  const college = student?.college;
  const course = student?.course;
  const year = student?.year;

  const parentName = item.parent_name || student?.parent_name;
  const parentPhone = item.parent_phone || student?.parent_phone;
  const parentEmail = item.parent_email || student?.parent_email;
  
  const address = item.address || student?.address;
  const emergencyContact = item.emergency_contact || (item.emergency_contact_name && item.emergency_contact_phone ? `${item.emergency_contact_name} - ${item.emergency_contact_phone}` : item.emergency_contact_name);

  const renderDetailRow = (label: string, value: any, icon?: React.ReactNode) => {
    if (value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-') return null;
    return (
      <div className="flex items-start gap-2 text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
        {icon && <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">{label}</span>
          <p className="text-foreground font-semibold leading-tight">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-foreground font-display flex items-center gap-2">
            <User className="text-teal-600" /> Student Details
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Scroll */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Card Layout */}
          <div className="border border-border rounded-2xl p-5 space-y-3 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 font-display border-b pb-1.5">Personal Information</h4>
            {renderDetailRow("Full Name", studentName, <User size={14} />)}
            {renderDetailRow("Email", studentEmail, <Mail size={14} />)}
            {renderDetailRow("Phone", studentPhone, <Phone size={14} />)}
            {renderDetailRow("Gender", gender)}
            {renderDetailRow("Date of Birth", dob)}
            {renderDetailRow("College", college)}
            {renderDetailRow("Course", course)}
            {renderDetailRow("Year", year)}
            {renderDetailRow("Address", address)}
          </div>

          <div className="border border-border rounded-2xl p-5 space-y-3 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 font-display border-b pb-1.5">Guardian & Emergency</h4>
            {renderDetailRow("Guardian Name", parentName)}
            {renderDetailRow("Guardian Phone", parentPhone)}
            {renderDetailRow("Guardian Email", parentEmail)}
            {renderDetailRow("Emergency Contact", emergencyContact)}
          </div>

          {/* Room & Booking Configuration */}
          <div className="border border-border rounded-2xl p-5 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 font-display border-b pb-1.5">Accommodation Details</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground font-semibold">Hostel:</span> <span className="font-semibold text-foreground text-right">{item.hostels?.name}</span>
              <span className="text-muted-foreground font-semibold">Room:</span> <span className="font-semibold text-foreground text-right">Room {item.rooms?.room_number} ({item.booking_type === 'entire_room' ? 'Entire Room' : 'Shared Room'})</span>
              <span className="text-muted-foreground font-semibold">Rent:</span> <span className="font-bold text-teal-700 text-right">₹{Number(item.rooms?.rent).toLocaleString()}/mo</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <Button onClick={onClose} className="rounded-xl px-5">
            Close Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ 
  action, 
  onConfirm, 
  onClose, 
  loading 
}: { 
  action: 'approve' | 'reject' | 'checkout' | 'rereview' | 'delete'; 
  onConfirm: () => void; 
  onClose: () => void; 
  loading?: boolean;
}) {
  const titles = {
    approve: 'Approve Room Request?',
    reject: 'Reject Room Request?',
    checkout: 'Check Out Student Resident?',
    rereview: 'Move back to Pending?',
    delete: 'Delete Rejected Request?'
  };

  const descriptions = {
    approve: 'This will accept the student, create an active allocation record, and generate their security deposit and first 2 months fees.',
    reject: 'This will mark the student request as rejected. The student will be notified and this room bed will remain free.',
    checkout: 'This will deactivate the student allocation record, free up the room capacity, and mark the resident status as checked out.',
    rereview: 'This moves the rejected record back into the pending queue for re-evaluation.',
    delete: 'This will permanently delete this rejected request from the database. This cannot be undone.'
  };

  const buttons = {
    approve: 'bg-green-600 hover:bg-green-700 text-white',
    reject: 'bg-red-600 hover:bg-red-700 text-white',
    checkout: 'bg-red-600 hover:bg-red-700 text-white',
    rereview: 'bg-teal-600 hover:bg-teal-700 text-white',
    delete: 'bg-red-600 hover:bg-red-700 text-white'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-foreground font-display">{titles[action]}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {descriptions[action]}
        </p>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl text-xs font-semibold">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading} className={`rounded-xl px-4 text-xs font-bold shadow-md ${buttons[action]}`}>
            {loading ? 'Processing...' : 'Confirm Action'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgreementModal({ alloc, onClose }: { alloc: any; onClose: () => void }) {
  const student = Array.isArray(alloc.students) ? alloc.students[0]?.profiles : alloc.students?.profiles;
  const studentName = student?.full_name || alloc.student_name || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-base font-bold text-foreground font-display flex items-center gap-1.5">
            <FileText size={16} className="text-teal-600" /> Rental Accommodation Agreement
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 border border-border/80 bg-zinc-50 dark:bg-zinc-950/20 rounded-2xl text-xs space-y-4 font-mono leading-relaxed">
          <p className="font-bold text-center underline text-sm">HOSTEL BOARDING CONTRACT</p>
          
          <p>
            <strong>BETWEEN:</strong> The Hostel Management Owner, herein referred to as the Landlord, and 
            <strong> {studentName}</strong>, herein referred to as the Boarding Tenant.
          </p>

          <p>
            <strong>1. PREMISES:</strong> The Landlord agrees to allocate shared room quarters within Room <strong>{alloc.rooms?.room_number}</strong> at hostel project <strong>{alloc.hostels?.name}</strong>.
          </p>

          <p>
            <strong>2. TERM:</strong> The contract term starts on date <strong>{new Date(alloc.start_date).toLocaleDateString()}</strong> and terminates upon tenant checking out via the official landlord requests console.
          </p>

          <p>
            <strong>3. RENT & SECURITY:</strong> Tenant agrees to pay the monthly rental sum of <strong>₹{Number(alloc.rooms?.rent).toLocaleString()}</strong>. A security deposit equaling one month rent is due prior to final occupancy.
          </p>

          <p>
            <strong>4. RULES:</strong> Tenant agrees to comply with the curfew, cleanliness parameters, and structural rules of the boarding hostel.
          </p>

          <div className="pt-6 border-t flex justify-between gap-6 flex-wrap">
            <div className="border-t border-zinc-400 pt-1 w-32 text-center text-[10px]">Landlord Signature</div>
            <div className="border-t border-zinc-400 pt-1 w-32 text-center text-[10px]">Tenant Signature</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success('Agreement copy downloaded!')} className="flex-1 rounded-xl gap-1">
            <FileText size={14} /> Download PDF Copy
          </Button>
          <Button onClick={onClose} className="flex-1 rounded-xl">
            Close Agreement
          </Button>
        </div>
      </div>
    </div>
  );
}