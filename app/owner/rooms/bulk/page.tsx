'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle2,
  X,
  DoorOpen,
  Check
} from 'lucide-react';
import Link from 'next/link';

const CAPACITY_BY_ROOM_TYPE: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  quad: 4
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single Sharing (1 bed)',
  double: 'Double Sharing (2 beds)',
  triple: 'Triple Sharing (3 beds)',
  quad: 'Four Sharing (4 beds)'
};

interface RoomRow {
  room_number: string;
  floor: number;
  room_type: 'single' | 'double' | 'triple' | 'quad';
  rent: number;
  security_deposit: number;
  facilities: string[];
}

function BulkRoomForm() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultHostelId = searchParams?.get('hostelId') || '';

  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [hostelId, setHostelId] = useState('');

  // Step 1: Room generation state
  const [startRoom, setStartRoom] = useState('');
  const [endRoom, setEndRoom] = useState('');

  // Step 2: Common details state
  const [commonDetails, setCommonDetails] = useState<{
    floor: number;
    room_type: 'single' | 'double' | 'triple' | 'quad';
    rent: number;
    security_deposit: number;
    facilities: string;
  }>({
    floor: 1,
    room_type: 'double',
    rent: 5000,
    security_deposit: 5000,
    facilities: 'AC, Attached Washroom, WiFi'
  });

  // Step 3: Draft rooms list state
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [editingRoomIndex, setEditingRoomIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<RoomRow | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    async function fetchHostels() {
      if (!profile?.user_id) return;
      const { data } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', profile.user_id);

      setHostels(data || []);
      if (data && data.length > 0) {
        const initialHostelId = defaultHostelId && data.some(h => h.id === defaultHostelId)
          ? defaultHostelId
          : data[0].id;
        setHostelId(initialHostelId);
      }
    }
    fetchHostels();
  }, [profile, defaultHostelId]);

  // Step 1 Action: Generate Draft Rooms
  const handleGenerateRooms = () => {
    const start = parseInt(startRoom.trim(), 10);
    const end = parseInt(endRoom.trim(), 10);

    if (isNaN(start) || isNaN(end)) {
      toast.error('Please enter valid starting and ending room numbers');
      return;
    }

    if (start > end) {
      toast.error('Starting room number cannot be greater than ending room number');
      return;
    }

    const count = end - start + 1;
    if (count > 50) {
      toast.error('Maximum 50 rooms per batch');
      return;
    }

    const parsedFacilities = commonDetails.facilities
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    const generatedRooms: RoomRow[] = [];
    for (let i = start; i <= end; i++) {
      generatedRooms.push({
        room_number: i.toString(),
        floor: commonDetails.floor,
        room_type: commonDetails.room_type,
        rent: commonDetails.rent,
        security_deposit: commonDetails.security_deposit,
        facilities: [...parsedFacilities]
      });
    }

    setRooms(generatedRooms);
    setErrors({});
    toast.success(`Generated ${count} draft rooms (${start} - ${end})`);
  };

  // Step 2 Action: Apply Common Details to all draft rooms
  const handleApplyCommonDetails = () => {
    if (rooms.length === 0) {
      toast.error('Please generate room numbers first');
      return;
    }

    const parsedFacilities = commonDetails.facilities
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    setRooms(prevRooms =>
      prevRooms.map(room => ({
        ...room,
        floor: commonDetails.floor,
        room_type: commonDetails.room_type,
        rent: commonDetails.rent,
        security_deposit: commonDetails.security_deposit,
        facilities: [...parsedFacilities]
      }))
    );

    toast.success(`Applied common details to all ${rooms.length} rooms!`);
  };

  // Step 3 Action: Add an individual room manually
  const handleAddIndividualRoom = () => {
    const nextRoomNumber = rooms.length > 0
      ? (Math.max(...rooms.map(r => parseInt(r.room_number) || 0)) + 1).toString()
      : '101';

    const parsedFacilities = commonDetails.facilities
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    setRooms([
      ...rooms,
      {
        room_number: nextRoomNumber,
        floor: commonDetails.floor,
        room_type: commonDetails.room_type,
        rent: commonDetails.rent,
        security_deposit: commonDetails.security_deposit,
        facilities: [...parsedFacilities]
      }
    ]);
  };

  // Step 3 Action: Remove an individual room
  const handleRemoveRoom = (index: number) => {
    setRooms(rooms.filter((_, i) => i !== index));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  // Open Edit Modal for a specific room
  const handleOpenEditModal = (index: number) => {
    setEditingRoomIndex(index);
    setEditFormData({ ...rooms[index] });
  };

  // Save changes from Edit Modal
  const handleSaveRoomEdit = () => {
    if (editingRoomIndex === null || !editFormData) return;

    if (!editFormData.room_number.trim()) {
      toast.error('Room number is required');
      return;
    }

    const updatedRooms = [...rooms];
    updatedRooms[editingRoomIndex] = {
      ...editFormData,
      room_number: editFormData.room_number.trim()
    };
    setRooms(updatedRooms);

    // Clear error for this row
    if (errors[editingRoomIndex]) {
      setErrors(prev => {
        const nextErrors = { ...prev };
        delete nextErrors[editingRoomIndex];
        return nextErrors;
      });
    }

    setEditingRoomIndex(null);
    setEditFormData(null);
    toast.success(`Room ${editFormData.room_number} updated`);
  };

  // Validate entire batch before submitting
  const validateBatch = async (): Promise<boolean> => {
    if (!hostelId) {
      toast.error('Please select a hostel');
      return false;
    }

    if (rooms.length === 0) {
      toast.error('Please generate or add at least one room');
      return false;
    }

    if (rooms.length > 50) {
      toast.error('Maximum 50 rooms per batch allowed');
      return false;
    }

    const newErrors: Record<number, string> = {};
    let hasErrors = false;

    // Check empty room numbers and intra-batch duplicates
    rooms.forEach((room, index) => {
      const num = room.room_number.trim();
      if (!num) {
        newErrors[index] = 'Room number is required';
        hasErrors = true;
        return;
      }

      const duplicateIndex = rooms.findIndex(
        (r, i) => i !== index && r.room_number.trim() === num
      );
      if (duplicateIndex !== -1) {
        newErrors[index] = `Duplicate room number (Row ${duplicateIndex + 1})`;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      toast.error('Please fix validation errors before creating rooms');
      return false;
    }

    // Check database for existing room numbers in this hostel
    try {
      const roomNumbers = rooms.map(r => r.room_number.trim());
      const { data: existingRooms, error: checkError } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('hostel_id', hostelId)
        .in('room_number', roomNumbers);

      if (checkError) throw checkError;

      if (existingRooms && existingRooms.length > 0) {
        const existingNumbers = new Set(existingRooms.map(r => r.room_number));
        rooms.forEach((room, index) => {
          if (existingNumbers.has(room.room_number.trim())) {
            newErrors[index] = 'Room number already exists in this hostel';
            hasErrors = true;
          }
        });

        setErrors(newErrors);
        toast.error('Some room numbers already exist in this hostel');
        return false;
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || 'Failed to validate room numbers against database');
      return false;
    }

    return true;
  };

  // Step 4 Action: Submit to RPC
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateBatch();
    if (!isValid) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('bulk_create_rooms', {
        p_hostel_id: hostelId,
        p_rooms: rooms
      });

      if (error) throw error;

      if (!data || data.success === false) {
        throw new Error(data?.message || 'Failed to create rooms');
      }

      toast.success(`${data.rooms_created || rooms.length} rooms created successfully!`);
      router.push('/owner/rooms');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const totalCapacity = rooms.reduce(
    (acc, r) => acc + (CAPACITY_BY_ROOM_TYPE[r.room_type] || 2),
    0
  );
  const totalRent = rooms.reduce((acc, r) => acc + (Number(r.rent) || 0), 0);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/owner/rooms"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">
              Bulk Create Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate room numbers, apply common defaults, and review before creating
            </p>
          </div>
        </div>
        <Link
          href="/owner/rooms/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <Plus size={16} />
          <span>Single Room</span>
        </Link>
      </div>

      <div className="space-y-8">
        {/* ========================================================================= */}
        {/* STEP 1: SELECT HOSTEL & GENERATE ROOM NUMBERS                             */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">
                Select Hostel & Generate Rooms
              </h2>
            </div>
            {rooms.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check size={14} />
                {rooms.length} draft {rooms.length === 1 ? 'room' : 'rooms'} active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Hostel Selector */}
            <div className="md:col-span-5">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Target Hostel *
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  required
                  className="input h-11 w-full pl-10 text-sm font-medium"
                  value={hostelId}
                  onChange={e => setHostelId(e.target.value)}
                  disabled={loading}
                >
                  {hostels.length === 0 && <option value="">No hostels found</option>}
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start Room */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Start Room #
              </label>
              <input
                type="number"
                className="input h-11 w-full text-sm font-medium"
                placeholder="101"
                value={startRoom}
                onChange={e => setStartRoom(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* End Room */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                End Room #
              </label>
              <input
                type="number"
                className="input h-11 w-full text-sm font-medium"
                placeholder="105"
                value={endRoom}
                onChange={e => setEndRoom(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Generate Button */}
            <div className="flex items-end md:col-span-3">
              <button
                type="button"
                onClick={handleGenerateRooms}
                disabled={loading || !startRoom || !endRoom}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                <span>Generate Rooms</span>
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Example: Enter 101 to 105 to quickly generate 5 draft rooms. This will not create database records yet.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* STEP 2: COMMON DETAILS                                                    */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">
                  Common Details
                </h2>
                <p className="text-xs text-muted-foreground">
                  Set default values once and apply them to all generated rooms
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyCommonDetails}
              disabled={loading || rooms.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} />
              <span>Apply to All Rooms ({rooms.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Room Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Room Type
              </label>
              <select
                className="input h-10 w-full text-sm font-medium"
                value={commonDetails.room_type}
                onChange={e =>
                  setCommonDetails({
                    ...commonDetails,
                    room_type: e.target.value as any
                  })
                }
                disabled={loading}
              >
                <option value="single">{ROOM_TYPE_LABELS.single}</option>
                <option value="double">{ROOM_TYPE_LABELS.double}</option>
                <option value="triple">{ROOM_TYPE_LABELS.triple}</option>
                <option value="quad">{ROOM_TYPE_LABELS.quad}</option>
              </select>
            </div>

            {/* Floor */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Floor
              </label>
              <input
                type="number"
                className="input h-10 w-full text-sm font-medium"
                placeholder="1"
                value={commonDetails.floor}
                onChange={e =>
                  setCommonDetails({
                    ...commonDetails,
                    floor: parseInt(e.target.value, 10) || 0
                  })
                }
                disabled={loading}
              />
            </div>

            {/* Monthly Rent */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Monthly Rent (₹)
              </label>
              <input
                type="number"
                className="input h-10 w-full text-sm font-medium"
                placeholder="5000"
                value={commonDetails.rent}
                onChange={e =>
                  setCommonDetails({
                    ...commonDetails,
                    rent: parseFloat(e.target.value) || 0
                  })
                }
                disabled={loading}
              />
            </div>

            {/* Security Deposit */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Security Deposit (₹)
              </label>
              <input
                type="number"
                className="input h-10 w-full text-sm font-medium"
                placeholder="5000"
                value={commonDetails.security_deposit}
                onChange={e =>
                  setCommonDetails({
                    ...commonDetails,
                    security_deposit: parseFloat(e.target.value) || 0
                  })
                }
                disabled={loading}
              />
            </div>

            {/* Facilities */}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Facilities (Comma separated)
              </label>
              <input
                type="text"
                className="input h-10 w-full text-sm font-medium"
                placeholder="AC, Attached Washroom, Balcony, WiFi"
                value={commonDetails.facilities}
                onChange={e =>
                  setCommonDetails({
                    ...commonDetails,
                    facilities: e.target.value
                  })
                }
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 3: REVIEW ALL ROOMS & CUSTOMIZE                                      */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-foreground">
                  Review & Customize Rooms ({rooms.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Modify individual rooms as needed before final creation
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddIndividualRoom}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Plus size={15} />
              <span>Add Custom Room</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          {rooms.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Rooms</span>
                <p className="text-base font-bold text-foreground">{rooms.length}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Beds</span>
                <p className="text-base font-bold text-foreground">{totalCapacity} beds</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Monthly Rent</span>
                <p className="text-base font-bold text-foreground">₹{totalRent.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Hostel</span>
                <p className="text-base font-bold truncate text-foreground">
                  {hostels.find(h => h.id === hostelId)?.name || 'None selected'}
                </p>
              </div>
            </div>
          )}

          {/* Rooms Table / Empty state */}
          {rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
              <DoorOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No draft rooms generated yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use Step 1 above to generate room numbers or click "Add Custom Room".
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Room #</th>
                    <th className="py-3 px-4">Floor</th>
                    <th className="py-3 px-4">Room Type</th>
                    <th className="py-3 px-4">Monthly Rent</th>
                    <th className="py-3 px-4">Deposit</th>
                    <th className="py-3 px-4">Facilities</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rooms.map((room, index) => {
                    const hasError = !!errors[index];
                    return (
                      <tr
                        key={index}
                        className={`transition-colors hover:bg-muted/30 ${
                          hasError ? 'bg-destructive/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                              {room.room_number || '?'}
                            </span>
                            <span>Room {room.room_number}</span>
                          </div>
                          {hasError && (
                            <p className="text-[11px] font-medium text-destructive mt-0.5">
                              {errors[index]}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {room.floor === 0 ? 'Ground (0)' : `Floor ${room.floor}`}
                        </td>
                        <td className="py-3 px-4 text-foreground capitalize">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {room.room_type} ({CAPACITY_BY_ROOM_TYPE[room.room_type] || 1} bed)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          ₹{Number(room.rent).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          ₹{Number(room.security_deposit).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">
                          {room.facilities && room.facilities.length > 0
                            ? room.facilities.join(', ')
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(index)}
                              disabled={loading}
                              title="Edit Room Details"
                              className="rounded-lg p-1.5 text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRoom(index)}
                              disabled={loading}
                              title="Remove Room"
                              className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 4: FINAL SUBMISSION                                                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Ready to create {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              All rooms and corresponding beds will be created atomically in a single transaction.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={loading || rooms.length === 0 || !hostelId}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span>Creating {rooms.length} Rooms...</span>
            ) : (
              <span>Create {rooms.length} Rooms</span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INDIVIDUAL ROOM EDIT MODAL                                                */}
      {/* ========================================================================= */}
      {editingRoomIndex !== null && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Edit2 size={18} />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Edit Room {editFormData.room_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRoomIndex(null);
                  setEditFormData(null);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    className="input h-10 w-full text-sm font-medium"
                    value={editFormData.room_number}
                    onChange={e =>
                      setEditFormData({ ...editFormData, room_number: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Floor
                  </label>
                  <input
                    type="number"
                    className="input h-10 w-full text-sm font-medium"
                    value={editFormData.floor}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        floor: parseInt(e.target.value, 10) || 0
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Room Type
                </label>
                <select
                  className="input h-10 w-full text-sm font-medium"
                  value={editFormData.room_type}
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      room_type: e.target.value as any
                    })
                  }
                >
                  <option value="single">{ROOM_TYPE_LABELS.single}</option>
                  <option value="double">{ROOM_TYPE_LABELS.double}</option>
                  <option value="triple">{ROOM_TYPE_LABELS.triple}</option>
                  <option value="quad">{ROOM_TYPE_LABELS.quad}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Monthly Rent (₹)
                  </label>
                  <input
                    type="number"
                    className="input h-10 w-full text-sm font-medium"
                    value={editFormData.rent}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        rent: parseFloat(e.target.value) || 0
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    className="input h-10 w-full text-sm font-medium"
                    value={editFormData.security_deposit}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        security_deposit: parseFloat(e.target.value) || 0
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Facilities (Comma separated)
                </label>
                <input
                  type="text"
                  className="input h-10 w-full text-sm font-medium"
                  value={editFormData.facilities.join(', ')}
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      facilities: e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s !== '')
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingRoomIndex(null);
                  setEditFormData(null);
                }}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoomEdit}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BulkRoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <BulkRoomForm />
    </Suspense>
  );
}