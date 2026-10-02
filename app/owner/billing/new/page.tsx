'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Bed, Calendar, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface StudentAssignment {
  id: string; // allocation_id
  student_id: string;
  hostel_id: string;
  room_id: string;
  student_name: string;
  hostel_name: string;
  room_number: string;
  rent: number;
}

export default function CreateBillPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(true);
  const [students, setStudents] = useState<StudentAssignment[]>([]);
  
  const [formData, setFormData] = useState({
    allocation_id: '',
    student_id: '',
    hostel_id: '',
    room_id: '',
    rent: 0,
  });

  useEffect(() => {
    async function fetchStudents() {
      const ownerId = user?.id || profile?.user_id;
      if (!ownerId) {
        setFetchingStudents(false);
        return;
      }

      try {
        setFetchingStudents(true);
        // 1. Fetch hostels owned by this owner
        const { data: hostelsData, error: hostelsError } = await supabase
          .from('hostels')
          .select('id, name')
          .eq('owner_id', ownerId);

        if (hostelsError) throw hostelsError;
        if (!hostelsData || hostelsData.length === 0) {
          setStudents([]);
          return;
        }

        const hostelIds = hostelsData.map(h => h.id);
        const hostelsMap = new Map(hostelsData.map(h => [h.id, h.name]));

        // 2. Fetch active room allocations in these hostels
        const { data: allocs, error: allocError } = await supabase
          .from('room_allocations')
          .select(`
            id,
            student_id,
            hostel_id,
            room_id,
            student_name,
            rooms (
              id,
              room_number,
              rent
            ),
            students (
              id,
              profiles (full_name)
            )
          `)
          .in('hostel_id', hostelIds)
          .eq('active', true);

        if (allocError) throw allocError;

        const assignments: StudentAssignment[] = (allocs || []).map((a: any) => {
          const room = Array.isArray(a.rooms) ? a.rooms[0] : a.rooms;
          const student = Array.isArray(a.students) ? a.students[0] : a.students;
          const studentProfile = student?.profiles;
          const resolvedName = (Array.isArray(studentProfile) ? studentProfile[0]?.full_name : studentProfile?.full_name)
            || a.student_name 
            || 'Student';

          return {
            id: a.id,
            student_id: a.student_id,
            hostel_id: a.hostel_id,
            room_id: a.room_id,
            student_name: resolvedName,
            hostel_name: hostelsMap.get(a.hostel_id) || 'Hostel',
            room_number: room?.room_number || '—',
            rent: Number(room?.rent || 0),
          };
        });

        setStudents(assignments);
        if (assignments.length > 0) {
          setFormData({
            allocation_id: assignments[0].id,
            student_id: assignments[0].student_id,
            hostel_id: assignments[0].hostel_id,
            room_id: assignments[0].room_id,
            rent: assignments[0].rent,
          });
        }
      } catch (err: any) {
        console.error('Error fetching students for billing:', err);
        toast.error(err.message || 'Failed to load active students');
      } finally {
        setFetchingStudents(false);
      }
    }

    fetchStudents();
  }, [user?.id, profile?.user_id]);

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const allocId = e.target.value;
    const assignment = students.find(s => s.id === allocId);
    if (assignment) {
      setFormData({
        allocation_id: assignment.id,
        student_id: assignment.student_id,
        hostel_id: assignment.hostel_id,
        room_id: assignment.room_id,
        rent: assignment.rent,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allocation_id) {
      toast.error('Please select an active student allocation');
      return;
    }
    setLoading(true);

    try {
      // Generate the authoritative 12-month student_fees schedule via the database RPC
      const { error } = await supabase.rpc('create_student_fees', {
        p_allocation_id: formData.allocation_id
      });

      if (error) throw error;

      toast.success('Fee schedule generated successfully in student_fees!');
      router.push('/owner/billing');
    } catch (err: any) {
      console.error('Error generating fee schedule:', err);
      toast.error(err.message || 'Failed to generate fee schedule');
    } finally {
      setLoading(false);
    }
  };

  const selectedStudent = students.find(s => s.id === formData.allocation_id);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/owner/billing" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Generate Fee Schedule</h1>
          <p className="text-sm text-slate-500 mt-1">Create or synchronize the monthly student fee schedule in student_fees</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6"
      >
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Select Active Student & Room
          </label>
          <select
            required
            className="w-full border border-slate-200 bg-white px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            value={formData.allocation_id}
            onChange={handleStudentChange}
            disabled={fetchingStudents || students.length === 0}
          >
            {fetchingStudents && <option value="">Loading active students...</option>}
            {!fetchingStudents && students.length === 0 && <option value="">No active student allocations found</option>}
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.student_name} — Room {s.room_number} ({s.hostel_name})
              </option>
            ))}
          </select>
        </div>

        {selectedStudent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Hostel</p>
                <p className="font-semibold text-slate-900 text-xs">{selectedStudent.hostel_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Bed size={18} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Room</p>
                <p className="font-semibold text-slate-900 text-xs">Room {selectedStudent.room_number}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Monthly Rent</p>
                <p className="font-semibold text-slate-900 text-xs">₹{selectedStudent.rent.toLocaleString()}/mo</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-xl text-xs text-teal-800 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <Calendar size={14} />
            Idempotent 12-Month Schedule Generation
          </p>
          <p className="text-teal-700 leading-relaxed">
            Generating fees creates the monthly rent schedule in <code className="font-mono font-semibold">student_fees</code> starting from the check-in month. Any existing fees for this allocation are safely preserved without duplicates.
          </p>
        </div>

        <button
          disabled={loading || students.length === 0}
          type="submit"
          className="w-full bg-teal-600 text-white p-3.5 rounded-xl font-bold text-base hover:bg-teal-700 transition-colors shadow-xs disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating Fee Schedule...' : 'Generate Fee Schedule in student_fees'}
        </button>
      </form>
    </div>
  );
}
