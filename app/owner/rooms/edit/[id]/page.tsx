'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditRoomPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  
  const [formData, setFormData] = useState({
    hostel_id: '',
    room_number: '',
    floor: 0,
    room_type: 'double',
    capacity: 2,
    rent: 0,
    security_deposit: 0,
    facilities: '',
    status: 'available'
  });

  useEffect(() => {
    async function fetchData() {
      if (!id || !profile?.id) return;

      // Fetch hostels for dropdown
      const { data: hostelsData } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', profile.id);
      
      setHostels(hostelsData || []);

      // Fetch room details
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (roomError) {
        toast.error('Failed to fetch room details');
        router.push('/owner/rooms');
        return;
      }

      setFormData({
        hostel_id: roomData.hostel_id,
        room_number: roomData.room_number,
        floor: roomData.floor || 0,
        room_type: roomData.room_type,
        capacity: roomData.capacity,
        rent: Number(roomData.rent),
        security_deposit: Number(roomData.security_deposit || 0),
        facilities: roomData.facilities ? roomData.facilities.join(', ') : '',
        status: roomData.status
      });
      setLoading(false);
    }

    fetchData();
  }, [id, profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          hostel_id: formData.hostel_id,
          room_number: formData.room_number,
          floor: Number(formData.floor),
          room_type: formData.room_type,
          capacity: Number(formData.capacity),
          rent: Number(formData.rent),
          security_deposit: Number(formData.security_deposit),
          facilities: formData.facilities.split(',').map(s => s.trim()).filter(s => s !== ''),
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Room updated successfully!');
      router.push('/owner/rooms');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Loading room details...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/owner/rooms" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Room</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl border-2 border-gray-100 shadow-xl space-y-6"
      >
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Hostel
          </label>
          <select
            required
            className="input w-full"
            value={formData.hostel_id}
            onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
          >
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
              Capacity
            </label>
            <input
              required
              type="number"
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
              value={formData.rent}
              onChange={(e) =>
                setFormData({ ...formData, rent: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Status
            </label>
            <select
              className="input w-full"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Facilities (Comma separated)
          </label>
          <input
            type="text"
            className="input w-full"
            value={formData.facilities}
            onChange={(e) =>
              setFormData({ ...formData, facilities: e.target.value })
            }
          />
        </div>

        <button
          disabled={saving}
          type="submit"
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg"
        >
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
