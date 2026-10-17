'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Search, Plus, Users, Building2, AlertTriangle, X } from 'lucide-react';
import { StudentCard } from './components/StudentCard';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { PageHeader } from "@/components/owner/page-header";

// User-facing labels for the two booking modes. The underlying persisted
// value and public.booking_type enum are unchanged -- only the displayed
// text differs: "entire_room" reads as "Entire Room" (whole room,
// exclusive) and "shared_bed" reads as "Shared Room" (shared with
// other students under the existing bed-level allocation model).
const BOOKING_TYPE_LABEL: Record<string, string> = {
  entire_room: 'Entire Room',
  shared_bed: 'Shared Room'
};

export default function OwnerStudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'active' | 'history'>(() => {
    return tabParam === 'history' || tabParam === 'past' ? 'history' : 'active';
  });

  useEffect(() => {
    if (tabParam === 'history' || tabParam === 'past') {
      setActiveTab('history');
    } else if (tabParam === 'active') {
      setActiveTab('active');
    }
  }, [tabParam]);

  const handleTabChange = (val: 'active' | 'history') => {
    setActiveTab(val);
    router.replace(`/owner/students?tab=${val}`, { scroll: false });
  };

  const [activeCount, setActiveCount] = useState<number>(0);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<string>('all');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      setPhotoUrls({});

      // Fetch room_allocations as the primary table for selected tab
      const { data, error: fetchError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          start_date,
          end_date,
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
        .eq('active', activeTab === 'active')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAssignments(data || []);

      // Fetch accurate counts for both tabs
      const [{ count: aCount }, { count: hCount }] = await Promise.all([
        supabase
          .from('room_allocations')
          .select('id, hostels!inner(owner_id)', { count: 'exact', head: true })
          .eq('hostels.owner_id', user.id)
          .eq('active', true),
        supabase
          .from('room_allocations')
          .select('id, hostels!inner(owner_id)', { count: 'exact', head: true })
          .eq('hostels.owner_id', user.id)
          .eq('active', false)
      ]);

      if (aCount !== null && aCount !== undefined) setActiveCount(aCount);
      if (hCount !== null && hCount !== undefined) setHistoryCount(hCount);

      // Fetch photo URLs for students with room requests
      if (data && data.length > 0) {
        const photoUrlPromises = data.map(async (assignment) => {
          const studentInfo = Array.isArray(assignment.students) ? assignment.students[0] : assignment.students;
          const studentId = studentInfo?.id;
          if (!studentId) return null;

          try {
            const response = await fetch(`/api/students/photo-url?student_id=${studentId}`);
            if (response.ok) {
              const data = await response.json();
              return { studentId, url: data.signedUrl };
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch photo for student ${studentId}:`, error);
            return null;
          }
        });

        const photoResults = await Promise.all(photoUrlPromises);
        const urlMap: Record<string, string> = {};
        photoResults.forEach(result => {
          if (result) {
            urlMap[result.studentId] = result.url;
          }
        });
        setPhotoUrls(urlMap);
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError(err.message || 'Failed to load resident students.');
      toast.error('Error loading resident student allocations');
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeTab]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleCheckout = async (allocId: string) => {
    if (!window.confirm('Are you sure you want to check out this student? This will deactivate their room allocation immediately.')) return;
    try {
      const { error: checkoutErr } = await supabase.rpc('vacate_room_allocation', { p_alloc_id: allocId });
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
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        title="Students"
        description="Manage resident students and active room allocations across your properties."
      />

      {/* View Tabs: Active vs Past Residents / History */}
      <Tabs value={activeTab} onValueChange={(val: any) => handleTabChange(val)} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] p-1 rounded-xl">
          <TabsTrigger 
            value="active" 
            className="rounded-lg text-xs font-semibold px-4 py-2 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-[#1a3d52] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-xs"
          >
            Active Residents ({activeCount})
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="rounded-lg text-xs font-semibold px-4 py-2 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-[#1a3d52] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-xs"
          >
            Past Residents / History ({historyCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top Toolbar: Search, Hostel Filter, Assign CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <Input 
              placeholder="Search by student name, email, phone, or room..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-10 border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] dark:text-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16364a] rounded-xl">
                <Building2 size={16} className="text-teal-600 dark:text-teal-400" />
                <span className="truncate">{selectedHostel === 'all' ? 'All Hostels' : uniqueHostels.find(h => h.id === selectedHostel)?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-[#0e222e] border-slate-200 dark:border-[#1a3d52] text-slate-800 dark:text-slate-100 rounded-xl shadow-lg">
              <DropdownMenuItem onClick={() => setSelectedHostel('all')} className="cursor-pointer dark:hover:bg-[#16364a]">All Hostels</DropdownMenuItem>
              {uniqueHostels.map(hostel => (
                <DropdownMenuItem key={hostel.id} onClick={() => setSelectedHostel(hostel.id)} className="cursor-pointer dark:hover:bg-[#16364a]">
                  {hostel.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {activeTab === 'active' && (
          <Link href="/owner/students/new">
            <Button className="h-10 gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 shadow-xs transition-colors text-sm">
              <Plus size={18} />
              <span>Assign Student</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center text-slate-500 shadow-xs">
          <div className="animate-spin inline-block w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full mb-3" />
          <p className="font-medium text-slate-600">
            {activeTab === 'history' ? 'Loading past residents history...' : 'Loading resident students...'}
          </p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-12 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 mb-2" />
          <p className="font-semibold text-rose-800 mb-2">Error: {error}</p>
          <Button variant="outline" onClick={fetchStudents} className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg">
            Retry Loading
          </Button>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {activeTab === 'history' ? 'No past residents found' : 'No resident students found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedHostel !== 'all' 
              ? 'No students match your current filter criteria.' 
              : activeTab === 'history'
                ? 'No past resident checkout records exist for your properties.'
                : 'You do not have any active resident students assigned yet.'}
          </p>
          {(searchQuery || selectedHostel !== 'all') ? (
            <Button 
              variant="outline" 
              onClick={() => { setSearchQuery(''); setSelectedHostel('all'); }}
              className="mt-4 border-slate-200 text-slate-700 rounded-lg text-xs"
            >
              Clear Filters
            </Button>
          ) : activeTab === 'active' ? (
            <Link href="/owner/students/new" className="inline-block mt-4">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2 rounded-xl text-xs shadow-xs">
                <Plus size={16} /> Assign First Student
              </Button>
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
  {filteredAssignments.map((item) => {
    const studentInfo = Array.isArray(item.students) ? item.students[0] : item.students;
    const profile = studentInfo?.profiles;
    const studentName = item.student_name || profile?.full_name || 'Resident Student';
    const studentEmail = item.student_email || profile?.email || '-';
    const studentPhone = item.student_phone || profile?.phone_number || '-';
    const hostelName = item.hostels?.name || '-';
    const roomNum = item.rooms?.room_number || '-';
    const bookingType = BOOKING_TYPE_LABEL[item.booking_type] || BOOKING_TYPE_LABEL.shared_bed;
    const rent = item.rooms?.rent || 0;
    const studentId = studentInfo?.id;
    const passportPhotoUrl = (studentId && photoUrls[studentId]) || profile?.avatar_url || undefined;
    const isHistory = !item.active;
    const statusLabel = item.active ? 'Active' : 'Checked Out';
    const statusColorClass = item.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800';
    const stayDuration = isHistory && item.start_date
      ? `Stay: ${new Date(item.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} → ${item.end_date ? new Date(item.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Checked out'}`
      : undefined;

    return (
      <StudentCard
        key={item.id}
        studentName={studentName}
        studentEmail={studentEmail}
        studentPhone={studentPhone}
        hostelName={hostelName}
        roomNumber={roomNum}
        bookingType={bookingType}
        rent={rent}
        statusLabel={statusLabel}
        statusColorClass={statusColorClass}
        studentPhotoUrl={passportPhotoUrl}
        stayDuration={stayDuration}
        onViewProfile={() => router.push(`/owner/students/${item.id}?from=${activeTab}`)}
        onCheckout={item.active ? () => handleCheckout(item.id) : undefined}
      />
    );
  })}
</div>      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overscroll-contain"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={previewPhoto} 
              alt="Student passport photo preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-900" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}