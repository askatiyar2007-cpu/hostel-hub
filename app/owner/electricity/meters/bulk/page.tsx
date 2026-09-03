'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import {
  Zap,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Layers,
  Search,
  Check,
  Sparkles,
  Trash2,
  DoorOpen,
  Info,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Hostel {
  id: string;
  name: string;
}

interface UnmeteredRoom {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  capacity: number;
  occupancy: number;
  rent: number;
  status: string;
  hostel_id: string;
}

interface MeterFormData {
  room_id: string;
  room_number: string;
  floor: number;
  room_type: string;
  meter_number: string;
  notes: string;
}

function BulkMeterCreationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: _user } = useAuth();

  // Wizard step: 1 = Select Rooms, 2 = Meter Details, 3 = Review & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Hostel states
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [hostelsLoading, setHostelsLoading] = useState(true);

  // Unmetered rooms states
  const [unmeteredRooms, setUnmeteredRooms] = useState<UnmeteredRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected room IDs in Step 1
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());

  // Meter form rows for Step 2
  const [meterForms, setMeterForms] = useState<MeterFormData[]>([]);
  const [autoPrefix, setAutoPrefix] = useState('M-');

  // Submitting state for Step 3
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch hostels owned by owner
  const fetchHostels = useCallback(async () => {
    try {
      setHostelsLoading(true);
      const res = await fetch('/api/hostels/owner');
      if (!res.ok) throw new Error('Failed to fetch hostels');

      const data = await res.json();
      const list: Hostel[] = data.hostels || [];
      setHostels(list);

      // Check URL query param or select first hostel
      const queryHostelId = searchParams.get('hostelId');
      if (queryHostelId && list.some(h => h.id === queryHostelId)) {
        setSelectedHostelId(queryHostelId);
      } else if (list.length > 0) {
        setSelectedHostelId(list[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching hostels:', err);
      toast.error('Failed to load hostels');
    } finally {
      setHostelsLoading(false);
    }
  }, [searchParams]);

  // Fetch unmetered rooms for selected hostel
  const fetchUnmeteredRooms = useCallback(async (hostelId: string) => {
    if (!hostelId) {
      setUnmeteredRooms([]);
      return;
    }

    try {
      setRoomsLoading(true);
      const res = await fetch(`/api/meters/unmetered-rooms?hostel_id=${hostelId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch unmetered rooms');
      }

      const data = await res.json();
      setUnmeteredRooms(data.rooms || []);
      // Reset selected rooms when hostel changes
      setSelectedRoomIds(new Set());
      setMeterForms([]);
    } catch (err: any) {
      console.error('Error fetching unmetered rooms:', err);
      toast.error(err.message || 'Failed to load rooms');
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  useEffect(() => {
    if (selectedHostelId) {
      fetchUnmeteredRooms(selectedHostelId);
    }
  }, [selectedHostelId, fetchUnmeteredRooms]);

  // Filtered rooms based on search
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return unmeteredRooms;
    const query = searchQuery.toLowerCase().trim();
    return unmeteredRooms.filter(r =>
      r.room_number.toLowerCase().includes(query) ||
      `floor ${r.floor}`.toLowerCase().includes(query) ||
      r.room_type.toLowerCase().includes(query)
    );
  }, [unmeteredRooms, searchQuery]);

  // Toggle single room selection
  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  // Select all filtered rooms
  const handleSelectAll = () => {
    setSelectedRoomIds(new Set(filteredRooms.map(r => r.id)));
  };

  // Deselect all rooms
  const handleDeselectAll = () => {
    setSelectedRoomIds(new Set());
  };

  // Proceed to Step 2: Meter Details
  const handleProceedToDetails = () => {
    if (selectedRoomIds.size === 0) {
      toast.error('Please select at least one room');
      return;
    }

    // Build form data preserving any previously entered data
    const selectedRoomsList = unmeteredRooms.filter(r => selectedRoomIds.has(r.id));
    const currentFormsMap = new Map(meterForms.map(f => [f.room_id, f]));

    const nextForms: MeterFormData[] = selectedRoomsList.map(r => {
      const existing = currentFormsMap.get(r.id);
      return {
        room_id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        room_type: r.room_type,
        meter_number: existing ? existing.meter_number : '',
        notes: existing ? existing.notes : ''
      };
    });

    setMeterForms(nextForms);
    setCurrentStep(2);
  };

  // Auto-fill meter numbers with prefix (e.g. M-101, M-102)
  const handleAutoFillMeters = () => {
    const prefix = autoPrefix.trim();
    setMeterForms(prev =>
      prev.map(item => ({
        ...item,
        meter_number: `${prefix}${item.room_number}`
      }))
    );
    toast.success(`Generated meter numbers with prefix "${prefix}"`);
  };

  // Clear all meter numbers
  const handleClearMeters = () => {
    setMeterForms(prev =>
      prev.map(item => ({
        ...item,
        meter_number: ''
      }))
    );
  };

  // Update a single meter form item
  const handleUpdateMeterForm = (index: number, field: 'meter_number' | 'notes', value: string) => {
    setMeterForms(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Remove a room from the meter form list in Step 2
  const handleRemoveMeterForm = (roomId: string) => {
    setMeterForms(prev => prev.filter(f => f.room_id !== roomId));
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  };

  // Validation before going to Step 3
  const handleProceedToReview = () => {
    if (meterForms.length === 0) {
      toast.error('At least one room is required');
      return;
    }

    // Check for empty meter numbers
    const emptyIndex = meterForms.findIndex(f => !f.meter_number.trim());
    if (emptyIndex !== -1) {
      toast.error(`Please enter a meter number for Room ${meterForms[emptyIndex].room_number}`);
      return;
    }

    // Check for intra-batch duplicate meter numbers
    const seen = new Set<string>();
    for (const form of meterForms) {
      const cleanNum = form.meter_number.trim().toLowerCase();
      if (seen.has(cleanNum)) {
        toast.error(`Duplicate meter number "${form.meter_number}" entered. Meter numbers must be unique.`);
        return;
      }
      seen.add(cleanNum);
    }

    setCurrentStep(3);
  };

  // Step 3: Submit atomic bulk meter creation
  const handleSubmitBulkCreation = async () => {
    if (!selectedHostelId) {
      toast.error('Hostel not selected');
      return;
    }

    if (meterForms.length === 0) {
      toast.error('No meters to create');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        hostel_id: selectedHostelId,
        meters: meterForms.map(f => ({
          room_id: f.room_id,
          meter_number: f.meter_number.trim(),
          notes: f.notes.trim() || undefined
        }))
      };

      const res = await fetch('/api/meters/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create meters');
      }

      // Step 10: After success, return to meters page and show confirmation
      toast.success(data.message || `Successfully created ${data.meters_created} meters`);
      router.push('/owner/electricity/meters');
    } catch (err: any) {
      console.error('Error submitting bulk meter creation:', err);
      toast.error(err.message || 'Failed to create meters. No meters were created.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedHostelName = hostels.find(h => h.id === selectedHostelId)?.name || 'Selected Hostel';

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header with Back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/owner/electricity/meters">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Bulk Create Electricity Meters
            </h1>
            <p className="text-sm text-gray-500">
              Configure physical electricity meters for rooms without an active meter
            </p>
          </div>
        </div>

        {/* Step Badges */}
        <div className="hidden sm:flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
            Select Rooms
          </div>
          <div className="w-4 h-0.5 bg-gray-200" />
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
            Meter Details
          </div>
          <div className="w-4 h-0.5 bg-gray-200" />
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            currentStep === 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
            Review & Create
          </div>
        </div>
      </div>

      {/* STEP 1: SELECT ROOMS */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Hostel Selection Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Select Hostel
              </CardTitle>
              <CardDescription>
                Choose the hostel containing the rooms you want to configure meters for
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hostelsLoading ? (
                <div className="h-10 animate-pulse bg-gray-100 rounded-md" />
              ) : hostels.length === 0 ? (
                <p className="text-sm text-gray-500">No hostels found. Please create a hostel first.</p>
              ) : (
                <div className="max-w-md">
                  <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hostels.map(h => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rooms Selection List Card */}
          {selectedHostelId && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DoorOpen className="h-5 w-5 text-primary" />
                      Select Rooms Without Meters
                    </CardTitle>
                    <CardDescription>
                      Only rooms currently without an active electricity meter are shown and eligible
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="self-start sm:self-auto text-sm px-3 py-1 font-medium">
                    {selectedRoomIds.size} of {unmeteredRooms.length} selected
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Search & Bulk Select Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search room number or floor..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={filteredRooms.length === 0 || selectedRoomIds.size === filteredRooms.length}
                    >
                      Select All ({filteredRooms.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      disabled={selectedRoomIds.size === 0}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                {/* Rooms Grid / List */}
                {roomsLoading ? (
                  <div className="py-12 text-center text-gray-500">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
                    Loading unmetered rooms...
                  </div>
                ) : unmeteredRooms.length === 0 ? (
                  <div className="py-12 text-center border rounded-xl bg-gray-50/50">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-800">All Rooms Have Active Meters</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                      Every room in <span className="font-medium text-gray-700">{selectedHostelName}</span> already has an active electricity meter.
                    </p>
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No rooms matched &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRooms.map(room => {
                      const isSelected = selectedRoomIds.has(room.id);
                      return (
                        <div
                          key={room.id}
                          onClick={() => handleToggleRoom(room.id)}
                          className={`group cursor-pointer rounded-xl border p-4 transition-all duration-150 relative ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg text-gray-900">
                                  Room {room.room_number}
                                </span>
                                <Badge variant="secondary" className="text-xs uppercase">
                                  {room.room_type}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                Floor {room.floor} • Capacity: {room.capacity} bed{room.capacity > 1 ? 's' : ''}
                              </p>
                              <div className="flex items-center gap-3 pt-1 text-xs text-gray-600">
                                <span>Rent: ₹{room.rent.toLocaleString('en-IN')}/mo</span>
                                <span>•</span>
                                <span className={room.occupancy > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                                  {room.occupancy > 0 ? `${room.occupancy} occupied` : 'Vacant'}
                                </span>
                              </div>
                            </div>

                            {/* Checkbox indicator */}
                            <div className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-gray-300 bg-white group-hover:border-gray-400'
                            }`}>
                              {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-gray-500">
                  {selectedRoomIds.size} room{selectedRoomIds.size === 1 ? '' : 's'} selected
                </span>
                <Button
                  onClick={handleProceedToDetails}
                  disabled={selectedRoomIds.size === 0}
                  className="gap-2"
                >
                  Continue with {selectedRoomIds.size} Room{selectedRoomIds.size === 1 ? '' : 's'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}

      {/* STEP 2: METER DETAILS FORM */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Helper toolbar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Enter Meter Details
                  </CardTitle>
                  <CardDescription>
                    Provide meter numbers for each of the {meterForms.length} selected rooms
                  </CardDescription>
                </div>

                {/* Auto-fill tool */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="autoPrefix" className="text-xs text-gray-500 whitespace-nowrap">
                      Prefix:
                    </Label>
                    <Input
                      id="autoPrefix"
                      value={autoPrefix}
                      onChange={e => setAutoPrefix(e.target.value)}
                      className="h-8 w-20 text-xs"
                      placeholder="M-"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFillMeters}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Auto-Fill
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearMeters}
                    className="h-8 text-xs text-gray-500"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Informational banner about readings rule */}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Note on Initial Readings:</span> Initial meter readings are completely separate and will be recorded from the Readings section after meter installation.
                </div>
              </div>

              {/* Form rows for each selected room */}
              <div className="space-y-3">
                {meterForms.map((form, index) => (
                  <div
                    key={form.room_id}
                    className="border rounded-xl p-4 bg-card grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                  >
                    {/* Room Info */}
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">Room {form.room_number}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          Floor {form.floor}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500 capitalize">{form.room_type} room</span>
                    </div>

                    {/* Meter Number */}
                    <div className="md:col-span-4 space-y-1">
                      <Label htmlFor={`meter-${form.room_id}`} className="text-xs font-medium">
                        Meter Number *
                      </Label>
                      <Input
                        id={`meter-${form.room_id}`}
                        placeholder="e.g., M-101"
                        value={form.meter_number}
                        onChange={e => handleUpdateMeterForm(index, 'meter_number', e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Notes */}
                    <div className="md:col-span-4 space-y-1">
                      <Label htmlFor={`notes-${form.room_id}`} className="text-xs font-medium text-gray-500">
                        Notes (Optional)
                      </Label>
                      <Input
                        id={`notes-${form.room_id}`}
                        placeholder="Location, panel, etc."
                        value={form.notes}
                        onChange={e => handleUpdateMeterForm(index, 'notes', e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Remove Action */}
                    <div className="md:col-span-1 flex justify-end md:justify-center pt-2 md:pt-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMeterForm(form.room_id)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        title="Remove room"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
              >
                Back to Room Selection
              </Button>
              <Button
                onClick={handleProceedToReview}
                disabled={meterForms.length === 0}
                className="gap-2"
              >
                Review & Confirm ({meterForms.length})
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* STEP 3: REVIEW & SUBMIT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Review & Confirm Bulk Creation
              </CardTitle>
              <CardDescription>
                Review the meters below. They will all be created atomically in a single backend operation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Hostel</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{selectedHostelName}</p>
                </div>
                <div className="rounded-xl border p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Total Meters</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{meterForms.length}</p>
                </div>
                <div className="rounded-xl border p-4 bg-emerald-50/50 border-emerald-200">
                  <p className="text-xs text-emerald-700">Atomic Guarantee</p>
                  <p className="text-sm font-semibold text-emerald-900 mt-1">All-or-nothing rollback</p>
                </div>
              </div>

              {/* Review Table */}
              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase border-b">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Floor</th>
                        <th className="px-4 py-3">Meter Number</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {meterForms.map((item, idx) => (
                        <tr key={item.room_id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">Room {item.room_number}</td>
                          <td className="px-4 py-3 text-gray-600">Floor {item.floor}</td>
                          <td className="px-4 py-3 font-mono font-bold text-primary">{item.meter_number}</td>
                          <td className="px-4 py-3 text-gray-500">{item.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
              >
                Back to Edit Details
              </Button>
              <Button
                onClick={handleSubmitBulkCreation}
                disabled={isSubmitting || meterForms.length === 0}
                className="gap-2 min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating Meters...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Create {meterForms.length} Meter{meterForms.length === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function BulkMeterCreationPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="h-10 w-48 animate-pulse bg-gray-100 rounded mb-4" />
        <div className="h-64 animate-pulse bg-gray-50 rounded-xl border" />
      </div>
    }>
      <BulkMeterCreationContent />
    </Suspense>
  );
}
