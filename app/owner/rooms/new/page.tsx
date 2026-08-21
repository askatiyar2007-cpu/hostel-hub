'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
    capacity: 2,
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
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          hostel_id: formData.hostel_id,
          room_number: formData.room_number,
          floor: Number(formData.floor),
          room_type: formData.room_type,
          capacity: Number(formData.capacity),
          rent: Number(formData.rent),
          security_deposit: Number(formData.security_deposit),
          facilities: formData.facilities.split(',').map(s => s.trim()).filter(s => s !== ''),
          status: 'available'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create beds based on capacity
      const beds = [];
      for (let i = 1; i <= Number(formData.capacity); i++) {
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/owner/rooms" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add New Room</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl border-2 border-gray-100 shadow-xl space-y-6"
      >
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Select Hostel
          </label>
          <select
            required
            className="input w-full"
            value={formData.hostel_id}
            onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
          >
            {hostels.length === 0 && <option value="">No hostels found</option>}
            {hostels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
            <label className="block text-sm font-bold text-gray-700 mb-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Capacity (Number of Beds)
            </label>
            <input
              required
              type="number"
              min="1"
              className="input w-full"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
            <label className="block text-sm font-bold text-gray-700 mb-2">
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
          <label className="block text-sm font-bold text-gray-700 mb-2">
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
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg disabled:bg-gray-400"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </form>
    </div>
  );
}

export default function AddRoomPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AddRoomForm />
    </Suspense>
  );
}
