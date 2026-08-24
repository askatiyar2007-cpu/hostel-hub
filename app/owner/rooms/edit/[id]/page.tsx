'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading room details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center space-x-4">
        <Link href="/owner/rooms" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Edit Room</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Hostel</h3>
          </div>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              required
              className="input h-12 w-full pl-10 text-base font-medium"
              value={formData.hostel_id}
              onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
            >
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
              value={formData.floor}
              onChange={(e) =>
                setFormData({ ...formData, floor: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
          className="w-full rounded-full bg-primary p-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}