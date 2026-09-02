'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
const CAPACITY_BY_ROOM_TYPE = {
  single: 1,
  double: 2,
  triple: 3,
  quad: 4
} as const;




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
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  
  // Room number generation state
  const [useSequential, setUseSequential] = useState(false);
  const [startRoom, setStartRoom] = useState('');
  const [endRoom, setEndRoom] = useState('');

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

  const addRoom = () => {
    setRooms([...rooms, {
      room_number: '',
      floor: 0,
      room_type: 'double',
      rent: 0,
      security_deposit: 0,
      facilities: []
    }]);
  };

  const removeRoom = (index: number) => {
    setRooms(rooms.filter((_, i) => i !== index));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  const updateRoom = (index: number, field: keyof RoomRow, value: any) => {
    const updatedRooms = [...rooms];
    updatedRooms[index] = { ...updatedRooms[index], [field]: value };
    setRooms(updatedRooms);
    
    // Clear error for this field when user fixes it
    if (errors[index]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
  };

  const generateSequentialRooms = () => {
    const start = parseInt(startRoom);
    const end = parseInt(endRoom);
    
    if (isNaN(start) || isNaN(end) || start > end) {
      toast.error('Invalid room number range');
      return;
    }
    
    if (end - start + 1 > 50) {
      toast.error('Maximum 50 rooms per batch');
      return;
    }
    
    const newRooms: RoomRow[] = [];
    for (let i = start; i <= end; i++) {
      newRooms.push({
        room_number: i.toString(),
        floor: 0,
        room_type: 'double',
        rent: 0,
        security_deposit: 0,
        facilities: []
      });
    }
    
    setRooms(newRooms);
    setUseSequential(false);
    setStartRoom('');
    setEndRoom('');
  };

  const validateRoom = (room: RoomRow, index: number): string | null => {
    if (!room.room_number.trim()) {
      return 'Room number is required';
    }
    
    // Check for duplicates in current batch
    const duplicateIndex = rooms.findIndex((r, i) => 
      i !== index && r.room_number.trim() === room.room_number.trim()
    );
    
    if (duplicateIndex !== -1) {
      return `Duplicate room number in batch (row ${duplicateIndex + 1})`;
    }
    
    return null;
  };

  const validateBatch = async (): Promise<boolean> => {
    const newErrors: Record<number, string> = {};
    let hasErrors = false;

    // Client-side validation
    rooms.forEach((room, index) => {
      const error = validateRoom(room, index);
      if (error) {
        newErrors[index] = error;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      toast.error('Please fix validation errors before submitting');
      return false;
    }

    if (!hostelId) {
      toast.error('Please select a hostel');
      return false;
    }

    // Server-side validation for existing room numbers
    try {
      const roomNumbers = rooms.map(r => r.room_number.trim());
      const { data: existingRooms } = await supabase
        .from('rooms')
        .select('room_number')
        .eq('hostel_id', hostelId)
        .in('room_number', roomNumbers);

      if (existingRooms && existingRooms.length > 0) {
        const existingNumbers = existingRooms.map(r => r.room_number);
        const conflictingRooms = rooms.filter(r => existingNumbers.includes(r.room_number.trim()));
        
        conflictingRooms.forEach((room) => {
          const originalIndex = rooms.indexOf(room);
          newErrors[originalIndex] = 'Room number already exists in this hostel';
        });
        
        setErrors(newErrors);
        toast.error('Some room numbers already exist in this hostel');
        return false;
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate room numbers');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rooms.length === 0) {
      toast.error('Please add at least one room');
      return;
    }

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

      toast.success(`${data.rooms_created} rooms created successfully!`);
      router.push('/owner/rooms');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/owner/rooms" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Bulk Create Rooms</h1>
        </div>
        <Link 
          href="/owner/rooms/new" 
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus size={16} />
          Single Room
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hostel Selection */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Select Hostel</h3>
          </div>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              required
              className="input h-12 w-full pl-10 text-base font-medium"
              value={hostelId}
              onChange={(e) => setHostelId(e.target.value)}
              disabled={loading}
            >
              {hostels.length === 0 && <option value="">No hostels found</option>}
              {hostels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Room Number Generation */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Quick Room Number Generation</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useSequential}
                onChange={(e) => setUseSequential(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-muted-foreground">Use sequential numbering</span>
            </label>
          </div>
          
          {useSequential && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Starting Room
                </label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="101"
                  value={startRoom}
                  onChange={(e) => setStartRoom(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground">
                  Ending Room
                </label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="120"
                  value={endRoom}
                  onChange={(e) => setEndRoom(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={generateSequentialRooms}
                  className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Generate Rooms
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Room Rows */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Rooms ({rooms.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={addRoom}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Room
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No rooms added yet. Click "Add Room" to begin.
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room, index) => (
                <div 
                  key={index} 
                  className={`rounded-lg border p-4 ${errors[index] ? 'border-destructive bg-destructive/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Room Number *
                        </label>
                        <input
                          type="text"
                          className="input w-full"
                          placeholder="101"
                          value={room.room_number}
                          onChange={(e) => updateRoom(index, 'room_number', e.target.value)}
                          disabled={loading}
                        />
                        {errors[index] && (
                          <p className="mt-1 text-xs text-destructive">{errors[index]}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Floor
                        </label>
                        <input
                          type="number"
                          className="input w-full"
                          placeholder="0"
                          value={room.floor}
                          onChange={(e) => updateRoom(index, 'floor', parseInt(e.target.value) || 0)}
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Room Type
                        </label>
                        <select
                          className="input w-full"
                          value={room.room_type}
                          onChange={(e) => updateRoom(index, 'room_type', e.target.value as any)}
                          disabled={loading}
                        >
                          <option value="single">Single Sharing ({CAPACITY_BY_ROOM_TYPE.single} bed)</option>
                          <option value="double">Double Sharing ({CAPACITY_BY_ROOM_TYPE.double} beds)</option>
                          <option value="triple">Triple Sharing ({CAPACITY_BY_ROOM_TYPE.triple} beds)</option>
                          <option value="quad">Four Sharing ({CAPACITY_BY_ROOM_TYPE.quad} beds)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Monthly Rent (₹)
                        </label>
                        <input
                          type="number"
                          className="input w-full"
                          placeholder="5000"
                          value={room.rent}
                          onChange={(e) => updateRoom(index, 'rent', parseFloat(e.target.value) || 0)}
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Security Deposit (₹)
                        </label>
                        <input
                          type="number"
                          className="input w-full"
                          placeholder="5000"
                          value={room.security_deposit}
                          onChange={(e) => updateRoom(index, 'security_deposit', parseFloat(e.target.value) || 0)}
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          Facilities (Comma separated)
                        </label>
                        <input
                          type="text"
                          className="input w-full"
                          placeholder="AC, Attached Washroom, Balcony"
                          value={room.facilities.join(', ')}
                          onChange={(e) => updateRoom(index, 'facilities', e.target.value.split(',').map(s => s.trim()).filter(s => s !== ''))}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRoom(index)}
                      disabled={loading}
                      className="mt-2 md:mt-0 p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || rooms.length === 0 || hostels.length === 0}
          className="w-full rounded-full bg-primary p-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? `Creating ${rooms.length} rooms...` : `Create ${rooms.length} rooms`}
        </button>
      </form>
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