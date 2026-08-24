/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, Search, BedDouble, CheckCircle2, ShieldCheck, Clock,
  User, MapPin, Shield
} from 'lucide-react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import type { Hostel } from '@/types/database';

type Step = 'hostel' | 'room' | 'details' | 'otp' | 'done';

const ROOM_TYPE_COLORS: Record<string, string> = {
  single: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-300',
  double: 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950 dark:border-violet-800 dark:text-violet-300',
  triple: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300',
  quad: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300',
};

export default function RoomRequestPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('hostel');
  const [detailsSubStep, setDetailsSubStep] = useState(1);
  const [hostelIdInput, setHostelIdInput] = useState('');
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [details, setDetails] = useState({
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
  });

  const [bookingType, setBookingType] = useState<'shared' | 'entire_room'>('shared');
  const [showOccupancyAlert, setShowOccupancyAlert] = useState(false);

  // ------------------------------------------------------------
  // STUDENT RECORD
  // ------------------------------------------------------------

  const { data: studentRecord } = useQuery({
    queryKey: ['student-record', profile?.id],
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          profile_id,
          status,
          created_at,
          profiles (
            full_name,
            email,
            phone_number
          )
        `)
        .eq('profile_id', profile!.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching student record:', error);
        throw error;
      }

      return data;
    },
  });

  // ------------------------------------------------------------
  // PRE-FILL STUDENT INFORMATION
  // ------------------------------------------------------------

  useEffect(() => {
    if (studentRecord) {
      setDetails(prev => ({
        ...prev,
        student_name:
          prev.student_name ||
          (studentRecord.profiles as any)?.full_name ||
          '',
        student_email:
          prev.student_email ||
          (studentRecord.profiles as any)?.email ||
          '',
        student_phone:
          prev.student_phone ||
          (studentRecord.profiles as any)?.phone_number ||
          '',
      }));
    } else if (profile) {
      setDetails(prev => ({
        ...prev,
        student_name: prev.student_name || profile.full_name || '',
        student_email: prev.student_email || profile.email || '',
        student_phone: prev.student_phone || profile.phone_number || '',
      }));
    }
  }, [studentRecord, profile]);

  // ------------------------------------------------------------
  // MY ROOM REQUESTS
  // ------------------------------------------------------------

  const { data: myRequests } = useQuery({
    queryKey: ['my-room-requests', studentRecord?.id],
    enabled: !!studentRecord?.id,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_requests')
        .select('*, rooms(room_number, room_type, rent), hostels(name)')
        .eq('student_id', studentRecord!.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching room requests:', error);
      }

      return data ?? [];
    },
  });

  // ------------------------------------------------------------
  // ACTIVE ROOM ALLOCATION
  // ------------------------------------------------------------

  const {
    data: activeAllocation,
    isLoading: isAllocationLoading,
  } = useQuery({
    queryKey: ['active-allocation-simple', studentRecord?.id],
    enabled: !!studentRecord?.id,
    staleTime: 10 * 1000,
    queryFn: async () => {
      // Direct allocation query for the CURRENT student.
      // This is allowed by the existing RLS policy.
      const {
        data: allocation,
        error: simpleAllocError,
      } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('student_id', studentRecord!.id)
        .eq('active', true)
        .maybeSingle();

      if (simpleAllocError) {
        console.error(
          'Error fetching active allocation directly:',
          simpleAllocError
        );
        throw simpleAllocError;
      }

      if (!allocation) return null;

      // Manually join rooms and hostels.
      const {
        data: roomData,
        error: roomError,
      } = await supabase
        .from('rooms')
        .select('*, hostels(*)')
        .eq('id', allocation.room_id)
        .single();

      if (roomError) {
        console.error(
          'Error fetching room and hostel details for allocation:',
          roomError
        );

        return {
          ...allocation,
          rooms: null,
          hostels: null,
        };
      }

      return {
        ...allocation,
        rooms: roomData,
        hostels: roomData?.hostels,
      };
    },
  });

  // ------------------------------------------------------------
  // ROOMS
  //
  // IMPORTANT:
  // We DO NOT query room_allocations directly here.
  //
  // A student is not allowed to see other students' allocations
  // because of RLS. Therefore direct SELECT from room_allocations
  // would make a full room appear empty.
  //
  // Instead we use:
  //
  // public.get_room_actual_occupancy(p_room_id)
  //
  // This is SECURITY DEFINER and is the authoritative occupancy
  // calculation.
  // ------------------------------------------------------------

  const {
    data: rooms,
    isLoading: roomsLoading,
    refetch,
  } = useQuery({
    queryKey: ['hostel-rooms', hostel?.id],
    enabled: !!hostel?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,

    queryFn: async () => {
      // First get all rooms belonging to the selected hostel.
      const {
        data: roomsData,
        error: roomsError,
      } = await supabase
        .from('rooms')
        .select(
          'id, hostel_id, type, room_type, capacity, rent, room_number, facilities, available'
        )
        .eq('hostel_id', hostel!.id);

      if (roomsError) {
        throw roomsError;
      }

      // IMPORTANT:
      // Get real occupancy through the SECURITY DEFINER RPC.
      //
      // Do NOT query room_allocations directly from the browser.
      const roomsWithRealOccupancy = await Promise.all(
        (roomsData ?? []).map(async (room: any) => {
          const {
            data: occupiedCount,
            error: occupancyError,
          } = await supabase.rpc('get_room_actual_occupancy', {
            p_room_id: room.id,
          });

          if (occupancyError) {
            console.error(
              `Error fetching occupancy for room ${room.id}:`,
              occupancyError
            );

            // We deliberately do NOT pretend the room is empty
            // when the authoritative occupancy check fails.
            return {
              ...room,
              room_type: room.type || room.room_type || 'double',
              occupied_beds: room.capacity,
              occupancy: room.capacity,
              occupancy_error: true,
            };
          }

          const realOccupiedCount = Math.max(
            0,
            Math.min(
              room.capacity,
              Number(occupiedCount ?? 0)
            )
          );

          return {
            ...room,
            room_type: room.type || room.room_type || 'double',
            occupied_beds: realOccupiedCount,
            occupancy: realOccupiedCount,
            occupancy_error: false,
          };
        })
      );

      return roomsWithRealOccupancy;
    },
  });

  // ------------------------------------------------------------
  // REFRESH ROOM OCCUPANCY WHEN HOSTEL CHANGES
  // ------------------------------------------------------------

  useEffect(() => {
    if (hostel?.id) {
      refetch();
    }
  }, [hostel?.id, refetch]);

  // ------------------------------------------------------------
  // HOSTEL LOOKUP
  // ------------------------------------------------------------

  const lookupHostel = useCallback(async () => {
    if (!hostelIdInput.trim()) {
      toast.error('Please enter a Hostel ID');
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', hostelIdInput.trim())
        .maybeSingle();

      if (error || !data) {
        toast.error('Hostel not found');
        return;
      }

      setHostel(data as Hostel);
      setSelectedRoom(null);
      setStep('room');
    } catch (e) {
      console.error('Hostel lookup error:', e);
      toast.error('Hostel not found');
    }
  }, [hostelIdInput]);

  // ------------------------------------------------------------
  // SEND OTP
  // ------------------------------------------------------------

  const sendOtp = useCallback(async () => {
    if (!selectedRoom?.id || !hostel?.id) {
      toast.error('Please select a room first');
      return;
    }

    setOtpLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(
        '/api/room-request/request-otp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            hostelId: hostel.id,
            roomId: selectedRoom.id,
            bookingType,
            details,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setOtpSent(true);

        toast.success(data.message, {
          duration: 8000,
        });
      } else {
        toast.error(
          data.error || 'Failed to send verification code'
        );
      }
    } catch (e: any) {
      console.error('Send OTP error:', e);

      toast.error(
        e.message || 'Failed to send verification code'
      );
    } finally {
      setOtpLoading(false);
    }
  }, [
    hostel,
    selectedRoom,
    bookingType,
    details,
  ]);

  // ------------------------------------------------------------
  // VERIFY OTP
  // ------------------------------------------------------------

  const verifyOtp = useCallback(async () => {
    if (!otp.trim()) {
      toast.error('Please enter the verification code');
      return;
    }

    setOtpLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(
        '/api/room-request/verify-otp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: profile?.email,
            otp: otp.trim(),
            hostelId: hostel?.id,
            roomId: selectedRoom?.id,
            bookingType,
            details,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success(
          'Room request submitted successfully!'
        );

        qc.invalidateQueries({
          queryKey: ['my-room-requests'],
        });

        qc.invalidateQueries({
          queryKey: ['hostel-rooms'],
        });

        setStep('done');
      } else {
        toast.error(
          data.error || 'Failed to verify code'
        );
      }
    } catch (e: any) {
      console.error('Verify OTP error:', e);

      toast.error(
        e.message || 'Failed to verify code'
      );
    } finally {
      setOtpLoading(false);
    }
  }, [
    otp,
    profile,
    hostel,
    selectedRoom,
    bookingType,
    details,
    qc,
  ]);

  // ------------------------------------------------------------
  // STATUS BADGE
  // ------------------------------------------------------------

  const StatusBadge = ({
    status,
  }: {
    status: string;
  }) => {
    const map: Record<
      string,
      {
        cls: string;
        label: string;
      }
    > = {
      pending: {
        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        label: 'Pending',
      },
      approved: {
        cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
        label: 'Approved',
      },
      rejected: {
        cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        label: 'Rejected',
      },
    };

    const s = map[status] ?? map.pending;

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
      >
        {s.label}
      </span>
    );
  };

  // ------------------------------------------------------------
  // FORM VALIDATION
  // ------------------------------------------------------------

  const validateSubStep = (stepNum: number) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;

    if (stepNum === 1) {
      if (!details.student_name.trim()) {
        return 'Student full name is required';
      }

      if (!details.student_email.trim()) {
        return 'Student email address is required';
      }

      if (!emailRegex.test(details.student_email)) {
        return 'Please enter a valid student email';
      }

      if (!details.student_phone.trim()) {
        return 'Student phone number is required';
      }

      if (!phoneRegex.test(details.student_phone)) {
        return 'Student phone number must be exactly 10 digits';
      }
    }

    if (stepNum === 2) {
      if (!details.parent_name.trim()) {
        return 'Parent / Guardian name is required';
      }

      if (!details.parent_phone.trim()) {
        return 'Parent / Guardian phone number is required';
      }

      if (!phoneRegex.test(details.parent_phone)) {
        return 'Parent / Guardian phone number must be exactly 10 digits';
      }

      if (!details.parent_email.trim()) {
        return 'Parent email address is required';
      }

      if (!emailRegex.test(details.parent_email)) {
        return 'Please enter a valid parent email';
      }
    }

    if (stepNum === 3) {
      if (!details.address.trim()) {
        return 'Full address is required';
      }
    }

    if (stepNum === 4) {
      if (!details.emergency_name.trim()) {
        return 'Emergency contact name is required';
      }

      if (!details.emergency_phone.trim()) {
        return 'Emergency contact phone number is required';
      }

      if (!phoneRegex.test(details.emergency_phone)) {
        return 'Emergency contact phone number must be exactly 10 digits';
      }
    }

    if (stepNum === 5) {
      const occupiedBeds =
        selectedRoom?.occupied_beds ??
        selectedRoom?.occupancy ??
        0;

      if (bookingType === 'entire_room' && occupiedBeds > 0) {
        setShowOccupancyAlert(true);

        return 'Entire room is unavailable because this room already has an occupant. Choose Entire Shared Room or another room.';
      }

      if (occupiedBeds >= (selectedRoom?.capacity ?? 0)) {
        return 'This room is already full. Please choose another room.';
      }
    }

    return null;
  };

  // ------------------------------------------------------------
  // NEXT DETAILS STEP
  // ------------------------------------------------------------

  const handleNextSubStep = () => {
    const errorMsg = validateSubStep(detailsSubStep);

    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    if (detailsSubStep < 5) {
      setDetailsSubStep(detailsSubStep + 1);
    } else {
      setStep('otp');
      sendOtp();
    }
  };

  // ------------------------------------------------------------
  // GROUP ROOMS BY TYPE
  // ------------------------------------------------------------

  const roomsByType = (rooms ?? []).reduce(
    (acc, room) => {
      const t =
        room.type ||
        room.room_type ||
        'double';

      if (!acc[t]) {
        acc[t] = [];
      }

      acc[t].push(room);

      return acc;
    },
    {} as Record<string, any[]>
  );

  // ------------------------------------------------------------
  // REQUEST / ALLOCATION STATUS
  // ------------------------------------------------------------

  const pendingRequest = myRequests?.find(
    (r: any) => r.status === 'pending'
  );

  const selectedOccupiedBeds = selectedRoom
    ? Number(
        selectedRoom.occupied_beds ??
        selectedRoom.occupancy ??
        0
      )
    : 0;

  const selectedCapacity = selectedRoom
    ? Number(selectedRoom.capacity ?? 0)
    : 0;

  const isRoomFull =
    !!selectedRoom &&
    selectedOccupiedBeds >= selectedCapacity;

  // ------------------------------------------------------------
  // LOADING ACTIVE ALLOCATION
  // ------------------------------------------------------------

  if (isAllocationLoading) {
    return (
      <DashboardShell
        title="Loading..."
        badge="Student"
      >
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardShell>
    );
  }

  // ------------------------------------------------------------
  // ACTIVE ALLOCATION SCREEN
  // ------------------------------------------------------------

  if (activeAllocation) {
    return (
      <DashboardShell
        title="Room Allocated"
        subtitle="You already have an active room allocation."
        badge="Student"
      >
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm text-center space-y-6">

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mx-auto dark:bg-green-950/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>

          <div>
            <h3 className="text-xl font-bold font-display text-foreground">
              You already have an active room allocation
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              Please visit your dashboard to manage your room allocation.
            </p>
          </div>

          <div className="rounded-2xl bg-muted/30 border p-5 text-left text-sm space-y-3">

            <div>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display tracking-wider">
                Hostel
              </span>

              <span className="font-semibold text-foreground text-sm">
                {activeAllocation.hostels?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">

              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display tracking-wider">
                  Room Number
                </span>

                <span className="font-medium text-foreground text-sm">
                  Room {activeAllocation.rooms?.room_number}
                </span>
              </div>

              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display tracking-wider">
                  Monthly Rent
                </span>

                <span className="font-bold text-primary text-sm">
                  ₹
                  {Number(
                    activeAllocation.rooms?.rent
                  ).toLocaleString()}
                  /mo
                </span>
              </div>

            </div>
          </div>

          <Link
            href="/student/dashboard"
            className="block w-full"
          >
            <Button className="w-full rounded-full shadow-md py-5 font-semibold">
              View My Allocated Room
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground mt-4">
            To request a different room, check out from your current allocation first.
          </p>

        </div>
      </DashboardShell>
    );
  }

  // ------------------------------------------------------------
  // PENDING REQUEST SCREEN
  // ------------------------------------------------------------

  if (pendingRequest) {
    return (
      <DashboardShell
        title="Pending Approval"
        subtitle="Your room request is being reviewed by the owner."
        badge="Student"
      >
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-md text-center space-y-6">

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mx-auto dark:bg-amber-950">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>

          <div>
            <h3 className="text-xl font-bold font-display">
              Request Pending
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              Please wait while the hostel owner reviews your request.
            </p>
          </div>

          <div className="rounded-xl bg-muted/50 p-4 text-left text-sm space-y-2">

            <p>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display">
                Hostel
              </span>
              {pendingRequest.hostels?.name}
            </p>

            <p>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display">
                Room
              </span>
              Room {pendingRequest.rooms?.room_number} (
              {pendingRequest.rooms?.room_type || 'double'}
              )
            </p>

            <p>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display">
                Booking Type
              </span>

              <span>
                {pendingRequest.booking_type === 'entire_room' ? 'Entire Room' : 'Entire Shared Room'}
              </span>
            </p>

            <p>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display">
                Rent
              </span>

              ₹
              {Number(
                pendingRequest.rooms?.rent
              ).toLocaleString()}
              /mo
            </p>

            <p>
              <span className="font-semibold text-muted-foreground uppercase text-[10px] block font-display">
                Status
              </span>

              <span className="text-amber-600 font-semibold">
                Pending Review
              </span>
            </p>

          </div>

          <Link
            href="/student/dashboard"
            className="block w-full"
          >
            <Button
              variant="outline"
              className="w-full rounded-full"
            >
              Go to Dashboard
            </Button>
          </Link>

        </div>
      </DashboardShell>
    );
  }

  // ------------------------------------------------------------
  // MAIN PAGE
  // ------------------------------------------------------------

  return (
    <DashboardShell
      title="Request a Room"
      subtitle="Find a hostel, pick a room and submit your request."
      badge="Student"
    >

      {/* ------------------------------------------------------
          EXISTING REQUESTS
      ------------------------------------------------------- */}

      {myRequests &&
        myRequests.length > 0 &&
        step === 'hostel' && (
          <section className="mb-8">

            <h2 className="mb-3 text-base font-semibold font-display">
              Your Requests
            </h2>

            <div className="space-y-3">

              {myRequests.map((r: any) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
                >

                  <div>
                    <p className="font-medium">
                      {r.hostels?.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Room {r.rooms?.room_number}
                      &bull; {r.rooms?.room_type}
                      &bull; ₹
                      {Number(
                        r.rooms?.rent
                      ).toLocaleString()}
                      /mo
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(
                        r.created_at
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <StatusBadge status={r.status} />

                </div>
              ))}

            </div>
          </section>
        )}

      {/* ------------------------------------------------------
          HOSTEL STEP
      ------------------------------------------------------- */}

      {step === 'hostel' && (
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">

          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-bold font-display mb-1">
            Find Your Hostel
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            Enter the exact Hostel ID provided by your hostel owner.
          </p>

          <div className="space-y-3">

            <Label htmlFor="hostel-code">
              Hostel ID
            </Label>

            <Input
              id="hostel-code"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={hostelIdInput}
              onChange={(e) =>
                setHostelIdInput(e.target.value)
              }
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                lookupHostel()
              }
            />

            <Button
              className="w-full rounded-full"
              onClick={lookupHostel}
            >
              <Search className="mr-2 h-4 w-4" />
              Find Hostel
            </Button>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          ROOM STEP
      ------------------------------------------------------- */}

      {step === 'room' && hostel && (
        <div>

          <div className="mb-6 flex items-center gap-3">

            <button
              onClick={() => {
                setStep('hostel');
                setHostel(null);
                setSelectedRoom(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Back
            </button>

            <div>
              <h2 className="text-lg font-bold font-display">
                {hostel.name}
              </h2>

              <p className="text-xs text-muted-foreground">
                {hostel.city} &bull; {hostel.address}
              </p>
            </div>

          </div>

          {roomsLoading ? (

            <div className="flex h-40 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>

          ) : Object.keys(roomsByType).length > 0 ? (

            <div className="space-y-8">

              {(Object.entries(roomsByType) as [
                string,
                any[]
              ][]).map(
                ([roomType, typeRooms]) => (

                  <div
                    key={roomType}
                    className="border-t border-border/60 pt-6 first:border-0 first:pt-0"
                  >

                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 capitalize">
                      {roomType} Sharing Rooms
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                      {typeRooms.map(
                        (room: any) => {

                          const occupiedBeds =
                            Number(
                              room.occupied_beds ??
                              room.occupancy ??
                              0
                            );

                          const capacity =
                            Number(
                              room.capacity ?? 0
                            );

                          const availableBeds =
                            Math.max(
                              0,
                              capacity -
                                occupiedBeds
                            );

                          const isFull =
                            occupiedBeds >=
                            capacity;

                          const isLow =
                            !isFull &&
                            availableBeds === 1;

                          return (
                            <button
                              key={room.id}
                              disabled={isFull}
                              onClick={() => {
                                if (isFull) {
                                  toast.error(
                                    'This room is full. Please choose another room.'
                                  );
                                  return;
                                }

                                setSelectedRoom(
                                  room
                                );

                                setBookingType(
                                  'shared'
                                );

                                setDetailsSubStep(
                                  1
                                );

                                setStep(
                                  'details'
                                );
                              }}
                              className={`group text-left rounded-2xl border-2 p-5 transition-all ${
                                isFull
                                  ? 'opacity-60 cursor-not-allowed border-red-200 bg-red-50 text-muted-foreground dark:border-red-900 dark:bg-red-950/30'
                                  : 'hover:shadow-md hover:scale-[1.02] ' +
                                    (ROOM_TYPE_COLORS[
                                      roomType
                                    ] ??
                                      'bg-muted border-border')
                              }`}
                            >

                              <div className="flex items-start justify-between">

                                <BedDouble className="h-6 w-6 opacity-60" />

                                <div className="flex flex-col items-end gap-1">

                                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase">
                                    {roomType}
                                  </span>

                                  {isFull ? (

                                    <span className="rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                                      FULL
                                    </span>

                                  ) : isLow ? (

                                    <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                                      LOW
                                    </span>

                                  ) : (

                                    <span className="rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                                      Available
                                    </span>

                                  )}

                                </div>
                              </div>

                              <div className="mt-3">

                                <p className="text-lg font-bold">
                                  Room {room.room_number}
                                </p>

                                <p className="text-sm opacity-70">

                                  {occupiedBeds} of{' '}
                                  {capacity}{' '}

                                  {capacity === 1
                                    ? 'bed'
                                    : 'beds'}{' '}

                                  occupied /{' '}

                                  {availableBeds}{' '}

                                  {availableBeds === 1
                                    ? 'bed'
                                    : 'beds'}{' '}

                                  free

                                </p>

                                <p className="mt-1 font-semibold">

                                  ₹
                                  {Number(
                                    room.rent
                                  ).toLocaleString()}

                                  <span className="text-xs font-normal opacity-70">
                                    /mo
                                  </span>

                                </p>

                              </div>

                            </button>
                          );
                        }
                      )}

                    </div>
                  </div>
                )
              )}

            </div>

          ) : (

            <div className="rounded-2xl border border-dashed border-border p-12 text-center">

              <BedDouble className="mx-auto h-10 w-10 text-muted-foreground/40" />

              <p className="mt-3 text-muted-foreground">
                No rooms available right now.
              </p>

            </div>

          )}

        </div>
      )}

      {/* ------------------------------------------------------
          DETAILS STEP
      ------------------------------------------------------- */}

      {step === 'details' && selectedRoom && (
        <div className="mx-auto max-w-2xl bg-card border border-border rounded-3xl shadow-xl overflow-hidden animate-fade-in">

          {/* Header & Sub-step Progress */}

          <div className="bg-primary/5 px-6 py-5 border-b border-border/60">

            <div className="flex items-center justify-between mb-2">

              <button
                onClick={() => {
                  if (detailsSubStep > 1) {
                    setDetailsSubStep(
                      detailsSubStep - 1
                    );
                  } else {
                    setStep('room');
                  }
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                &larr; Back
              </button>

              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Section {detailsSubStep} of 5
              </span>

            </div>

            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">

              {detailsSubStep === 1 && (
                <>
                  <User
                    size={18}
                    className="text-primary"
                  />
                  Student Information
                </>
              )}

              {detailsSubStep === 2 && (
                <>
                  <User
                    size={18}
                    className="text-primary"
                  />
                  Parent/Guardian Information
                </>
              )}

              {detailsSubStep === 3 && (
                <>
                  <MapPin
                    size={18}
                    className="text-primary"
                  />
                  Permanent Address
                </>
              )}

              {detailsSubStep === 4 && (
                <>
                  <User
                    size={18}
                    className="text-primary"
                  />
                  Emergency Contact
                </>
              )}

              {detailsSubStep === 5 && (
                <>
                  <Shield
                    size={18}
                    className="text-primary"
                  />
                  Room Selection & Agreement
                </>
              )}

            </h2>

            <div className="w-full bg-border/40 rounded-full h-2 mt-4 overflow-hidden">

              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    (detailsSubStep / 5) * 100
                  }%`,
                }}
              />

            </div>

          </div>

          <div className="p-6 space-y-5">

            {/* Section 1 */}

            {detailsSubStep === 1 && (
              <div className="space-y-4">

                <div>

                  <Label
                    htmlFor="student_name"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Name *
                  </Label>

                  <Input
                    id="student_name"
                    required
                    value={
                      details.student_name
                    }
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        student_name:
                          e.target.value,
                      })
                    }
                    className="mt-1 rounded-xl"
                    placeholder="Enter your full name"
                  />

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <Label
                      htmlFor="student_email"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Email Address *
                    </Label>

                    <Input
                      id="student_email"
                      type="email"
                      required
                      value={
                        details.student_email
                      }
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          student_email:
                            e.target.value,
                        })
                      }
                      className="mt-1 rounded-xl"
                      placeholder="student@example.com"
                    />

                  </div>

                  <div>

                    <Label
                      htmlFor="student_phone"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Phone Number *
                    </Label>

                    <Input
                      id="student_phone"
                      type="tel"
                      required
                      value={
                        details.student_phone
                      }
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          student_phone:
                            e.target.value,
                        })
                      }
                      className="mt-1 rounded-xl"
                      placeholder="10-digit number"
                      maxLength={10}
                    />

                  </div>

                </div>

              </div>
            )}

            {/* Section 2 */}

            {detailsSubStep === 2 && (
              <div className="space-y-4">

                <div>

                  <Label
                    htmlFor="parent_name"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Parent / Guardian Name *
                  </Label>

                  <Input
                    id="parent_name"
                    required
                    value={
                      details.parent_name
                    }
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        parent_name:
                          e.target.value,
                      })
                    }
                    className="mt-1 rounded-xl"
                    placeholder="Father's or Mother's full name"
                  />

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <Label
                      htmlFor="parent_phone"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Parent Phone Number *
                    </Label>

                    <Input
                      id="parent_phone"
                      type="tel"
                      required
                      value={
                        details.parent_phone
                      }
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          parent_phone:
                            e.target.value,
                        })
                      }
                      className="mt-1 rounded-xl"
                      placeholder="10-digit number"
                      maxLength={10}
                    />

                  </div>

                  <div>

                    <Label
                      htmlFor="parent_email"
                      className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Parent Email * (for OTP verification)
                    </Label>

                    <Input
                      id="parent_email"
                      type="email"
                      required
                      value={
                        details.parent_email
                      }
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          parent_email:
                            e.target.value,
                        })
                      }
                      className="mt-1 rounded-xl"
                      placeholder="parent@example.com"
                    />

                  </div>

                </div>

              </div>
            )}

            {/* Section 3 */}

            {detailsSubStep === 3 && (
              <div className="space-y-4">

                <div>

                  <Label
                    htmlFor="address"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Address *
                  </Label>

                  <textarea
                    id="address"
                    required
                    rows={4}
                    value={details.address}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        address:
                          e.target.value,
                      })
                    }
                    className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1 resize-none"
                    placeholder="House/Street/City/State/Pincode"
                  />

                </div>

              </div>
            )}

            {/* Section 4 */}

            {detailsSubStep === 4 && (
              <div className="space-y-4">

                <div>

                  <Label
                    htmlFor="emergency_name"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Emergency Contact Name *
                  </Label>

                  <Input
                    id="emergency_name"
                    required
                    value={
                      details.emergency_name
                    }
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        emergency_name:
                          e.target.value,
                      })
                    }
                    className="mt-1 rounded-xl"
                    placeholder="Contact Name"
                  />

                </div>

                <div>

                  <Label
                    htmlFor="emergency_phone"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Emergency Phone Number *
                  </Label>

                  <Input
                    id="emergency_phone"
                    type="tel"
                    required
                    value={
                      details.emergency_phone
                    }
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        emergency_phone:
                          e.target.value,
                      })
                    }
                    className="mt-1 rounded-xl"
                    placeholder="10-digit number"
                    maxLength={10}
                  />

                </div>

              </div>
            )}

            {/* Section 5 */}

            {detailsSubStep === 5 && (
              <div className="space-y-4">

                <div className="rounded-xl bg-muted/65 p-4 text-sm border space-y-2.5">

                  <span className="font-bold text-foreground block border-b pb-1 font-display uppercase tracking-wider text-xs">
                    Summary of Selection
                  </span>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">

                    <span className="text-muted-foreground font-semibold">
                      Hostel:
                    </span>

                    <span className="font-semibold text-foreground text-right">
                      {hostel?.name}
                    </span>

                    <span className="text-muted-foreground font-semibold">
                      Room:
                    </span>

                    <span className="font-semibold text-foreground text-right">
                      Room {selectedRoom.room_number}{' '}
                      ({selectedRoom.room_type})
                    </span>

                    <span className="text-muted-foreground font-semibold">
                      Occupancy:
                    </span>

                    <span className="font-semibold text-foreground text-right">
                      {selectedOccupiedBeds} /{' '}
                      {selectedCapacity} beds
                    </span>

                    <span className="text-muted-foreground font-semibold">
                      Rent:
                    </span>

                    <span className="font-bold text-primary text-right">
                      ₹
                      {Number(
                        selectedRoom.rent
                      ).toLocaleString()}
                      /month
                    </span>

                  </div>

                </div>

                {/* Full room warning */}

                {isRoomFull && (
                  <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">

                    <p className="text-sm font-bold text-red-700 dark:text-red-300">
                      This room is full.
                    </p>

                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {selectedOccupiedBeds} of{' '}
                      {selectedCapacity} beds are already occupied.
                      Please go back and choose another room.
                    </p>

                  </div>
                )}

                {selectedRoom.capacity > 1 && (
                  <div className="space-y-2 bg-muted/20 p-4 rounded-xl border">

                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Booking Option
                    </Label>

                    <div className="flex gap-6 mt-1">

                      <label className="flex items-center gap-2 cursor-pointer select-none">

                        <input
                          type="radio"
                          name="booking_type"
                          value="shared"
                          checked={
                            bookingType ===
                            'shared'
                          }
                          onChange={() =>
                            setBookingType(
                              'shared'
                            )
                          }
                          className="text-primary focus:ring-primary h-4 w-4"
                          disabled={
                            isRoomFull
                          }
                        />

                        <span className="text-sm font-medium">
                          Entire Shared Room
                        </span>

                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none">

                        <input
                          type="radio"
                          name="booking_type"
                          value="entire_room"
                          checked={
                            bookingType ===
                            'entire_room'
                          }
                          onChange={() => {
                            const occupiedBeds =
                              selectedRoom?.occupied_beds ??
                              selectedRoom?.occupancy ??
                              0;

                            if (
                              occupiedBeds > 0
                            ) {
                              setShowOccupancyAlert(
                                true
                              );

                              setBookingType(
                                'shared'
                              );
                            } else {
                              setBookingType(
                                'entire_room'
                              );
                            }
                          }}
                          className="text-primary focus:ring-primary h-4 w-4"
                          disabled={
                            isRoomFull
                          }
                        />

                        <span className="text-sm font-medium">
                          Entire Room
                        </span>

                      </label>

                    </div>

                    <span className="text-[10px] text-muted-foreground block mt-1">

                      {bookingType ===
                      'entire_room'
                        ? 'Note: Booking the entire room means you will pay for all beds in this room.'
                        : 'Note: Entire Shared Room means you will share this room with other residents.'}

                    </span>

                  </div>
                )}

                <div className="flex items-start gap-2.5 p-3.5 bg-primary/5 rounded-xl border border-primary/20">

                  <input
                    type="checkbox"
                    id="agreement"
                    className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary mt-0.5 cursor-pointer"
                    disabled={isRoomFull}
                  />

                  <Label
                    htmlFor="agreement"
                    className="text-xs text-foreground cursor-pointer leading-relaxed font-semibold"
                  >
                    I hereby declare that all the information provided in this request form is true and correct to the best of my knowledge. I agree to abide by the rules and regulations of the hostel.
                  </Label>

                </div>

              </div>
            )}

            {/* Navigation Buttons */}

            <div className="flex gap-3 justify-end border-t pt-4">

              {detailsSubStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setDetailsSubStep(
                      detailsSubStep - 1
                    )
                  }
                  className="rounded-full px-5"
                >
                  Previous
                </Button>
              )}

              <Button
                onClick={() => {

                  if (detailsSubStep === 5) {

                    // Always perform a fresh occupancy check
                    // before allowing the final step.
                    const occupiedBeds =
                      selectedRoom?.occupied_beds ??
                      selectedRoom?.occupancy ??
                      0;

                    const capacity =
                      selectedRoom?.capacity ?? 0;

                    if (
                      occupiedBeds >=
                      capacity
                    ) {
                      toast.error(
                        'This room is full. Please choose another room.'
                      );
                      setStep('room');
                      return;
                    }

                    const agreeChecked =
                      (
                        document.getElementById(
                          'agreement'
                        ) as HTMLInputElement
                      )?.checked;

                    if (!agreeChecked) {
                      toast.error(
                        'You must accept the agreement declaration'
                      );
                      return;
                    }
                  }

                  handleNextSubStep();
                }}
                disabled={
                  detailsSubStep === 5 &&
                  isRoomFull
                }
                className="rounded-full px-6 bg-primary hover:bg-primary/95 text-white font-bold"
              >
                {detailsSubStep === 5
                  ? isRoomFull
                    ? 'Room Full'
                    : 'Verify Your Email'
                  : 'Next / Continue'}
              </Button>

            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          OTP STEP
      ------------------------------------------------------- */}

      {step === 'otp' && (
        <div className="mx-auto max-w-sm">

          <div className="mb-5 flex items-center gap-3">

            <button
              onClick={() =>
                setStep('details')
              }
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Back
            </button>

            <h2 className="text-lg font-bold font-display">
              Verify Your Email
            </h2>

          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-4">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">

              <ShieldCheck className="h-7 w-7 text-primary" />

            </div>

            <p className="text-center text-sm text-muted-foreground">

              {otpSent
                ? 'Verification code sent to your registered email. Check your email for the code.'
                : 'Sending verification code...'}

            </p>

            <div>

              <Label htmlFor="otp">
                Enter Verification Code
              </Label>

              <Input
                id="otp"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value)
                }
                maxLength={6}
                className="mt-1 text-center tracking-widest text-lg font-semibold"
              />

            </div>

            <Button
              className="w-full rounded-full"
              onClick={verifyOtp}
              disabled={
                otpLoading ||
                otp.length !== 6
              }
            >
              {otpLoading
                ? 'Verifying...'
                : 'Verify & Submit Request'}
            </Button>

            <button
              onClick={sendOtp}
              disabled={otpLoading}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {otpLoading
                ? 'Sending...'
                : 'Resend Code'}
            </button>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------
          DONE STEP
      ------------------------------------------------------- */}

      {step === 'done' && (
        <div className="mx-auto max-w-sm text-center">

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mx-auto dark:bg-green-950">

            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />

          </div>

          <h2 className="mt-4 text-xl font-bold font-display">
            Request Submitted!
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Your room request has been sent. You will be notified once the hostel owner reviews it.
          </p>

          <Button
            className="mt-6 rounded-full"
            onClick={() => {
              setStep('hostel');
              setHostel(null);
              setSelectedRoom(null);
              setHostelIdInput('');
              setOtp('');
              setOtpSent(false);
              setDetailsSubStep(1);
            }}
          >
            Submit Another Request
          </Button>

        </div>
      )}

      {/* ------------------------------------------------------
          OCCUPANCY ALERT
      ------------------------------------------------------- */}

      {showOccupancyAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-200">

            <h3 className="text-lg font-bold font-display text-destructive mb-2">
              Entire Room Unavailable
            </h3>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Entire room is unavailable because this room already has an occupant. Choose Entire Shared Room or another room.
            </p>

            <div className="flex justify-end">

              <Button
                onClick={() =>
                  setShowOccupancyAlert(false)
                }
                className="rounded-full px-6 bg-primary hover:bg-primary/95 text-white font-bold"
              >
                Okay
              </Button>

            </div>

          </div>
        </div>
      )}

    </DashboardShell>
  );
}