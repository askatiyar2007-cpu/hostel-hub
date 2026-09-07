'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Bill } from '@/types/database';
import { Search, Download, Filter, Plus } from 'lucide-react';
import Link from 'next/link';

interface BillWithDetails extends Bill {
  students: {
    profiles: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
  hostels: {
    name: string;
  } | null;
}

export default function OwnerBillingPage() {
  const { profile } = useAuth();
  const [bills, setBills] = useState<BillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          students!inner (
            profiles!inner (full_name, email)
          ),
          hostels!inner (name)
        `)
        .eq('hostels.owner_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills((data as unknown as BillWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Revenue</h1>
          <p className="text-sm text-slate-500 mt-1">Manage invoices, payments and electricity bills</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs">
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
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by student or bill ID..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
            <Filter size={14} />
            <span>Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Bill ID</th>
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
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading bills...</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No bills found. 
                  <Link href="/owner/billing/new" className="text-teal-600 font-bold ml-1 hover:underline">Create your first bill →</Link>
                </td></tr>
              ) : bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 uppercase">
                    #{bill.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-slate-900">{bill.students?.profiles?.full_name}</p>
                      <p className="text-[11px] text-slate-500">{bill.hostels?.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-slate-600 font-medium">{bill.bill_type}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">₹{bill.amount}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(bill.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      bill.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' : 
                      bill.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200/80' : 'bg-rose-50 text-rose-700 border-rose-200/80'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-teal-600 font-semibold hover:text-teal-700 hover:underline">
                      View
                    </button>
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
