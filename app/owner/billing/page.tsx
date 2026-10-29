'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Search, Download, Filter, Plus, ArrowUpRight, Calendar } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FeeWithDetails {
  id: string;
  month_year: string;
  amount_due: number;
  amount?: number;
  rent_amount: number;
  electricity_amount: number;
  total_amount: number;
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
  room_number?: string;
}

function formatFeeMonth(my: string) {
  if (!my || my === '—') return 'Monthly Rent';
  if (/^\d{4}-\d{2}$/.test(my)) {
    const [year, month] = my.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year} Rent`;
  }
  return `Rent (${my})`;
}

function formatBillingMonthLabel(my: string) {
  if (!my || my === '—') return 'Unspecified Month';
  if (/^\d{4}-\d{2}$/.test(my)) {
    const [year, month] = my.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  return my;
}

export default function OwnerBillingPage() {
  const { user, profile } = useAuth();
  const [fees, setFees] = useState<FeeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'pending_verification'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

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

      // 2b. Fetch student electricity charges for these hostels
      const { data: electricityChargesData } = await supabase
        .from('student_electricity_charges')
        .select('student_id, billing_month, charge_amount_paise')
        .in('hostel_id', hostelIds);

      const electricityChargesMap = new Map<string, number>();
      if (electricityChargesData) {
        electricityChargesData.forEach((ec: any) => {
          const key = `${ec.student_id}_${ec.billing_month}`;
          const cur = electricityChargesMap.get(key) || 0;
          electricityChargesMap.set(key, cur + (ec.charge_amount_paise || 0));
        });
      }

      // 3. Batch fetch allocations, profiles, and students
      const studentIds = Array.from(new Set((feesData || []).map(f => f.student_id).filter(Boolean)));
      const allocationIds = Array.from(new Set((feesData || []).map(f => f.allocation_id).filter(Boolean)));

      const allocationsMap = new Map<string, { student_name?: string; student_email?: string; room_number?: string }>();
      if (allocationIds.length > 0) {
        const { data: allocationsData } = await supabase
          .from('room_allocations')
          .select('id, student_name, student_email, room:rooms(room_number)')
          .in('id', allocationIds);

        if (allocationsData) {
          allocationsData.forEach((a: any) => {
            allocationsMap.set(a.id, {
              student_name: a.student_name,
              student_email: a.student_email,
              room_number: a.room?.room_number,
            });
          });
        }
      }

      const profilesMap = new Map<string, { full_name: string; email: string }>();
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, email')
          .in('id', studentIds);

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap.set(p.id, { full_name: p.full_name, email: p.email });
            if (p.user_id) {
              profilesMap.set(p.user_id, { full_name: p.full_name, email: p.email });
            }
          });
        }
      }

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
        const allocInfo = allocationsMap.get(f.allocation_id);
        const profileInfo = profilesMap.get(f.student_id);
        const studentInfo = studentsMap.get(f.student_id);

        const studentName =
          allocInfo?.student_name ||
          profileInfo?.full_name ||
          studentInfo?.full_name ||
          (allocInfo?.room_number ? `Resident (Room ${allocInfo.room_number})` : 'Student');

        const studentEmail =
          allocInfo?.student_email ||
          profileInfo?.email ||
          studentInfo?.email ||
          '—';

        const monthKey = f.month_year || f.billing_period || '';
        const electricityPaise = electricityChargesMap.get(`${f.student_id}_${monthKey}`) || 0;
        const electricityAmount = electricityPaise / 100;
        const rentAmount = Number(f.amount_due ?? f.amount ?? 0);
        const totalAmount = rentAmount + electricityAmount;

        return {
          id: f.id,
          month_year: f.month_year || '—',
          amount_due: totalAmount,
          amount: totalAmount,
          rent_amount: rentAmount,
          electricity_amount: electricityAmount,
          total_amount: totalAmount,
          due_date: f.due_date,
          status: f.status || 'pending',
          created_at: f.created_at,
          paid_date: f.paid_date,
          payment_method: f.payment_method,
          hostel_id: f.hostel_id,
          student_id: f.student_id,
          student_name: studentName,
          student_email: studentEmail,
          hostel_name: hostelsMap.get(f.hostel_id) || 'Hostel',
          room_number: allocInfo?.room_number,
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

  // Available billing months sorted chronologically (e.g. 2026-10 before 2027-08)
  const availableMonths = useMemo(() => {
    const rawMonths = Array.from(
      new Set(fees.map((f) => f.month_year).filter((m) => Boolean(m) && m !== '—'))
    );
    return rawMonths.sort((a, b) => a.localeCompare(b));
  }, [fees]);

  const filteredFees = useMemo(() => {
    return fees.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.month_year.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchesMonth = monthFilter === 'all' || f.month_year === monthFilter;
      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [fees, searchTerm, statusFilter, monthFilter]);

  const handleExportCSV = () => {
    if (filteredFees.length === 0) return;
    const headers = ['Fee ID', 'Student Name', 'Student Email', 'Hostel', 'Month', 'Rent (₹)', 'Electricity (₹)', 'Total Due (₹)', 'Due Date', 'Status'];
    const rows = filteredFees.map(f => [
      f.id,
      `"${f.student_name.replace(/"/g, '""')}"`,
      f.student_email,
      `"${f.hostel_name.replace(/"/g, '""')}"`,
      f.month_year,
      f.rent_amount,
      f.electricity_amount,
      f.total_amount,
      f.due_date,
      f.status,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `staykosh_billing_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Billing & Revenue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage student fee schedules, rent dues, and payment records</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/owner/electricity/billing"
            className="inline-flex items-center gap-1.5 border border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
          >
            <span>⚡ Electricity Billing</span>
          </Link>
          <button 
            onClick={handleExportCSV}
            disabled={filteredFees.length === 0}
            className="inline-flex items-center gap-2 border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] hover:bg-slate-50 dark:hover:bg-[#16364a] text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
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

      <div className="bg-white dark:bg-[#0e222e] rounded-xl shadow-xs border border-slate-200/90 dark:border-[#1a3d52] overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-[#1a3d52] flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student, month, or fee ID..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50/70 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Billing Month Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                aria-label="Filter by billing month"
              >
                <option value="all">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatBillingMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                aria-label="Filter by fee status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
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
                  No fees found matching your filters.
                  {(searchTerm || statusFilter !== 'all' || monthFilter !== 'all') ? (
                    <button 
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); setMonthFilter('all'); }} 
                      className="text-teal-600 font-bold ml-1.5 hover:underline cursor-pointer"
                    >
                      Clear filters
                    </button>
                  ) : (
                    <Link href="/owner/billing/new" className="text-teal-600 font-bold ml-1 hover:underline">
                      Create your first bill →
                    </Link>
                  )}
                </td></tr>
              ) : filteredFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 uppercase">
                    #{fee.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900">{fee.student_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {fee.room_number ? `Room ${fee.room_number} • ${fee.hostel_name}` : fee.hostel_name}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700 font-medium">{formatFeeMonth(fee.month_year)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        ₹{Number(fee.total_amount).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Rent: ₹{Number(fee.rent_amount).toLocaleString('en-IN')}
                        {fee.electricity_amount > 0 && (
                          <span className="text-teal-600 dark:text-teal-400 font-semibold ml-1">
                            + Power: ₹{Number(fee.electricity_amount).toLocaleString('en-IN')}
                          </span>
                        )}
                      </p>
                    </div>
                  </td>
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
