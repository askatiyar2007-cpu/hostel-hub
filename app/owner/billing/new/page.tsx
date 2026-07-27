'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface StudentAssignment {
  student_id: string;
  hostel_id: string;
  students: {
    profiles: {
      full_name: string | null;
    } | null;
  } | null;
  hostels: {
    name: string;
  } | null;
}

export default function CreateBillPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentAssignment[]>([]);
  
  const [formData, setFormData] = useState({
    student_id: '',
    hostel_id: '',
    bill_type: 'rent',
    amount: 0,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    async function fetchStudents() {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('room_allocations')
        .select(`
          student_id,
          hostel_id,
          students!inner (
            profiles (full_name)
          ),
          hostels!inner (name)
        `)
        .eq('hostels.owner_id', profile.id)
        .eq('active', true);
      
      setStudents((data as unknown as StudentAssignment[]) || []);
      if (data && data.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          student_id: data[0].student_id,
          hostel_id: data[0].hostel_id
        }));
      }
    }
    fetchStudents();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id) {
      toast.error('Please select a student');
      return;
    }
    setLoading(true);

    try {
      const { error } = await supabase.from('bills').insert({
        hostel_id: formData.hostel_id,
        student_id: formData.student_id,
        bill_type: formData.bill_type,
        amount: Number(formData.amount),
        due_date: formData.due_date,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Bill generated successfully!');
      router.push('/owner/billing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    const assignment = students.find(s => s.student_id === studentId);
    if (assignment) {
      setFormData({
        ...formData,
        student_id: studentId,
        hostel_id: assignment.hostel_id
      });
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/owner/billing" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Bill</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl border-2 border-gray-100 shadow-xl space-y-6"
      >
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Select Student
          </label>
          <select
            required
            className="input w-full"
            value={formData.student_id}
            onChange={handleStudentChange}
          >
            {students.length === 0 && <option value="">No active students found</option>}
            {students.map(s => (
              <option key={s.student_id} value={s.student_id}>
                {s.students?.profiles?.full_name} ({s.hostels?.name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Bill Type
            </label>
            <select
              className="input w-full"
              value={formData.bill_type}
              onChange={(e) => setFormData({ ...formData, bill_type: e.target.value })}
            >
              <option value="rent">Rent</option>
              <option value="electricity">Electricity</option>
              <option value="mess">Mess</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Amount (₹)
            </label>
            <input
              required
              type="number"
              className="input w-full"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Due Date
          </label>
          <input
            required
            type="date"
            className="input w-full"
            value={formData.due_date}
            onChange={(e) =>
              setFormData({ ...formData, due_date: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            className="input w-full h-24 py-3"
            placeholder="Additional details about the bill..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <button
          disabled={loading || students.length === 0}
          type="submit"
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg disabled:bg-gray-400"
        >
          {loading ? 'Generating...' : 'Generate Bill'}
        </button>
      </form>
    </div>
  );
}
