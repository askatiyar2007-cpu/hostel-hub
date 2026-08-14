'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Search, Filter, MoreVertical, Plus, Users, Building2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function OwnerStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<string>('all');

  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch room_allocations as the primary table
      const { data, error: fetchError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          start_date,
          active,
          created_at,
          booking_type,
          status,
          student_name,
          student_email,
          student_phone,
          rooms (
            id,
            room_number,
            rent
          ),
          hostels!inner (
            id,
            name,
            owner_id
          ),
          students (
            id,
            college,
            course,
            year,
            profiles (
              id,
              full_name,
              email,
              phone_number,
              avatar_url,
              gender,
              date_of_birth
            )
          )
        `)
        .eq('hostels.owner_id', user.id)
        .eq('active', true);

      if (fetchError) throw fetchError;
      setAssignments(data || []);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError(err.message || 'Failed to load resident students.');
      toast.error('Error loading resident student allocations');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCheckout = async (allocId: string) => {
    if (!window.confirm('Are you sure you want to check out this student? This will deactivate their room allocation immediately.')) return;
    try {
      const { error: checkoutErr } = await supabase.rpc('checkout_student', { p_alloc_id: allocId });
      if (checkoutErr) throw checkoutErr;
      toast.success('Student checked out successfully!');
      fetchStudents();
    } catch (err: any) {
      console.error('Error checking out student:', err);
      const message = err.message || 'Failed to check out student';
      toast.error(message);
    }
  };

  const uniqueHostels = useMemo(() => {
    const hostels = assignments
      .map(a => a.hostels)
      .filter((h): h is { id: string; name: string } => h !== null && h !== undefined);
    
    const unique = Array.from(new Map(hostels.map(h => [h.id, h])).values());
    return unique;
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const profile = a.students?.profiles;
      const name = (profile?.full_name || a.student_name || '').toLowerCase();
      const email = (profile?.email || a.student_email || '').toLowerCase();
      const phone = (profile?.phone_number || a.student_phone || '').toLowerCase();
      const roomNum = (a.rooms?.room_number || '').toLowerCase();
      const hostelName = (a.hostels?.name || '').toLowerCase();
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        roomNum.includes(query) ||
        hostelName.includes(query);
      
      const matchesHostel = selectedHostel === 'all' || a.hostels?.id === selectedHostel;
      
      return matchesSearch && matchesHostel;
    });
  }, [assignments, searchQuery, selectedHostel]);

  return (
    <DashboardShell 
      title="Students" 
      subtitle="Manage residents across all your hostels" 
      badge="Residents"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Search by name, email, phone or room..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter size={18} />
                <span>{selectedHostel === 'all' ? 'All Hostels' : uniqueHostels.find(h => h.id === selectedHostel)?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedHostel('all')}>All Hostels</DropdownMenuItem>
              {uniqueHostels.map(hostel => (
                <DropdownMenuItem key={hostel.id} onClick={() => setSelectedHostel(hostel.id)}>
                  {hostel.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link href="/owner/students/new">
          <Button className="gap-2 rounded-full">
            <Plus size={18} />
            <span>Assign Student</span>
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Student</th>
                <th className="px-6 py-4 text-left font-semibold">Contact Info</th>
                <th className="px-6 py-4 text-left font-semibold">Hostel & Room</th>
                <th className="px-6 py-4 text-left font-semibold">Booking & Rent</th>
                <th className="px-6 py-4 text-left font-semibold">Check-in Date</th>
                <th className="px-6 py-4 text-left font-semibold">Status</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Loading residents...</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-red-500">
                      <AlertTriangle className="h-10 w-10" />
                      <p className="font-semibold">Error: {error}</p>
                      <Button variant="outline" className="mt-2" onClick={fetchStudents}>
                        Retry Loading
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground">No students found matching your criteria.</p>
                      <Button variant="link" onClick={() => {setSearchQuery(''); setSelectedHostel('all');}}>
                        Clear all filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredAssignments.map((item) => {
                const studentInfo = Array.isArray(item.students) ? item.students[0] : item.students;
                const profile = studentInfo?.profiles;
                const studentName = item.student_name || profile?.full_name || '-';
                const studentEmail = item.student_email || profile?.email || '-';
                const studentPhone = item.student_phone || profile?.phone_number || '-';
                const hostelName = item.hostels?.name || '-';
                const roomNum = item.rooms?.room_number || '-';
                const bookingType = item.booking_type === 'entire_room' ? 'Private Room' : 'Shared Bed';
                const rent = item.rooms?.rent || 0;

                return (
                  <tr 
                    key={item.id} 
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/owner/students/${item.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {profile?.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt={studentName} 
                            className="h-10 w-10 rounded-full object-cover border border-border"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                            {studentName?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{studentName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{studentEmail}</p>
                        <p className="text-xs text-muted-foreground">{studentPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <Building2 size={14} className="text-muted-foreground" />
                          {hostelName}
                        </p>
                        <Badge variant="outline" className="mt-1 font-medium bg-muted/30">
                          Room {roomNum}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground capitalize">{bookingType}</p>
                        <p className="text-xs text-primary font-bold">₹{Number(rent).toLocaleString()}/mo</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.start_date ? new Date(item.start_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none capitalize">
                        {item.active ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/owner/students/${item.id}`)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCheckout(item.id)} className="text-destructive cursor-pointer">
                            Check out
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
