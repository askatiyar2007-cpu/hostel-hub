'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
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
  Check,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import Stepper from '../../../components/Stepper';
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
  draft_id: string;
  room_number: string;
  floor: number;
  room_type: 'single' | 'double' | 'triple' | 'quad';
  rent: number;
  security_deposit: number;
  facilities: string[];
}

interface DuplicateWarningItem {
  draft_index: number;
  draft_id?: string;
  room_number: string;
  existing_room_id?: string | null;
  is_intra_batch?: boolean;
  approved?: boolean;
}

function generateDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
  const [commonDetailsApplied, setCommonDetailsApplied] = useState(false);
  const [editingRoomIndex, setEditingRoomIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<RoomRow | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  // Duplicate room numbers confirmation state (tracked per draft ID)
  const [approvedDraftIds, setApprovedDraftIds] = useState<Set<string>>(new Set());
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarningItem[] | null>(null);

  useEffect(() => {
    async function fetchHostels() {
      if (!profile?.user_id) return;
      const { data, error } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', profile.user_id);

      if (error) {
        console.error('Failed to fetch owner hostels:', error);
        return;
      }

      setHostels(data || []);
      if (data && data.length > 0) {
        setHostelId(prev => {
          if (prev && data.some(h => h.id === prev)) return prev;
          return defaultHostelId && data.some(h => h.id === defaultHostelId)
            ? defaultHostelId
            : data[0].id;
        });
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
        draft_id: generateDraftId(),
        room_number: i.toString(),
        floor: commonDetails.floor,
        room_type: commonDetails.room_type,
        rent: commonDetails.rent,
        security_deposit: commonDetails.security_deposit,
        facilities: [...parsedFacilities]
      });
    }

    setRooms(generatedRooms);
    setCommonDetailsApplied(false);
    setErrors({});
    setApprovedDraftIds(new Set());
    setDuplicateWarnings(null);
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

    setCommonDetailsApplied(true);
    toast.success(`Applied common details to all ${rooms.length} rooms!`);
  };

  // Step 3 Action: Add an individual room manually
  const handleAddIndividualRoom = () => {
    const nextRoomNumber = rooms.length > 0
      ? (Math.max(...rooms.map(r => parseInt(r.room_number, 10) || 0)) + 1).toString()
      : '101';

    const parsedFacilities = commonDetails.facilities
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    setRooms([
      ...rooms,
      {
        draft_id: generateDraftId(),
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
    const removed = rooms[index];
    if (removed?.draft_id) {
      setApprovedDraftIds(prev => {
        const next = new Set(prev);
        next.delete(removed.draft_id);
        return next;
      });
    }
    setRooms(rooms.filter((_, i) => i !== index));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
    setDuplicateWarnings(null);
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

    const currentRoom = rooms[editingRoomIndex];
    const oldNum = currentRoom?.room_number?.trim();
    const newNum = editFormData.room_number.trim();

    // If room number changed, remove old duplicate approval for that specific draft
    if (currentRoom?.draft_id && oldNum !== newNum) {
      setApprovedDraftIds(prev => {
        const next = new Set(prev);
        next.delete(currentRoom.draft_id);
        return next;
      });
    }

    const updatedRooms = [...rooms];
    updatedRooms[editingRoomIndex] = {
      ...editFormData,
      draft_id: currentRoom?.draft_id || generateDraftId(),
      room_number: newNum
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
    setDuplicateWarnings(null);
    toast.success(`Room ${newNum} updated`);
  };

  // Validate basic required fields before submitting
  const validateBatch = (): boolean => {
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

    // Check empty room numbers
    rooms.forEach((room, index) => {
      const num = room.room_number?.trim();
      if (!num) {
        newErrors[index] = 'Room number is required';
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      toast.error('Please fix validation errors before creating rooms');
      return false;
    }

    setErrors({});
    return true;
  };

  // Submit batch to POST /api/rooms/bulk-create
  const submitBatch = async (explicitApproved?: Set<string>) => {
    const activeApproved = explicitApproved || approvedDraftIds;
    setLoading(true);

    try {
      console.log('[Bulk Create] Submitting batch to /api/rooms/bulk-create:', {
        hostel_id: hostelId,
        rooms_count: rooms.length,
        approved_draft_ids: Array.from(activeApproved)
      });

      const res = await fetch('/api/rooms/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hostel_id: hostelId,
          rooms: rooms.map(r => {
            const isApproved = activeApproved.has(r.draft_id);
            return {
              ...r,
              allow_duplicate: isApproved,
              approved: isApproved
            };
          }),
          confirmed_draft_ids: Array.from(activeApproved)
        })
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('[Bulk Create] Non-JSON response from server:', parseErr);
      }

      // Check if duplicate confirmation is required
      if (data?.code === 'DUPLICATE_ROOM_CONFIRMATION_REQUIRED' && Array.isArray(data?.duplicates)) {
        console.log('[Bulk Create] Duplicate room confirmation required:', data.duplicates);
        setDuplicateWarnings(data.duplicates);
        return;
      }

      if (!res.ok || data?.success === false) {
        const errorMsg =
          data?.error ||
          (Array.isArray(data?.details)
            ? data.details
                .map((d: any) => (typeof d === 'string' ? d : d.message || JSON.stringify(d)))
                .join(', ')
            : data?.details) ||
          data?.message ||
          `Failed to create rooms (Server returned status ${res.status})`;
        throw new Error(errorMsg);
      }

      toast.success(`${data?.rooms_created || rooms.length} rooms created successfully!`);
      router.push('/owner/rooms');
    } catch (err: unknown) {
      console.error('[Bulk Create] Submission error:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Action: Submit to POST /api/rooms/bulk-create
  const handleFinalSubmit = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }

    const isValid = validateBatch();
    if (!isValid) return;

    await submitBatch();
  };

  // Duplicate Warning Actions
  const handleChangeDuplicateRoomNumber = (item: DuplicateWarningItem) => {
    setDuplicateWarnings(null);
    let targetIndex = -1;
    if (item.draft_id) {
      targetIndex = rooms.findIndex(r => r.draft_id === item.draft_id);
    }
    if (targetIndex === -1 && typeof item.draft_index === 'number' && rooms[item.draft_index]) {
      targetIndex = item.draft_index;
    }
    if (targetIndex === -1) {
      targetIndex = rooms.findIndex(r => r.room_number.trim() === item.room_number.trim());
    }
    if (targetIndex !== -1) {
      handleOpenEditModal(targetIndex);
    }
  };

  const handleKeepDraftAnyway = async (item: DuplicateWarningItem) => {
    const draftId = item.draft_id || rooms[item.draft_index]?.draft_id;
    if (!draftId) return;

    const nextApproved = new Set(approvedDraftIds);
    nextApproved.add(draftId);
    setApprovedDraftIds(nextApproved);

    // If all duplicates in duplicateWarnings are confirmed, close warning and submit
    const remaining = (duplicateWarnings || []).filter(d => {
      const dId = d.draft_id || rooms[d.draft_index]?.draft_id;
      return dId && !nextApproved.has(dId);
    });

    if (remaining.length === 0) {
      setDuplicateWarnings(null);
      await submitBatch(nextApproved);
    }
  };

  const handleKeepAllAnyway = async () => {
    const nextApproved = new Set(approvedDraftIds);
    (duplicateWarnings || []).forEach(d => {
      const dId = d.draft_id || rooms[d.draft_index]?.draft_id;
      if (dId) {
        nextApproved.add(dId);
      }
    });
    setApprovedDraftIds(nextApproved);
    setDuplicateWarnings(null);
    await submitBatch(nextApproved);
  };

  const totalCapacity = rooms.reduce(
    (acc, r) => acc + (CAPACITY_BY_ROOM_TYPE[r.room_type] || 2),
    0
  );
  const totalRent = rooms.reduce((acc, r) => acc + (Number(r.rent) || 0), 0);

  const currentStep = rooms.length === 0 ? 1 : !commonDetailsApplied ? 2 : Object.keys(errors).length === 0 ? 4 : 3;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-6 p-4 rounded-xl bg-white border border-teal-200 shadow-xs">
          <Stepper 
            steps={[
              { label: 'Generate Rooms' },
              { label: 'Common Details' },
              { label: 'Customize' },
              { label: 'Final Submission' }
            ]} 
            currentStep={currentStep} 
          />
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <Link href="/owner/rooms" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Bulk Create Rooms</h1>
          </div>
          <Link
            href="/owner/rooms/new"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Single Room</span>
          </Link>
        </div>
        <p className="text-gray-600 ml-10">Create multiple rooms for a hostel in one step.</p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Select Hostel & Generate Room Numbers */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  1
                </span>
                <h2 className="text-lg font-semibold text-gray-900">
                  Select Hostel & Generate Rooms
                </h2>
              </div>
              {rooms.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  <Check size={14} />
                  {rooms.length} draft {rooms.length === 1 ? 'room' : 'rooms'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Hostel Selector */}
              <div className="md:col-span-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Hostel
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    value={hostelId}
                    onChange={e => setHostelId(e.target.value)}
                    disabled={loading}
                  >
                    {hostels.length === 0 && <option value="">No hostels found</option>}
                    {hostels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Room */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Room #
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="101"
                  value={startRoom}
                  onChange={e => setStartRoom(e.target.value.replace(/^0+/, ''))}
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>

              {/* End Room */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Room #
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="105"
                  value={endRoom}
                  onChange={e => setEndRoom(e.target.value.replace(/^0+/, ''))}
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>

              {/* Generate Button */}
              <div className="md:col-span-3 flex items-end">
                <Button
                  type="button"
                  onClick={handleGenerateRooms}
                  disabled={loading || !startRoom || !endRoom}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Sparkles size={16} className="mr-2" />
                  Generate Rooms
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Example: Enter 101 to 105 to generate 5 draft rooms. This will not create database records yet.
            </p>
          </CardContent>
        </Card>

        {/* Step 2: Common Details */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  2
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Common Details
                  </h2>
                  <p className="text-xs text-gray-500">
                    Set default values once and apply them to all generated rooms
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleApplyCommonDetails}
                disabled={loading || rooms.length === 0}
                variant="outline"
                className="border-teal-200 text-teal-600 hover:bg-teal-50"
              >
                <CheckCircle2 size={16} className="mr-2" />
                Apply to All ({rooms.length})
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Type
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Floor
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={commonDetails.floor === 0 ? '' : String(commonDetails.floor)}
                  onChange={e => {
                    const clean = e.target.value.replace(/^0+/, '').replace(/\D/g, '');
                    setCommonDetails({
                      ...commonDetails,
                      floor: clean === '' ? 0 : parseInt(clean, 10)
                    });
                  }}
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Rent (₹)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="5000"
                  value={commonDetails.rent === 0 ? '' : String(commonDetails.rent)}
                  onChange={e => {
                    const clean = e.target.value.replace(/^0+/, '').replace(/\D/g, '');
                    setCommonDetails({
                      ...commonDetails,
                      rent: clean === '' ? 0 : parseFloat(clean)
                    });
                  }}
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Security Deposit (₹)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="5000"
                  value={commonDetails.security_deposit === 0 ? '' : String(commonDetails.security_deposit)}
                  onChange={e => {
                    const clean = e.target.value.replace(/^0+/, '').replace(/\D/g, '');
                    setCommonDetails({
                      ...commonDetails,
                      security_deposit: clean === '' ? 0 : parseFloat(clean)
                    });
                  }}
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facilities (comma separated)
                </label>
                <Input
                  placeholder="AC, Attached Washroom, Balcony, WiFi"
                  value={commonDetails.facilities}
                  onChange={e =>
                    setCommonDetails({
                      ...commonDetails,
                      facilities: e.target.value
                    })
                  }
                  disabled={loading}
                  className="bg-white border-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Review & Customize Rooms */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  3
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Review & Customize Rooms ({rooms.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Modify individual rooms as needed before final creation
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleAddIndividualRoom}
                disabled={loading}
                variant="outline"
                className="border-teal-200 text-teal-600 hover:bg-teal-50"
              >
                <Plus size={15} className="mr-2" />
                Add Custom Room
              </Button>
            </div>

            {/* Quick Metrics Bar */}
            {rooms.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Total Rooms</span>
                  <p className="text-base font-bold text-gray-900">{rooms.length}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Total Beds</span>
                  <p className="text-base font-bold text-gray-900">{totalCapacity} beds</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Total Monthly Rent</span>
                  <p className="text-base font-bold text-gray-900">₹{totalRent.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Hostel</span>
                  <p className="text-base font-bold truncate text-gray-900">
                    {hostels.find(h => h.id === hostelId)?.name || 'None selected'}
                  </p>
                </div>
              </div>
            )}

            {/* Rooms Table / Empty state */}
            {rooms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
                <DoorOpen className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium">No draft rooms generated yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use Step 1 above to generate room numbers or click "Add Custom Room".
                </p>
              </div>
            ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
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
                <tbody className="divide-y divide-gray-200">
                  {rooms.map((room, index) => {
                    const hasError = !!errors[index];
                    return (
                      <tr
                        key={index}
                        className={`transition-colors hover:bg-gray-50 ${
                          hasError ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-100 text-xs font-bold text-teal-700">
                              {room.room_number || '?'}
                            </span>
                            <span>Room {room.room_number}</span>
                          </div>
                          {hasError && (
                            <p className="text-[11px] font-medium text-red-600 mt-0.5">
                              {errors[index]}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {room.floor === 0 ? 'Ground (0)' : `Floor ${room.floor}`}
                        </td>
                        <td className="py-3 px-4 text-gray-900 capitalize">
                          <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                            {room.room_type} ({CAPACITY_BY_ROOM_TYPE[room.room_type] || 1} bed)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">
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
                              className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50 transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRoom(index)}
                              disabled={loading}
                              title="Remove Room"
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors"
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
        </CardContent>
        </Card>

        {/* Step 4: Final Submission */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Ready to create {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  All rooms and corresponding beds will be created atomically in a single transaction.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading || rooms.length === 0 || !hostelId}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[160px]"
              >
                {loading ? (
                  <span>Creating {rooms.length} Rooms...</span>
                ) : (
                  <span>Create {rooms.length} Rooms</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Room Edit Modal */}
      {editingRoomIndex !== null && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                  <Edit2 size={18} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Room {editFormData.room_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRoomIndex(null);
                  setEditFormData(null);
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Number
                  </label>
                  <Input
                    value={editFormData.room_number}
                    onChange={e =>
                      setEditFormData({ ...editFormData, room_number: e.target.value })
                    }
                    className="bg-white border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Floor
                  </label>
                  <Input
                    type="number"
                    value={editFormData.floor}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        floor: parseInt(e.target.value, 10) || 0
                      })
                    }
                    className="bg-white border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Type
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Rent (₹)
                  </label>
                  <Input
                    type="number"
                    value={editFormData.rent}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        rent: parseFloat(e.target.value) || 0
                      })
                    }
                    className="bg-white border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Security Deposit (₹)
                  </label>
                  <Input
                    type="number"
                    value={editFormData.security_deposit}
                    onChange={e =>
                      setEditFormData({
                        ...editFormData,
                        security_deposit: parseFloat(e.target.value) || 0
                      })
                    }
                    className="bg-white border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facilities (comma separated)
                </label>
                <Input
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
                  className="bg-white border-gray-200"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingRoomIndex(null);
                  setEditFormData(null);
                }}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveRoomEdit}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Room Numbers Confirmation Modal */}
      {duplicateWarnings && duplicateWarnings.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Duplicate Room Numbers Detected
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Some rooms in your batch have room numbers that already exist in this hostel or appear multiple times in this batch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateWarnings(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1 my-4">
              {duplicateWarnings.map((item, idx) => {
                const draftId = item.draft_id || rooms[item.draft_index]?.draft_id;
                const isApproved = draftId ? approvedDraftIds.has(draftId) : false;
                const draftNumber = typeof item.draft_index === 'number' ? item.draft_index + 1 : idx + 1;

                return (
                  <div
                    key={draftId || `dup-${idx}`}
                    className={`rounded-lg border p-4 transition-colors ${
                      isApproved
                        ? 'border-green-200 bg-green-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                            Draft Room #{draftNumber}
                          </span>
                          <span className="font-bold text-gray-900">
                            Room {item.room_number}
                          </span>
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              <Check size={12} /> Approved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {item.existing_room_id && item.is_intra_batch
                            ? `Room ${item.room_number} already exists in this hostel and appears multiple times in this batch.`
                            : item.existing_room_id
                            ? `Room ${item.room_number} already exists in this hostel.`
                            : `Room ${item.room_number} appears multiple times in this batch.`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          onClick={() => handleChangeDuplicateRoomNumber(item)}
                          variant="outline"
                          className="border-gray-300 text-xs"
                        >
                          Change Number
                        </Button>
                        {!isApproved ? (
                          <Button
                            type="button"
                            onClick={() => handleKeepDraftAnyway(item)}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                          >
                            Keep Anyway
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => {
                              if (draftId) {
                                setApprovedDraftIds(prev => {
                                  const next = new Set(prev);
                                  next.delete(draftId);
                                  return next;
                                });
                              }
                            }}
                            variant="outline"
                            className="border-gray-300 text-xs"
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                onClick={() => setDuplicateWarnings(null)}
                variant="outline"
                className="border-gray-300"
              >
                Back to Review
              </Button>

              <div className="flex items-center gap-2">
                {duplicateWarnings.length > 1 && (
                  <Button
                    type="button"
                    onClick={handleKeepAllAnyway}
                    variant="outline"
                    className="border-gray-300"
                  >
                    Keep All Anyway
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={async () => {
                    const allApproved = duplicateWarnings.every(d => {
                      const dId = d.draft_id || rooms[d.draft_index]?.draft_id;
                      return dId && approvedDraftIds.has(dId);
                    });
                    if (allApproved) {
                      setDuplicateWarnings(null);
                      await submitBatch(approvedDraftIds);
                    } else {
                      toast.error('Please resolve or confirm all duplicate rooms before proceeding');
                    }
                  }}
                  disabled={!duplicateWarnings.every(d => {
                    const dId = d.draft_id || rooms[d.draft_index]?.draft_id;
                    return dId && approvedDraftIds.has(dId);
                  })}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Confirm & Create
                </Button>
              </div>
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