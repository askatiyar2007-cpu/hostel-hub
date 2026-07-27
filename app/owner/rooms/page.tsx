'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Plus, Home, Edit2, Trash2, MapPin } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface RoomWithHostel {
  id: string;
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
}

export default function OwnerRoomsPage() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithHostel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    if (!profile?.user_id) return;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, hostels!inner(name, owner_id)')
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
    fetchRooms();
  }, [fetchRooms]);

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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rooms Management</h1>
          <p className="text-gray-500">Manage rooms and availability across your hostels</p>
        </div>
        <Link href="/owner/rooms/new" className="btn-primary flex items-center space-x-2">
          <Plus size={20} />
          <span>Add Room</span>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">
          Loading rooms...
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
           <p className="text-gray-400">No rooms found. Create your first room to get started.</p>
           <Link href="/owner/rooms/new" className="text-blue-600 font-bold mt-2 inline-block hover:underline">
            Add Room →
           </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <Home size={24} />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${
                  room.status === 'available' ? 'bg-green-100 text-green-700' : 
                  room.status === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>
                  {room.status}
                </span>
              </div>
              
              <div className="absolute top-6 right-6 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/owner/rooms/edit/${room.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 size={16} />
                </Link>
                <button 
                  onClick={() => handleDelete(room.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <h3 className="text-lg font-bold">Room {room.room_number}</h3>
              <p className="text-sm text-gray-500 mb-2 flex items-center">
                <MapPin size={14} className="mr-1" />
                {room.hostels?.name}
              </p>
              <p className="text-sm text-gray-500 mb-4 capitalize">{room.room_type} Sharing</p>
              
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Rent</span>
                  <span className="font-semibold">₹{Number(room.rent).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity</span>
                  <span className="font-semibold">{room.capacity} beds</span>
                </div>
                {(() => {
                  const occupied = room.occupied_count !== undefined && room.occupied_count !== null 
                    ? room.occupied_count 
                    : (room.occupancy ?? 0);
                  const remaining = Math.max(0, room.capacity - occupied);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Occupied</span>
                        <span className="font-semibold">{occupied} beds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Remaining Beds</span>
                        <span className="font-semibold">{remaining} beds</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <Link href={`/owner/rooms/${room.id}`} className="w-full btn-secondary py-2 flex items-center justify-center space-x-2">
                <span>View Details</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
