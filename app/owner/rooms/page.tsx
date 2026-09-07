'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Plus, Trash2, Search, Bed, X, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { StatusBadge } from '@/components/owner/status-badge';
import { IconWrapper } from '@/components/owner/icon-wrapper';

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
  const [searchQuery, setSearchQuery] = useState('');
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
      toast.error('Failed to load rooms');
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

  // Calculate summary metrics
  const totalRooms = rooms.length;
  const totalBeds = rooms.reduce((sum, room) => sum + (room.capacity || 0), 0);
  const occupiedBeds = rooms.reduce((sum, room) => {
    const occupied = room.room_allocations?.filter((a: any) => a.active === true).length ?? 0;
    return sum + occupied;
  }, 0);
  const availableBeds = totalBeds - occupiedBeds;
  const overallOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Calculate per-room metrics
  const roomsWithMetrics = rooms.map(room => {
    const occupied = room.room_allocations?.filter((a: any) => a.active === true).length ?? 0;
    const remaining = Math.max(0, room.capacity - occupied);
    const occupancy = room.capacity > 0 ? Math.round((occupied / room.capacity) * 100) : 0;

    return {
      ...room,
      occupied,
      remaining,
      occupancy,
    };
  });

  // Filter rooms
  const filteredRooms = roomsWithMetrics.filter(room => {
    const matchesHostel = selectedHostel === 'all' || room.hostel_id === selectedHostel;
    const matchesSearch = searchQuery === '' ||
      room.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.hostels?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.room_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesHostel && matchesSearch;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedHostel('all');
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-[1800px] min-w-0 max-w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Rooms
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-500">
            Manage rooms, occupancy, and availability across your hostels.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={selectedHostel !== 'all' ? `/owner/rooms/bulk?hostelId=${selectedHostel}` : "/owner/rooms/bulk"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 font-semibold text-sm transition-colors shadow-xs"
          >
            <Plus size={18} />
            <span>Bulk Create</span>
          </Link>
          <Link
            href={selectedHostel !== 'all' ? `/owner/rooms/new?hostelId=${selectedHostel}` : "/owner/rooms/new"}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 font-semibold text-sm transition-colors shadow-xs"
          >
            <Plus size={18} />
            <span>Add Room</span>
          </Link>
        </div>
      </div>

      {/* Compact Operational Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 px-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="font-medium text-slate-900">{totalRooms} rooms</span>
          <span>·</span>
          <span>{totalBeds} beds</span>
          <span>·</span>
          <span className="font-medium text-slate-900">{occupiedBeds} occupied</span>
          <span>·</span>
          <span>{availableBeds} available</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Occupancy:</span>
          <span className="font-semibold text-slate-900">{overallOccupancy}%</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search rooms by number, hostel, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-white border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          >
            <option value="all">All Hostels</option>
            {hostels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          {(searchQuery || selectedHostel !== 'all') && (
            <Button
              variant="outline"
              size="default"
              onClick={clearFilters}
              className="h-10"
            >
              <X size={16} className="mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs animate-pulse space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 bg-slate-200 rounded w-28" />
                <div className="h-5 bg-slate-200 rounded-full w-20" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-36" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-20" />
                <div className="h-8 bg-slate-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState hasFilters={!!(searchQuery || selectedHostel !== 'all')} onClearFilters={clearFilters} selectedHostel={selectedHostel} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const isFull = room.remaining === 0;
            return (
              <div 
                key={room.id} 
                className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Room Number + Status Badge + Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <IconWrapper color="blue" size="md">
                        <Bed className="h-4 w-4" />
                      </IconWrapper>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-slate-900 tracking-tight">
                            Room {room.room_number}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">
                            {room.room_type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-700 truncate max-w-[180px] block" title={room.hostels?.name}>
                            {room.hostels?.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={room.status} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 rounded-lg">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-slate-200 rounded-xl shadow-lg">
                          <DropdownMenuItem asChild className="cursor-pointer text-xs font-medium text-slate-700">
                            <Link href={`/owner/rooms/edit/${room.id}`}>
                              Edit Room
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(room.id)}
                            className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer text-xs font-medium"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete Room
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Prominent Occupancy Section with Blue Identity */}
                  <div className="mt-4 p-3.5 bg-blue-50/60 border border-blue-100/90 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Occupancy</span>
                      <span className="text-xs font-bold text-blue-900 bg-white border border-blue-200/90 px-2.5 py-0.5 rounded-full shadow-2xs">
                        {room.occupied} / {room.capacity} occupied
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          isFull ? 'bg-amber-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, room.occupancy)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-blue-950 font-medium pt-0.5">
                      <span>{room.remaining} bed{room.remaining !== 1 ? 's' : ''} available</span>
                      <span className="font-semibold">{room.occupancy}% filled</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Rent & View Details Button */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Monthly Rent</span>
                    <span className="text-base font-bold text-slate-900">₹{Number(room.rent).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 font-normal"> /mo</span>
                  </div>
                  <Link href={`/owner/rooms/${room.id}`}>
                    <Button size="sm" variant="outline" className="h-8 px-3.5 border-blue-200 text-blue-800 hover:bg-blue-50 text-xs font-semibold rounded-lg">
                      View Room
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters, selectedHostel }: { hasFilters: boolean; onClearFilters: () => void; selectedHostel: string }) {
  if (hasFilters) {
    return (
      <Card className="border-slate-200/80 bg-white rounded-xl shadow-sm">
        <CardContent className="p-12 text-center">
          <IconWrapper color="blue" size="lg" className="mx-auto mb-3">
            <Bed className="h-5 w-5" />
          </IconWrapper>
          <h3 className="text-base font-bold text-slate-900 mb-1">No rooms match your filters</h3>
          <p className="text-xs text-slate-500 mb-6">Try adjusting your search or filter criteria.</p>
          <Button variant="outline" onClick={onClearFilters} className="border-slate-200 text-slate-700">
            Clear Filters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-slate-200 bg-white/70 rounded-xl">
      <CardContent className="p-12 text-center">
        <IconWrapper color="blue" size="lg" className="mx-auto mb-3">
          <Bed className="h-5 w-5" />
        </IconWrapper>
        <h3 className="text-base font-bold text-slate-900 mb-1">No rooms yet</h3>
        <p className="text-xs text-slate-500 mb-6">Add your first room to start managing occupancy and availability.</p>
        <Link
          href={selectedHostel !== 'all' ? `/owner/rooms/new?hostelId=${selectedHostel}` : "/owner/rooms/new"}
        >
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus size={18} className="mr-2" />
            Add Room
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}