'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { calculateRoomOccupancy } from '@/lib/utils/occupancy';

export default function ViewRoomPage() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  
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
      const ownerId = user?.id || profile?.user_id;
      if (!id || !ownerId) return;

      // Fetch hostels for dropdown
      const { data: hostelsData } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', ownerId);
      
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

      setRoomData(roomData);
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

      // Fetch allocations for residents
      const { data: allocationsData } = await supabase
        .from('room_allocations')
        .select('student_id, student_name, start_date, booking_type')
        .eq('room_id', id)
        .eq('active', true);
      
      setAllocations(allocationsData || []);
      setLoading(false);
    }

    fetchData();
  }, [id, user?.id, profile?.user_id, router]);

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

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this room? This will also delete all bed records associated with it.')) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Room deleted successfully');
      router.push('/owner/rooms');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm font-medium text-gray-600">Loading room details...</p>
        </div>
      </div>
    );
  }

  const { occupied: occupiedCount } = calculateRoomOccupancy(roomData?.capacity || 1, allocations);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/owner/rooms" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#16364a] text-slate-600 dark:text-slate-400 transition-colors mt-1">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Room {roomData?.room_number}</h1>
              <span className="bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-3 py-1 rounded-full text-sm font-medium">
                {occupiedCount} / {roomData?.capacity || 1} occupied
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600 dark:text-slate-400">
              <MapPin size={16} className="text-teal-600 dark:text-teal-400" />
              <span>{hostels.find(h => h.id === formData.hostel_id)?.name}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/owner/rooms/new">
            <Button variant="outline" className="border-slate-300 dark:border-[#1a3d52] dark:text-slate-200 dark:hover:bg-[#16364a]">
              Create Room
            </Button>
          </Link>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            Delete Room
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Residents */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Residents ({allocations.length})</h2>
              {allocations.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 italic">No residents currently assigned to this room.</p>
              ) : (
                <div className="space-y-3">
                  {allocations.map((allocation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#122b3b] rounded-xl border border-slate-100 dark:border-[#1a3d52]">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{allocation.student_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Since {new Date(allocation.start_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Edit Room Details</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Hostel
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#122b3b] border border-gray-200 dark:border-[#1a3d52] text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
                    value={formData.hostel_id}
                    onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                  >
                    {hostels.map(h => (
                      <option key={h.id} value={h.id} className="dark:bg-[#0e222e]">{h.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Room Number
                    </label>
                    <Input
                      required
                      value={formData.room_number}
                      onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                      className="bg-white dark:bg-[#122b3b] border-gray-200 dark:border-[#1a3d52] dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Floor
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                      className="bg-white dark:bg-[#122b3b] border-gray-200 dark:border-[#1a3d52] dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Room Type
                    </label>
                    <select
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#122b3b] border border-gray-200 dark:border-[#1a3d52] text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                    >
                      <option value="single" className="dark:bg-[#0e222e]">Single Sharing</option>
                      <option value="double" className="dark:bg-[#0e222e]">Double Sharing</option>
                      <option value="triple" className="dark:bg-[#0e222e]">Triple Sharing</option>
                      <option value="quad" className="dark:bg-[#0e222e]">Four Sharing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Capacity
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="bg-white dark:bg-[#122b3b] border-gray-200 dark:border-[#1a3d52] dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Monthly Rent (₹)
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.rent}
                      onChange={(e) => setFormData({ ...formData, rent: Number(e.target.value) })}
                      className="bg-white dark:bg-[#122b3b] border-gray-200 dark:border-[#1a3d52] dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Status
                    </label>
                    <select
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#122b3b] border border-gray-200 dark:border-[#1a3d52] text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="available" className="dark:bg-[#0e222e]">Available</option>
                      <option value="occupied" className="dark:bg-[#0e222e]">Occupied</option>
                      <option value="maintenance" className="dark:bg-[#0e222e]">Maintenance</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Facilities (comma separated)
                    </label>
                    <Input
                      value={formData.facilities}
                      onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                      className="bg-white dark:bg-[#122b3b] border-gray-200 dark:border-[#1a3d52] dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#1a3d52]">
                  <Link href="/owner/rooms">
                    <Button type="button" variant="outline" className="border-slate-300 dark:border-[#1a3d52] dark:text-slate-300 dark:hover:bg-[#16364a]">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Financial</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Monthly Rent</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">₹{Number(formData.rent).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Security Deposit</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">₹{Number(formData.security_deposit).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facilities */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Facilities</h2>
              <div className="flex flex-wrap gap-2">
                {formData.facilities ? formData.facilities.split(',').map((f, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 text-sm border border-teal-100 dark:border-teal-800">
                    {f.trim()}
                  </span>
                )) : (
                  <p className="text-slate-500 dark:text-slate-400 italic text-sm">No facilities listed</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}