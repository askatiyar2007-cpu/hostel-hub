'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, MapPin, Trash2, Search, MoreVertical, Building2, X, Users, DoorOpen } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/app/components/EmptyState';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/context';
import { Hostel } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function HostelsListPage() {
  const { profile } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHostels = useCallback(async () => {
    if (!profile?.user_id) return;

    setLoading(true);
    try {
      const { data: hostelsData } = await supabase
        .from('hostels')
        .select('*')
        .eq('owner_id', profile.user_id)
        .order('created_at', { ascending: false });

      setHostels((hostelsData as Hostel[]) || []);

      if (hostelsData && hostelsData.length > 0) {
        const hostelIds = hostelsData.map(h => h.id);
        const { data: roomsData } = await supabase
          .from('rooms')
          .select('*')
          .in('hostel_id', hostelIds);
        
        setRooms(roomsData || []);

        const { data: allocationsData } = await supabase
          .from('room_allocations')
          .select('hostel_id, room_id, student_id, student_name, start_date')
          .in('hostel_id', hostelIds)
          .eq('active', true);
        
        setAllocations(allocationsData || []);
      }
    } catch (error) {
      console.error('Error fetching hostels:', error);
      toast.error('Failed to load hostels');
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hostel? This will also delete all rooms and assignments associated with it.')) return;

    try {
      const { error } = await supabase
        .from('hostels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Hostel deleted successfully');
      fetchHostels();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    }
  };

  // Calculate per-hostel counts
  const hostelsWithCounts = hostels.map(hostel => {
    const hostelRooms = rooms.filter(r => r.hostel_id === hostel.id);
    const hostelAllocations = allocations.filter(a => a.hostel_id === hostel.id);

    return {
      ...hostel,
      totalRooms: hostelRooms.length,
      totalResidents: hostelAllocations.length,
    };
  });

  // Filter hostels
  const filteredHostels = hostelsWithCounts.filter(hostel => {
    const matchesSearch = searchQuery === '' || 
      hostel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hostel.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hostel.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const clearFilters = () => {
    setSearchQuery('');
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending</span>;
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Approved</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Suspended</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 capitalize">{status || 'Unknown'}</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Hostels
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Manage your hostel properties, location details, and operations.
          </p>
        </div>
        <Link
          href="/owner/hostels/new"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 font-medium transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Add Hostel</span>
        </Link>
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search properties by name, location, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 bg-white border-gray-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearFilters}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-teal-200/60 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="h-44 bg-gray-100 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div className="h-8 bg-gray-100 rounded animate-pulse" />
                    <div className="h-8 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredHostels.length === 0 ? (
        <EmptyState hasFilters={!!searchQuery} onClearFilters={clearFilters} type="hostels" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHostels.map((hostel) => (
            <Card key={hostel.id} className="border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-card text-foreground">
              <CardContent className="p-0">
                {/* Property Image/Placeholder */}
                <div className="h-44 bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden">
                  {hostel.cover_image_url ? (
                    <img
                      src={hostel.cover_image_url}
                      alt={hostel.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-16 w-16 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 shadow-sm">
                    {getStatusBadge(hostel.status)}
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{hostel.name}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">{hostel.city}{hostel.state ? `, ${hostel.state}` : ''}</span>
                  </div>

                  {/* Property Quick Metrics */}
                  <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-md bg-white border border-slate-200 text-teal-700 shadow-2xs">
                        <DoorOpen size={16} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900 leading-none">{hostel.totalRooms}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Rooms</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-md bg-white border border-slate-200 text-teal-700 shadow-2xs">
                        <Users size={16} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900 leading-none">{hostel.totalResidents}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Residents</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/owner/hostels/${hostel.id}`} className="flex-1">
                      <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium">
                        View Hostel
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 border-gray-200 text-gray-600 hover:bg-gray-50">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/owner/hostels/edit/${hostel.id}`}>
                            Edit Hostel
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(hostel.id)}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 size={16} className="mr-2" />
                          Delete Hostel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
