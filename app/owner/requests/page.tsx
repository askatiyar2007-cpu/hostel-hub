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
  Home, 
  AlertTriangle, 
  Inbox, 
  Building2, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  FileText, 
  QrCode, 
  LogOut, 
  Eye, 
  RotateCcw,
  BookOpen,
  Check,
  X,
  DollarSign
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

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [OwnerRequestsPage] Component mounted. Invalidating allocations & requests cache to force refetch...`);
    qc.invalidateQueries({ queryKey: ['owner-room-allocations'] });
    qc.invalidateQueries({ queryKey: ['owner-room-requests'] });
  }, [qc]);

  // Modal control states
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<any | null>(null);
  const [selectedConfirmAction, setSelectedConfirmAction] = useState<{ type: 'approve' | 'reject' | 'checkout' | 'rereview'; id: string; req?: any } | null>(null);
  const [qrCodeModalData, setQrCodeModalData] = useState<any | null>(null);
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
            rent
          ),
          hostels!inner(
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
          rooms(
            id,
            room_number,
            capacity,
            occupancy,
            occupied_count,
            occupied_beds,
            rent,
            security_deposit
          ),
          hostels!inner(
            name,
            owner_id
          )
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
      // student_name/email/phone come directly from the allocation row (snapshot stored at approval time)
      const mappedData = (data ?? []).map((alloc: any) => {
        const allocFees = (feesData ?? []).filter((f: any) => f.allocation_id === alloc.id);
        const allocPayments = (paymentsData ?? []).filter((p: any) => p.allocation_id === alloc.id);
        const studentReq = requestsByStudentId.get(alloc.student_id);

        const hasPaidDeposit = allocPayments.some(
          (p: any) => !p.student_fees_id && p.payment_status === 'completed'
        );

        const studentInfo = studentsMap.get(alloc.student_id) || null;

        return {
          ...alloc,
          students: {
            id: alloc.student_id,
            profiles: {
              full_name: studentInfo?.profiles?.full_name || alloc.student_name || null,
              email: studentInfo?.profiles?.email || alloc.student_email || null,
              phone_number: studentInfo?.profiles?.phone_number || alloc.student_phone || null,
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
    onSuccess: (data: any) => {
      const feesCount = data?.fees_count || data?.feesCount || 0;
      toast.success(`Request approved • ${feesCount} FEES`);
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
          
        const matchesHostel = hostelFilter === 'all' || item.hostels?.name === hostelFilter;
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
  const uniqueHostels = Array.from(new Set(requests?.map((r: any) => r.hostels?.name).filter(Boolean) || []));
  const uniqueRooms = Array.from(new Set(requests?.map((r: any) => r.rooms?.room_number).filter(Boolean) || []));

  const visiblePending = getFilteredItems(pendingRequests);
  const visibleApproved = getFilteredItems(approvedAllocations);
  const visibleRejected = getFilteredItems(rejectedRequests);

  const activeItemsCount = 
    activeTab === 'pending' ? visiblePending.length :
    activeTab === 'approved' ? visibleApproved.length : visibleRejected.length;

  if (isRequestsLoading || isAllocationsLoading || approveMutation.isPending || checkoutMutation.isPending || rejectMutation.isPending || rereviewMutation.isPending) {
    return (
      <DashboardShell title="Room Requests & Allocations" subtitle="Processing database updates..." badge="Owner">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">
              {approveMutation.isPending 
                ? "Approving request and generating fees..." 
                : checkoutMutation.isPending 
                ? "Checking out student and updating occupancy..." 
                : rejectMutation.isPending
                ? "Rejecting request..."
                : rereviewMutation.isPending
                ? "Moving request back to pending..."
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
      title="Room Requests & Allocations" 
      subtitle={`Manage room request approvals, boarding occupancy, and checkout routines.`} 
      badge="Owner"
    >
      {/* 1. Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2 pb-px justify-between items-center flex-wrap">
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
            className="flex items-center gap-1.5 h-9 rounded-xl border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm"
          >
            <RotateCcw size={14} className={isRequestsLoading || isAllocationsLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search by student, email, phone or parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-border/80 focus-visible:ring-orange-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <SlidersHorizontal size={14} /> Filters:
          </div>

          {/* Filter by Hostel */}
          <select 
            value={hostelFilter}
            onChange={(e) => setHostelFilter(e.target.value)}
            className="h-10 text-xs px-3 bg-transparent border border-border rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none"
          >
            <option value="all">All Hostels</option>
            {uniqueHostels.map((hostel: any) => (
              <option key={hostel} value={hostel}>{hostel}</option>
            ))}
          </select>

          {/* Filter by Room */}
          <select 
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="h-10 text-xs px-3 bg-transparent border border-border rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none"
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
            className="text-orange-500 hover:underline"
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
            <div className="flex flex-col gap-6">
              {visiblePending.map((req: any) => (
                <PendingRequestCard 
                  key={req.id} 
                  req={req} 
                  onApprove={() => setSelectedConfirmAction({ type: 'approve', id: req.id, req })}
                  onReject={() => setSelectedConfirmAction({ type: 'reject', id: req.id })}
                  onViewDetails={() => {
                    setSelectedDetailsItem(req);
                  }}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'approved' && (
          visibleApproved.length === 0 ? (
            <EmptyState message="No active approved allocations found." />
          ) : (
            <div className="flex flex-col gap-6">
              {visibleApproved.map((alloc: any) => (
                <ApprovedAllocationCard 
                  key={alloc.id} 
                  alloc={alloc} 
                  onCheckout={() => setSelectedConfirmAction({ type: 'checkout', id: alloc.id })}
                  onViewQR={() => setQrCodeModalData(alloc)}
                  onViewAgreement={() => setAgreementModalData(alloc)}
                  onViewDetails={() => {
                    setSelectedDetailsItem(alloc);
                  }}
                  onMarkDepositPaid={() => setSelectedDepositAlloc(alloc)}
                  onMarkFeePaid={(feeId) => {
                    setSelectedFeeAlloc(alloc);
                    setSelectedFeeId(feeId);
                  }}
                  onViewHistory={() => setSelectedHistoryAlloc(alloc)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'rejected' && (
          visibleRejected.length === 0 ? (
            <EmptyState message="No rejected requests found." />
          ) : (
            <div className="flex flex-col gap-6">
              {visibleRejected.map((req: any) => (
                <RejectedRequestCard 
                  key={req.id} 
                  req={req} 
                  onRereview={() => setSelectedConfirmAction({ type: 'rereview', id: req.id })}
                  onViewDetails={() => {
                    setSelectedDetailsItem(req);
                  }}
                />
              ))}
            </div>
          )
        )}
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
            }
          }}
          onClose={() => setSelectedConfirmAction(null)}
          loading={approveMutation.isPending || rejectMutation.isPending || rereviewMutation.isPending || checkoutMutation.isPending}
        />
      )}

      {/* 6. QR Code Display Modal */}
      {qrCodeModalData && (
        <QrCodeModal 
          alloc={qrCodeModalData}
          onClose={() => setQrCodeModalData(null)}
        />
      )}

      {/* 7. Agreement PDF Modal */}
      {agreementModalData && (
        <AgreementModal 
          alloc={agreementModalData}
          onClose={() => setAgreementModalData(null)}
        />
      )}

      {/* 8. Mark Deposit Paid Modal */}
      {selectedDepositAlloc && (
        <MarkDepositPaidModal
          alloc={selectedDepositAlloc}
          ownerUserId={user?.id}
          onClose={() => setSelectedDepositAlloc(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-room-allocations'] })}
        />
      )}

      {/* 9. Mark Monthly Fee Paid Modal */}
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

      {/* 10. Payment History Modal */}
      {selectedHistoryAlloc && (
        <PaymentHistoryModal
          alloc={selectedHistoryAlloc}
          onClose={() => setSelectedHistoryAlloc(null)}
        />
      )}
    </DashboardShell>
  );
}

// ---------------- Helper Components ----------------

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all whitespace-nowrap ${
        active 
          ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/5' 
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300'
      }`}
    >
      {label}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        active 
          ? 'bg-orange-500 text-white' 
          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
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

