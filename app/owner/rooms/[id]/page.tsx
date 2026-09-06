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

export default function ViewRoomPage() {
  const { profile } = useAuth();
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
        .select('student_id, student_name, start_date')
        .eq('room_id', id)
        .eq('active', true);
      
      setAllocations(allocationsData || []);
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

  const occupiedCount = allocations.length;

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Link href="/owner/rooms" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors mt-1">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">Room {roomData?.room_number}</h1>
              <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium">
                {occupiedCount} / {roomData?.capacity || 1} occupied
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <MapPin size={16} className="text-teal-600" />
              <span>{hostels.find(h => h.id === formData.hostel_id)?.name}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/owner/rooms/new">
            <Button variant="outline" className="border-gray-300">
              Create Room
            </Button>
          </Link>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            Delete Room
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Residents */}
          <Card className="border-teal-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Residents ({allocations.length})</h2>
              {allocations.length === 0 ? (
                <p className="text-gray-600 italic">No residents currently assigned to this room.</p>
              ) : (
                <div className="space-y-3">
                  {allocations.map((allocation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div>
                        <p className="font-medium text-gray-900">{allocation.student_name}</p>
                        <p className="text-xs text-gray-500">Since {new Date(allocation.start_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card className="border-teal-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Room Details</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hostel
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    value={formData.hostel_id}
                    onChange={(e) => setFormData({ ...formData, hostel_id: e.target.value })}
                  >
                    {hostels.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Number
                    </label>
                    <Input
                      required
                      value={formData.room_number}
                      onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                      className="bg-white border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Floor
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
                      className="bg-white border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Type
                    </label>
                    <select
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Capacity
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="bg-white border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Rent (₹)
                    </label>
                    <Input
                      required
                      type="number"
                      value={formData.rent}
                      onChange={(e) => setFormData({ ...formData, rent: Number(e.target.value) })}
                      className="bg-white border-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Facilities (comma separated)
                    </label>
                    <Input
                      value={formData.facilities}
                      onChange={(e) => setFormData({ ...formData, facilities: e.target.value })}
                      className="bg-white border-gray-200"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <Link href="/owner/rooms">
                    <Button type="button" variant="outline" className="border-gray-300">
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
          <Card className="border-teal-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Monthly Rent</span>
                  <span className="font-semibold text-gray-900">₹{Number(formData.rent).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Security Deposit</span>
                  <span className="font-semibold text-gray-900">₹{Number(formData.security_deposit).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facilities */}
          <Card className="border-teal-200 shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Facilities</h2>
              <div className="flex flex-wrap gap-2">
                {formData.facilities ? formData.facilities.split(',').map((f, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 text-sm border border-teal-100">
                    {f.trim()}
                  </span>
                )) : (
                  <p className="text-gray-600 italic text-sm">No facilities listed</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}