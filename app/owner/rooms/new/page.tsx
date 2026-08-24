'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';

// Room type labels already describe an occupant count ("Single Sharing" = 1,
// "Double Sharing" = 2, "Triple Sharing" = 3, "Four Sharing" = 4). Capacity is
// derived from this existing naming convention rather than manually entered,
// so bed generation on submit still receives a correct, non-empty value.
const CAPACITY_BY_ROOM_TYPE: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  quad: 4
};

function AddRoomForm() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultHostelId = searchParams.get('hostelId') || '';
  const [loading, setLoading] = useState(false);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  
  const [formData, setFormData] = useState({
    hostel_id: '',
    room_number: '',
    floor: 0,
    room_type: 'double',
    rent: 0,
    security_deposit: 0,
    facilities: ''
  });

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
        setFormData(prev => ({ ...prev, hostel_id: initialHostelId }));
      }
    }
    fetchHostels();
  }, [profile, defaultHostelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostel_id) {
      toast.error('Please select a hostel');
      return;
    }
    setLoading(true);

    try {
      const capacity = CAPACITY_BY_ROOM_TYPE[formData.room_type] ?? 1;

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          hostel_id: formData.hostel_id,
          room_number: formData.room_number,
          floor: Number(formData.floor),
          room_type: formData.room_type,
          capacity,
          rent: Number(formData.rent),
          security_deposit: Number(formData.security_deposit),
          facilities: formData.facilities.split(',').map(s => s.trim()).filter(s => s !== ''),
          status: 'available'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create beds based on the derived capacity
      const beds = [];
      for (let i = 1; i <= capacity; i++) {
        beds.push({
          room_id: roomData.id,
          bed_number: i,
          status: 'available'
        });
      }

      const { error: bedsError } = await supabase.from('beds').insert(beds);
      if (bedsError) throw bedsError;

      toast.success('Room and beds created successfully!');
      router.push('/owner/rooms');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const derivedCapacity = CAPACITY_BY_ROOM_TYPE[formData.room_type] ?? 1;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center space-x-4">
        <Link href="/owner/rooms" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Add New Room</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
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
              value={formData.hostel_id}
              onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
            >
              {hostels.length === 0 && <option value="">No hostels found</option>}
              {hostels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Room Number
            </label>
            <input
              required
              type="text"
              className="input w-full"
              placeholder="e.g. 101"
              value={formData.room_number}
              onChange={(e) =>
                setFormData({ ...formData, room_number: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Floor
            </label>
            <input
              required
              type="number"
              className="input w-full"
              placeholder="0 for ground"
              value={formData.floor}
              onChange={(e) =>
                setFormData({ ...formData, floor: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Room Type
          </label>
          <select
            className="input w-full"
            value={formData.room_type}
            onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
          >
            <option value="single">Single Sharing</option>
            <option value="double">Double Sharing</option>
            <option value="triple">Triple Sharing</option>
            <option value="quad">Four Sharing</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            This room will be created with {derivedCapacity} bed{derivedCapacity === 1 ? '' : 's'}, based on the selected room type.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Monthly Rent (₹)
            </label>
            <input
              required
              type="number"
              className="input w-full"
              placeholder="5000"
              value={formData.rent}
              onChange={(e) =>
                setFormData({ ...formData, rent: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              Security Deposit (₹)
            </label>
            <input
              required
              type="number"
              className="input w-full"
              placeholder="5000"
              value={formData.security_deposit}
              onChange={(e) =>
                setFormData({ ...formData, security_deposit: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Facilities (Comma separated)
          </label>
          <input
            type="text"
            className="input w-full"
            placeholder="AC, Attached Washroom, Balcony"
            value={formData.facilities}
            onChange={(e) =>
              setFormData({ ...formData, facilities: e.target.value })
            }
          />
        </div>

        <button
          disabled={loading || hostels.length === 0}
          type="submit"
          className="w-full rounded-full bg-primary p-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </form>
    </div>
  );
}

export default function AddRoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <AddRoomForm />
    </Suspense>
  );
}