function RoomCapacityIndicator({ room }: { room: any }) {
  if (!room) return null;
  const capacity = room.capacity || 1;
  const occupancy = room.occupancy ?? room.occupied_count ?? room.occupied_beds ?? 0;
  const percentage = Math.min(100, Math.round((occupancy / capacity) * 100));
  
  let badgeColor = 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
  let badgeText = 'AVL';
  
  if (occupancy >= capacity) {
    badgeColor = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
    badgeText = 'FULL';
  } else if (percentage >= 75) {
    badgeColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
    badgeText = 'LOW';
  }
  
  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">Capacity ({occupancy}/{capacity} occupied):</span>
        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${badgeColor}`}>
          {badgeText}
        </span>
      </div>
      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            occupancy >= capacity ? 'bg-red-500' : percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CardInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground/80 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">{label}</span>
        <p className="text-foreground font-medium leading-tight truncate">{value || '-'}</p>
      </div>
    </div>
  );
}

// ---------------- Card Implementations ----------------

function PendingRequestCard({ req, onApprove, onReject, onViewDetails }: { req: any; onApprove: () => void; onReject: () => void; onViewDetails: () => void }) {
  const student = Array.isArray(req.students) ? req.students[0]?.profiles : req.students?.profiles;
  const studentName = student?.full_name || req.student_name || '-';
  const studentEmail = student?.email || req.student_email || '-';
  const studentPhone = student?.phone_number || req.student_phone || '-';
  
  const room = req.rooms;
  const capacity = room?.capacity ?? 0;
  const occupancy = room?.occupancy ?? room?.occupied_count ?? room?.occupied_beds ?? 0;
  const freeSlots = capacity - occupancy;

  return (
    <div className="max-w-[750px] w-full mx-auto bg-card border border-border hover:border-orange-500/20 hover:shadow-lg transition-all duration-300 rounded-2xl p-6 space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold text-lg font-display">
            {studentName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground font-display leading-tight">{studentName}</h3>
            <span className="text-xs text-muted-foreground mt-1 block">
              Requested on {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 ring-1 ring-amber-600/10">
          <Clock size={12} className="animate-pulse" /> Pending
        </span>
      </div>

      {/* Grid: Student Info */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-display">Student Contact</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
          <CardInfoRow icon={<Mail size={14} />} label="Email" value={studentEmail} />
          <CardInfoRow icon={<Phone size={14} />} label="Phone" value={studentPhone} />
          <CardInfoRow icon={<BookOpen size={14} />} label="Emerg. Contact" value={req.emergency_contact || (req.emergency_contact_name && req.emergency_contact_phone ? `${req.emergency_contact_name} - ${req.emergency_contact_phone}` : req.emergency_contact_name || 'N/A')} />
        </div>
      </div>

      {/* Requested Room Details */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-display">Requested Accommodation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
          <div className="space-y-3">
            <CardInfoRow icon={<Building2 size={14} />} label="Hostel" value={req.hostels?.name} />
            <CardInfoRow icon={<Home size={14} />} label="Room / Type" value={`Room ${room?.room_number} (${req.booking_type === 'entire_room' ? 'Private' : 'Shared Bed'})`} />
            <CardInfoRow icon={<Mail size={14} />} label="Rent Details" value={`₹${Number(room?.rent).toLocaleString()}/month`} />
          </div>
          <div className="flex items-center justify-center">
            <RoomCapacityIndicator room={room} />
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button 
          onClick={onApprove} 
          disabled={freeSlots <= 0}
          className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-green-500/10"
        >
          <CheckCircle2 size={16} /> Approve Allocation
        </Button>
        <Button 
          onClick={onReject} 
          variant="outline" 
          className="flex-1 h-11 rounded-xl border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-semibold flex items-center justify-center gap-1.5"
        >
          <XCircle size={16} /> Reject Request
        </Button>
        <Button 
          onClick={onViewDetails} 
          variant="ghost" 
          className="h-11 px-4 rounded-xl text-muted-foreground hover:text-foreground font-semibold flex items-center justify-center gap-1"
        >
          <Eye size={16} /> Details
        </Button>
      </div>
      {freeSlots <= 0 && (
        <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300 rounded-xl flex items-center gap-2 text-xs font-semibold border border-red-100 dark:border-red-900/50">
          <AlertTriangle size={14} /> Approval is blocked because the requested room is currently full.
        </div>
      )}
    </div>
  );
}

function ApprovedAllocationCard({ 
  alloc, 
  onCheckout, 
  onViewQR, 
  onViewAgreement, 
  onViewDetails,
  onMarkDepositPaid,
  onMarkFeePaid,
  onViewHistory
}: { 
  alloc: any; 
  onCheckout: () => void; 
  onViewQR: () => void; 
  onViewAgreement: () => void; 
  onViewDetails: () => void;
  onMarkDepositPaid: () => void;
  onMarkFeePaid: (feeId: string) => void;
  onViewHistory: () => void;
}) {
  const student = Array.isArray(alloc.students) ? alloc.students[0]?.profiles : alloc.students?.profiles;
  const studentName = student?.full_name || alloc.student_name || '-';
  const studentEmail = student?.email || alloc.student_email || '-';
  const studentPhone = student?.phone_number || alloc.student_phone || '-';

  const room = alloc.rooms;
  const rent = room?.rent ?? 0;

  return (
    <div className="max-w-[750px] w-full mx-auto bg-green-50/10 dark:bg-green-950/5 border border-green-200 dark:border-green-900/50 hover:shadow-lg transition-all duration-300 rounded-2xl p-6 space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-green-100 dark:border-green-900/30 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-bold text-lg font-display">
            {studentName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground font-display leading-tight">{studentName}</h3>
            <span className="text-xs text-muted-foreground mt-1 block">
              Allocation Active &bull; Joined {new Date(alloc.start_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
            <Check size={12} /> Approved
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
            {alloc.fees_count || alloc.student_fees?.length || 0} FEES
          </span>
        </div>
      </div>

      {/* Allocation Details */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 font-display">Allocation Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-green-50/20 dark:bg-green-950/10 p-4 rounded-2xl border border-green-100/50 dark:border-green-900/20">
          <div className="space-y-3">
            <CardInfoRow icon={<Building2 size={14} />} label="Hostel" value={alloc.hostels?.name} />
            <CardInfoRow icon={<Home size={14} />} label="Room Allocated" value={`Room ${room?.room_number} (${alloc.booking_type === 'entire_room' ? 'Private' : 'Shared Bed'})`} />
            <CardInfoRow icon={<Mail size={14} />} label="Monthly Rent" value={`₹${Number(rent).toLocaleString()}`} />
          </div>
          <div className="flex items-center justify-center">
            <RoomCapacityIndicator room={room} />
          </div>
        </div>
      </div>

      {/* Student Contact Info & Security Deposit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 font-display">Student Contact</h4>
          <div className="bg-card border border-border p-4 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Mail size={12} className="text-muted-foreground" />
              <span className="text-foreground font-semibold truncate">{studentEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Phone size={12} className="text-muted-foreground" />
              <span className="text-foreground font-semibold">{studentPhone}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 font-display">Security Deposit & Payment</h4>
          <div className="bg-card border border-border p-4 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-semibold">Security Deposit:</span>
              {alloc.deposit_status === 'paid' ? (
                <span className="text-green-600 font-bold flex items-center gap-0.5">✓ Paid</span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-orange-500 font-bold">📋 Pending</span>
                  <button 
                    onClick={onMarkDepositPaid}
                    className="bg-primary hover:bg-primary/95 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-colors"
                  >
                    Mark Paid
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs pt-1 border-t mt-1">
              <span className="text-muted-foreground font-semibold">Deposit Amount:</span>
              <span className="text-foreground font-bold">₹{Number(alloc.rooms?.security_deposit || rent * 2).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Fees Section */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 font-display flex justify-between items-center">
          <span>Monthly Fees Schedule</span>
          <span className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {alloc.student_fees?.length || 0} Scheduled
          </span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
          {!alloc.student_fees || alloc.student_fees.length === 0 ? (
            <p className="text-xs text-muted-foreground italic col-span-2">No fees scheduled yet.</p>
          ) : (
            alloc.student_fees.map((fee: any) => {
              const hasProof = fee.status === 'pending_verification';
              const displayPeriod = fee.billing_period || new Date(fee.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return (
                <div key={fee.id} className="p-3 border rounded-xl bg-card flex flex-col justify-between gap-2 shadow-sm border-border/60">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-xs text-foreground block">{displayPeriod}</span>
                      <span className="text-[10px] text-muted-foreground">Due: {new Date(fee.due_date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-bold text-xs text-foreground">₹{fee.amount_due || fee.amount || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1 border-t border-dashed">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      fee.status === 'paid' 
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300' 
                        : fee.status === 'pending_verification' 
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300' 
                        : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                    }`}>
                      {fee.status.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {fee.status !== 'paid' && (
                        <button 
                          onClick={() => onMarkFeePaid(fee.id)}
                          className="bg-primary hover:bg-primary/95 text-white font-bold px-2 py-0.5 rounded text-[10px] transition-colors"
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
                          className="border text-foreground hover:bg-muted font-bold px-2 py-0.5 rounded text-[10px] transition-colors"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-green-100 dark:border-green-900/30">
        <Button 
          onClick={onViewAgreement}
          variant="outline" 
          size="sm"
          className="rounded-xl border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 text-xs font-semibold gap-1.5"
        >
          <FileText size={14} /> Agreement
        </Button>
        <Button 
          onClick={onViewQR}
          variant="outline" 
          size="sm"
          className="rounded-xl border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 text-xs font-semibold gap-1.5"
        >
          <QrCode size={14} /> QR Code
        </Button>
        <Button 
          onClick={onViewDetails}
          variant="outline" 
          size="sm"
          className="rounded-xl border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 text-xs font-semibold gap-1.5"
        >
          <User size={14} /> Student Profile
        </Button>
        <Button 
          onClick={onViewHistory}
          variant="outline" 
          size="sm"
          className="rounded-xl border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 text-xs font-semibold gap-1.5"
        >
          <DollarSign size={14} /> Payment History
        </Button>
        <div className="flex-1" />
        <Button 
          onClick={onCheckout}
          variant="outline" 
          size="sm"
          className="rounded-xl border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 text-xs font-bold gap-1 shadow-sm"
        >
          <LogOut size={14} /> Check Out
        </Button>
      </div>
    </div>
  );
}

function RejectedRequestCard({ req, onRereview, onViewDetails }: { req: any; onRereview: () => void; onViewDetails: () => void }) {
  const student = Array.isArray(req.students) ? req.students[0]?.profiles : req.students?.profiles;
  const studentName = student?.full_name || req.student_name || '-';
  const studentEmail = student?.email || req.student_email || '-';
  
  const room = req.rooms;

  return (
    <div className="max-w-[750px] w-full mx-auto bg-zinc-50/50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold text-lg font-display">
            {studentName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground font-display leading-tight">{studentName}</h3>
            <span className="text-xs text-muted-foreground mt-1 block">
              Rejected Request &bull; Submitted {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300">
          <XCircle size={12} /> Rejected
        </span>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/10 p-4 rounded-xl border border-border/50 text-xs">
        <div className="space-y-2">
          <div>
            <span className="text-muted-foreground font-semibold">Email Contact:</span>
            <span className="text-foreground ml-1.5 font-bold truncate">{studentEmail}</span>
          </div>
          <div>
            <span className="text-muted-foreground font-semibold">Hostel / Room:</span>
            <span className="text-foreground ml-1.5 font-bold">{req.hostels?.name} &bull; Room {room?.room_number}</span>
          </div>
        </div>
        <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-4">
          <div className="text-red-600 dark:text-red-400 font-semibold flex items-start gap-1">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Reason: Capacity parameters exceeded or client request conflict.</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button 
          onClick={onViewDetails} 
          variant="outline" 
          size="sm"
          className="rounded-xl border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 text-xs font-semibold gap-1"
        >
          <Eye size={14} /> View Details
        </Button>
        <Button 
          onClick={onRereview} 
          size="sm"
          className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1 shadow-sm"
        >
          <RotateCcw size={14} /> Re-review
        </Button>
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
            <User className="text-orange-500" /> Student Details
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Scroll */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Card Layout */}
          <div className="border border-border rounded-2xl p-5 space-y-3 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-display border-b pb-1.5">Personal Information</h4>
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-display border-b pb-1.5">Guardian & Emergency</h4>
            {renderDetailRow("Guardian Name", parentName)}
            {renderDetailRow("Guardian Phone", parentPhone)}
            {renderDetailRow("Guardian Email", parentEmail)}
            {renderDetailRow("Emergency Contact", emergencyContact)}
          </div>

          {/* Room & Booking Configuration */}
          <div className="border border-border rounded-2xl p-5 bg-muted/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 font-display border-b pb-1.5">Accommodation Details</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground font-semibold">Hostel:</span> <span className="font-semibold text-foreground text-right">{item.hostels?.name}</span>
              <span className="text-muted-foreground font-semibold">Room:</span> <span className="font-semibold text-foreground text-right">Room {item.rooms?.room_number} ({item.booking_type === 'entire_room' ? 'Private' : 'Shared Bed'})</span>
              <span className="text-muted-foreground font-semibold">Rent:</span> <span className="font-bold text-primary text-right">₹{Number(item.rooms?.rent).toLocaleString()}/mo</span>
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

function ConfirmationModal({ action, onConfirm, onClose, loading }: { action: 'approve' | 'reject' | 'checkout' | 'rereview'; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  const titles = {
    approve: 'Approve Request & Allocate Room?',
    reject: 'Reject Room Request?',
    checkout: 'Checkout Student?',
    rereview: 'Move back to pending review?'
  };

  const descriptions = {
    approve: 'This will issue a room allocation, block the room space/beds, and send a notification update to the student.',
    reject: 'This will reject the student request. You can re-review this decision later if required.',
    checkout: 'This action marks the student allocation as inactive, frees the bed, and archives their check-in details. This is irreversible.',
    rereview: 'This moves the rejected record back into the pending queue for re-evaluation.'
  };

  const buttons = {
    approve: 'bg-green-600 hover:bg-green-700 text-white',
    reject: 'bg-red-600 hover:bg-red-700 text-white',
    checkout: 'bg-red-600 hover:bg-red-700 text-white',
    rereview: 'bg-orange-600 hover:bg-orange-700 text-white'
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

function QrCodeModal({ alloc, onClose }: { alloc: any; onClose: () => void }) {
  const student = Array.isArray(alloc.students) ? alloc.students[0]?.profiles : alloc.students?.profiles;
  const studentName = student?.full_name || alloc.student_name || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl text-center space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-bold text-foreground font-display flex items-center gap-1.5">
            <QrCode size={16} className="text-orange-500" /> Digital Check-In QR
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl inline-flex items-center justify-center border border-zinc-200 shadow-inner">
          {/* Simulated QR Code using plain SVG vectors */}
          <svg className="h-44 w-44 text-zinc-900" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="none" />
            <rect x="10" y="10" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
            <rect x="65" y="10" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
            <rect x="10" y="65" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
            <rect x="15" y="15" width="15" height="15" fill="currentColor" />
            <rect x="70" y="15" width="15" height="15" fill="currentColor" />
            <rect x="15" y="70" width="15" height="15" fill="currentColor" />
            {/* Inner pixels */}
            <rect x="45" y="10" width="10" height="10" fill="currentColor" />
            <rect x="45" y="25" width="5" height="20" fill="currentColor" />
            <rect x="10" y="45" width="15" height="5" fill="currentColor" />
            <rect x="30" y="45" width="20" height="15" fill="currentColor" />
            <rect x="55" y="65" width="30" height="10" fill="currentColor" />
            <rect x="65" y="45" width="15" height="15" fill="currentColor" />
            <rect x="85" y="80" width="10" height="15" fill="currentColor" />
          </svg>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">{studentName}</p>
          <p className="text-xs text-muted-foreground">Allocation ID: {alloc.id.substring(0, 8)}...</p>
        </div>

        <Button onClick={onClose} className="w-full rounded-xl">
          Close QR
        </Button>
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
            <FileText size={16} className="text-orange-500" /> Rental Accommodation Agreement
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
