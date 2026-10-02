'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Search, Download, Filter, Plus, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FeeWithDetails {
  id: string;
  month_year: string;
  amount_due: number;
  amount?: number;
  due_date: string;
  status: string;
  created_at: string;
  paid_date?: string;
  payment_method?: string;
  hostel_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  hostel_name: string;
}

export default function OwnerBillingPage() {
  const { user, profile } = useAuth();
  const [fees, setFees] = useState<FeeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'pending_verification'>('all');

  const fetchFees = useCallback(async () => {
    const ownerId = user?.id || profile?.user_id;
    if (!ownerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch hostels owned by this owner using auth.users.id
      const { data: hostelsData, error: hostelsError } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', ownerId);

      if (hostelsError) throw hostelsError;
      if (!hostelsData || hostelsData.length === 0) {
        setFees([]);
        return;
      }

      const hostelIds = hostelsData.map(h => h.id);
      const hostelsMap = new Map(hostelsData.map(h => [h.id, h.name]));

      // 2. Fetch student_fees for all hostels of this owner
      const { data: feesData, error: feesError } = await supabase
        .from('student_fees')
        .select('id, month_year, amount_due, amount, due_date, status, created_at, paid_date, payment_method, hostel_id, student_id, allocation_id')
        .in('hostel_id', hostelIds)
        .order('due_date', { ascending: false });

      if (feesError) throw feesError;

      // 3. Batch fetch students to get profile names
      const studentIds = Array.from(new Set((feesData || []).map(f => f.student_id).filter(Boolean)));
      const studentsMap = new Map<string, { full_name: string; email: string }>();

      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, profile_id, profiles(full_name, email)')
          .in('id', studentIds);

        if (studentsData) {
          studentsData.forEach((s: any) => {
            studentsMap.set(s.id, {
              full_name: s.profiles?.full_name || 'Student',
              email: s.profiles?.email || '—',
            });
          });
        }
      }

      const formatted: FeeWithDetails[] = (feesData || []).map((f: any) => {
        const studentInfo = studentsMap.get(f.student_id);
        return {
          id: f.id,
          month_year: f.month_year || '—',
          amount_due: Number(f.amount_due ?? f.amount ?? 0),
          amount: Number(f.amount ?? f.amount_due ?? 0),
          due_date: f.due_date,
          status: f.status || 'pending',
          created_at: f.created_at,
          paid_date: f.paid_date,
          payment_method: f.payment_method,
          hostel_id: f.hostel_id,
          student_id: f.student_id,
          student_name: studentInfo?.full_name || 'Student',
          student_email: studentInfo?.email || '—',
          hostel_name: hostelsMap.get(f.hostel_id) || 'Hostel',
        };
      });

      setFees(formatted);
    } catch (error) {
      console.error('Error fetching owner billing fees:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.user_id]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const filteredFees = useMemo(() => {
    return fees.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.month_year.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [fees, searchTerm, statusFilter]);

  const handleExportCSV = () => {
    if (filteredFees.length === 0) return;
    const headers = ['Fee ID', 'Student Name', 'Student Email', 'Hostel', 'Month', 'Amount', 'Due Date', 'Status'];
    const rows = filteredFees.map(f => [
      f.id,
      `"${f.student_name.replace(/"/g, '""')}"`,
      f.student_email,
      `"${f.hostel_name.replace(/"/g, '""')}"`,
      f.month_year,
      f.amount_due,
      f.due_date,
      f.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hostelhub_billing_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Revenue</h1>
          <p className="text-sm text-slate-500 mt-1">Manage student fee schedules, rent dues, and payment records</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={filteredFees.length === 0}
            className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <Link href="/owner/billing/new" className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs">
            <Plus size={16} />
            <span>Create Bill</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, month, or fee ID..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-slate-200 bg-white text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Fee ID</th>
                <th className="px-6 py-3.5">Student</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Due Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading fees...</td></tr>
              ) : filteredFees.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No fees found. 
                  <Link href="/owner/billing/new" className="text-teal-600 font-bold ml-1 hover:underline">Create your first bill →</Link>
                </td></tr>
              ) : filteredFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 uppercase">
                    #{fee.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900">{fee.student_name}</p>
                      <p className="text-[11px] text-slate-500">{fee.hostel_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700 font-medium">Rent ({fee.month_year})</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">₹{fee.amount_due}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(fee.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize",
                      fee.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' : 
                      fee.status === 'pending_verification' ? 'bg-blue-50 text-blue-700 border-blue-200/80' :
                      fee.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-200/80' : 
                      'bg-amber-50 text-amber-700 border-amber-200/80'
                    )}>
                      {fee.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href="/owner/payments" 
                      className="inline-flex items-center gap-1 text-teal-600 font-semibold hover:text-teal-700 hover:underline"
                    >
                      <span>Manage</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
