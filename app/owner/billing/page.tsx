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
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Revenue</h1>
          <p className="text-gray-500">Manage invoices, payments and electricity bills</p>
        </div>
        <div className="flex space-x-4">
          <button className="btn-secondary flex items-center space-x-2">
            <Download size={20} />
            <span>Export CSV</span>
          </button>
          <Link href="/owner/billing/new" className="btn-primary flex items-center space-x-2">
            <Plus size={20} />
            <span>Create Bill</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by student or bill ID..." 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="btn-secondary flex items-center space-x-2">
            <Filter size={20} />
            <span>Filter</span>
          </button>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Bill ID</th>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                No bills found. 
                <Link href="/owner/billing/new" className="text-blue-600 font-bold ml-1 hover:underline">Create your first bill →</Link>
              </td></tr>
            ) : bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-gray-500 uppercase">
                  #{bill.id.slice(0, 8)}
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-gray-900">{bill.students?.profiles?.full_name}</p>
                    <p className="text-xs text-gray-500">{bill.hostels?.name}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm capitalize text-gray-600">{bill.bill_type}</span>
                </td>
                <td className="px-6 py-4 font-bold text-gray-900">₹{bill.amount}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(bill.due_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium uppercase ${
                    bill.status === 'paid' ? 'bg-green-100 text-green-700' : 
                    bill.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {bill.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-blue-600 font-medium cursor-pointer hover:underline">
                  View
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
