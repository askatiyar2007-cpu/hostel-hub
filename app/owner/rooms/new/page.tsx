'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

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

    const capacityNum = Number(formData.capacity);
    if (!capacityNum || capacityNum < 1) {
      toast.error('Please enter a valid capacity of at least 1');
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
          capacity: capacityNum,
          rent: Number(formData.rent),
          security_deposit: Number(formData.security_deposit),
          facilities: formData.facilities.split(',').map(s => s.trim()).filter(s => s !== ''),
          status: 'available'
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Create beds based on the confirmed capacity
      const beds = [];
      for (let i = 1; i <= capacityNum; i++) {
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
    <div className="p-6 md:p-8 lg:p-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">Create Room</h1>
        <p className="text-sm text-muted-foreground">Add a room and generate bed records for one of your hostels.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Hostel Selection */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">1</span>
            Hostel Selection
          </h3>
          <div>
            <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
              Select Hostel *
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-teal-600" />
              <select
                required
                className="w-full h-12 pl-11 pr-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm font-medium text-foreground transition-all"
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
        </div>

        {/* Card 2: Room Details & Capacity */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="w-6 h-6 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center text-xs font-bold border border-teal-100">2</span>
            Room Configuration & Capacity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Room Number *
              </label>
              <Input
                required
                placeholder="e.g. 101"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                className="h-11 bg-background border-border text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Floor *
              </label>
              <Input
                required
                type="number"
                placeholder="0 for ground"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                className="h-11 bg-background border-border text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Room Type *
              </label>
              <select
                className="w-full h-11 px-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm font-medium text-foreground transition-all"
                value={formData.room_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const suggested = newType === 'single' ? 1 : newType === 'double' ? 2 : newType === 'triple' ? 3 : newType === 'quad' ? 4 : formData.capacity;
                  setFormData(prev => ({ ...prev, room_type: newType, capacity: suggested }));
                }}
              >
                <option value="single">Single Sharing</option>
                <option value="double">Double Sharing</option>
                <option value="triple">Triple Sharing</option>
                <option value="quad">Four Sharing</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Capacity (Total Beds) *
              </label>
              <Input
                required
                type="number"
                min="1"
                placeholder="e.g. 2"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                className="h-11 bg-background border-border text-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Will create {formData.capacity || 0} bed{(formData.capacity || 0) === 1 ? '' : 's'} in this room
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Monthly Rent (₹) *
              </label>
              <Input
                required
                type="number"
                min="0"
                placeholder="5000"
                value={formData.rent}
                onChange={(e) => setFormData({ ...formData, rent: Number(e.target.value) })}
                className="h-11 bg-background border-border text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Security Deposit (₹) *
              </label>
              <Input
                required
                type="number"
                min="0"
                placeholder="5000"
                value={formData.security_deposit}
                onChange={(e) => setFormData({ ...formData, security_deposit: Number(e.target.value) })}
                className="h-11 bg-background border-border text-foreground"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-foreground/80 block mb-1.5">
                Facilities (comma separated)
              </label>
              <Input
                placeholder="AC, Attached Washroom, Balcony"
                value={formData.facilities}
                onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                className="h-11 bg-background border-border text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/owner/rooms">
            <Button type="button" variant="outline" className="border-border">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading || hostels.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </Button>
        </div>
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