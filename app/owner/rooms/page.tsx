'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Plus, Home, Edit2, Trash2, MapPin } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface RoomWithHostel {
  id: string;
  hostel_id: string;
  room_number: string;
  room_type: string;
  status: string;
  rent: number;
  capacity: number;
  occupied_count?: number;
  occupancy?: number;
  hostels: {
    name: string;
  };
  room_allocations?: {
    id: string;
    active: boolean;
  }[];
}

export default function OwnerRoomsPage() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithHostel[]>([]);
  const [hostels, setHostels] = useState<{ id: string; name: string }[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, hostels!inner(name, owner_id), room_allocations(id, active)')
        .eq('hostels.owner_id', profile.user_id);

      if (error) throw error;
      setRooms((data as unknown as RoomWithHostel[]) || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    async function fetchHostels() {
      if (!profile?.user_id) return;
      const { data } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', profile.user_id)
        .order('name');
      setHostels(data || []);
    }
    fetchHostels();
    fetchRooms();
  }, [profile?.user_id, fetchRooms]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room? This will also delete all bed records associated with it.')) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Room deleted successfully');
      fetchRooms();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    }
  };

  const filteredRooms = rooms.filter(room => 
    selectedHostel === 'all' || room.hostel_id === selectedHostel
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Rooms Management</h1>
          <p className="text-muted-foreground">Manage rooms and availability across your hostels</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Hostels</option>
            {hostels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <Link 
            href={selectedHostel !== 'all' ? `/owner/rooms/bulk?hostelId=${selectedHostel}` : "/owner/rooms/bulk"}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-6 py-2.5 font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus size={20} />
            <span>Bulk Create</span>
          </Link>
          <Link 
            href={selectedHostel !== 'all' ? `/owner/rooms/new?hostelId=${selectedHostel}` : "/owner/rooms/new"} 
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <Plus size={20} />
            <span>Add Room</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Loading rooms...</p>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 py-20 text-center">
           <p className="text-muted-foreground">No rooms found. Create your first room to get started.</p>
           <Link 
             href={selectedHostel !== 'all' ? `/owner/rooms/new?hostelId=${selectedHostel}` : "/owner/rooms/new"} 
             className="mt-2 inline-block font-semibold text-primary hover:underline"
           >
            Add Room &rarr;
           </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <div key={room.id} className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Home size={24} />
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${
                  room.status === 'available' ? 'bg-green-100 text-green-700' : 
                  room.status === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>
                  {room.status}
                </span>
              </div>
              
              <div className="absolute top-6 right-6 flex space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Link href={`/owner/rooms/edit/${room.id}`} className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/10">
                  <Edit2 size={16} />
                </Link>
                <button 
                  onClick={() => handleDelete(room.id)}
                  className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h3 className="text-lg font-semibold font-display text-foreground">Room {room.room_number}</h3>
              <p className="mb-2 flex items-center text-sm text-muted-foreground">
                <MapPin size={14} className="mr-1" />
                {room.hostels?.name}
              </p>
              <p className="mb-4 text-sm capitalize text-muted-foreground">{room.room_type} Sharing</p>
              
              <div className="mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-semibold text-foreground">₹{Number(room.rent).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-semibold text-foreground">{room.capacity} beds</span>
                </div>
                {(() => {
                  const occupied = room.room_allocations?.filter((a: any) => a.active === true).length ?? 0;
                  const remaining = Math.max(0, room.capacity - occupied);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Occupied</span>
                        <span className="font-semibold text-foreground">{occupied} beds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining Beds</span>
                        <span className="font-semibold text-foreground">{remaining} beds</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <Link href={`/owner/rooms/edit/${room.id}`} className="flex w-full items-center justify-center space-x-2 rounded-xl border border-border bg-muted/40 py-2 font-semibold text-foreground transition-colors hover:bg-muted">
                <span>View Details</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}