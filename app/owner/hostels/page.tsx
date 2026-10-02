'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/app/components/EmptyState';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/context';
import { Hostel } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from "@/components/owner/page-header";
import { OwnerHostelCard } from '@/components/owner/owner-hostel-card';
import { calculateHostelOccupancy } from '@/lib/utils/occupancy';

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
          .select('hostel_id, room_id, student_id, student_name, start_date, booking_type')
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
    const {
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyPercentage
    } = calculateHostelOccupancy(hostelRooms, hostelAllocations);

    return {
      ...hostel,
      totalRooms: hostelRooms.length,
      totalResidents: hostelAllocations.length,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancy: occupancyPercentage,
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

  return (
    <div className="w-full">
      {/* Page Header */}
      <PageHeader 
        title="Hostels"
        description="Manage your hostel properties, location details, and operations."
      >
        <Link
          href="/owner/hostels/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 font-semibold text-sm transition-colors shadow-xs"
        >
          <Plus size={18} />
          <span>Add Hostel</span>
        </Link>
      </PageHeader>

      {/* Search Toolbar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search properties by name, location, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 bg-white border-slate-200 rounded-xl text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearFilters}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
            <Card key={i} className="border-slate-200/90 shadow-xs overflow-hidden rounded-xl bg-white">
              <CardContent className="p-0">
                <div className="h-36 sm:h-38 bg-slate-100 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <div className="h-8 bg-slate-100 rounded animate-pulse" />
                    <div className="h-8 bg-slate-100 rounded animate-pulse" />
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
            <OwnerHostelCard 
              key={hostel.id} 
              hostel={{
                ...hostel,
                occupiedBeds: hostel.totalResidents ?? 0,
                availableBeds: hostel.availableBeds ?? 0,
              }} 
              variant="hostels-page" 
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
