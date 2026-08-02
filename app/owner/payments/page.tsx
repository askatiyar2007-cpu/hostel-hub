'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { 
  CreditCard,
  Search,
  Download,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  Send,
  X,
  Users,
  FileText,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OwnerPaymentsDashboard() {
  const { profile, user } = useAuth();
  const [fees, setFees] = useState<any[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'online' | 'manual'>('all');

  // Multi-selection state
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);

  // Modals state
  const [selectedFeeForMark, setSelectedFeeForMark] = useState<any | null>(null);
  const [selectedFeeForView, setSelectedFeeForView] = useState<any | null>(null);
  const [activeStudentsCount, setActiveStudentsCount] = useState(0);

  const fetchData = useCallback(async () => {
    const ownerId = user?.id || profile?.id;
    if (!ownerId) return;
    setLoading(true);
    try {
      // 1. Fetch Owner's Hostels
      const { data: hostelsData, error: hostelsError } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', ownerId);

      if (hostelsError) throw hostelsError;
      setHostels(hostelsData ?? []);

      const hostelIds = hostelsData?.map((h) => h.id) || [];
      if (hostelIds.length === 0) {
        setFees([]);
        setActiveStudentsCount(0);
        setLoading(false);
        return;
      }

      // 2. Fetch Active Allocations for Distinct Students Count
      const { data: activeAllocations, error: activeAllocationsError } = await supabase
        .from('room_allocations')
        .select('student_id')
        .eq('active', true)
        .in('hostel_id', hostelIds);

      if (activeAllocationsError) throw activeAllocationsError;
      const activeCount = new Set(activeAllocations?.map((a: any) => a.student_id) || []).size;
      setActiveStudentsCount(activeCount);

      // 3. Fetch Student Fees for these hostels
      const { data: feesData, error: feesError } = await supabase
        .from('student_fees')
        .select('id, amount_due, due_date, status, student_id, hostel_id, billing_period, allocation_id')
        .in('hostel_id', hostelIds)
        .order('due_date', { ascending: false });

      if (feesError) throw feesError;

      // Extract unique IDs for separate batch queries to let frontend join the data
      const studentIds = Array.from(new Set(feesData?.map((f: any) => f.student_id).filter(Boolean) || []));
      const allocationIds = Array.from(new Set(feesData?.map((f: any) => f.allocation_id).filter(Boolean) || []));
      const feeIds = feesData?.map((f: any) => f.id) || [];

      // 4. Batch Fetch Students & Profiles
      let studentsData: any[] = [];
      if (studentIds.length > 0) {
        const { data, error } = await supabase
          .from('students')
          .select(`
            id,
            profile_id,
            college,
            course,
            year,
            profiles (
              id,
              user_id,
              full_name,
              email,
              phone_number
            )
          `)
          .in('id', studentIds);
        if (error) throw error;
        studentsData = data ?? [];
      }

      // 5. Batch Fetch Room Allocations & Rooms
      let allocationsData: any[] = [];
      if (allocationIds.length > 0) {
        const { data, error } = await supabase
          .from('room_allocations')
          .select(`
            id,
            student_name,
            student_email,
            student_phone,
            room_id,
            rooms (
              room_number
            )
          `)
          .in('id', allocationIds);
        if (error) throw error;
        allocationsData = data ?? [];
      }

      // 6. Batch Fetch Payments
      let paymentsData: any[] = [];
      if (feeIds.length > 0) {
        const { data, error } = await supabase
          .from('payments')
          .select('id, fee_id, amount_paid, payment_method, reference_number, payment_status, paid_date, notes, proof_url, auto_verified, gateway_order_id')
          .in('fee_id', feeIds);
        if (error) throw error;
        paymentsData = data ?? [];
      }

      // Create maps for fast O(1) lookups
      const hostelsMap = new Map(hostelsData.map((h) => [h.id, h]));
      const studentsMap = new Map(studentsData.map((s) => [s.id, s]));
      const allocationsMap = new Map(allocationsData.map((a) => [a.id, a]));

      // Map backend fields to local format with frontend joins
      const formattedFees = (feesData ?? []).map((fee: any) => {
        const student = studentsMap.get(fee.student_id) || null;
        const allocation = allocationsMap.get(fee.allocation_id) || null;
        const hostel = hostelsMap.get(fee.hostel_id) || null;
        const feePayments = paymentsData.filter((p: any) => p.fee_id === fee.id);

        // Find latest/active payment record
        const payment = feePayments.length > 0
          ? feePayments.find((p: any) => p.payment_status === 'pending_verification') || feePayments[0]
          : null;

        return {
          ...fee,
          amount: fee.amount_due,
          billing_period: fee.billing_period || new Date(fee.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          students: student,
          room_allocations: allocation,
          hostels: hostel,
          payments: feePayments,
          payment
        };
      });

      setFees(formattedFees);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to fetch payments data');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedFeeIds(filteredFees.map((f) => f.id));
    } else {
      setSelectedFeeIds([]);
    }
  };

  const handleSelectRow = (feeId: string) => {
    setSelectedFeeIds((prev) =>
      prev.includes(feeId) ? prev.filter((id) => id !== feeId) : [...prev, feeId]
    );
  };

  const handleBulkMarkPaid = async () => {
    if (selectedFeeIds.length === 0) return;
    if (!confirm(`Are you sure you want to mark the ${selectedFeeIds.length} selected fees as paid manually?`)) return;

    setLoading(true);
    try {
      let count = 0;
      for (const feeId of selectedFeeIds) {
        const fee = fees.find((f) => f.id === feeId);
        if (!fee || fee.status === 'paid') continue;

        const { error: paymentError } = await supabase.rpc('mark_fee_paid_manual', {
          p_student_fees_id: feeId,
          p_amount: fee.amount,
          p_payment_method: 'cash',
          p_date: new Date().toISOString().split('T')[0],
          p_notes: 'Marked paid via bulk action',
          p_verified_by: profile!.user_id
        });

        if (paymentError) throw paymentError;
        count++;
      }
      toast.success(`Successfully marked ${count} payments as paid!`);
      setSelectedFeeIds([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete bulk mark paid');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSendReminders = async () => {
    if (selectedFeeIds.length === 0) return;
    if (!confirm(`Send payment reminders to ${selectedFeeIds.length} selected students?`)) return;

    setLoading(true);
    try {
      let count = 0;
      for (const feeId of selectedFeeIds) {
        const fee = fees.find((f) => f.id === feeId);
        if (!fee || fee.status === 'paid' || fee.status === 'pending_verification') continue;

        // Fetch student's profile user_id
        const { data } = await supabase
          .from('students')
          .select('profiles(user_id)')
          .eq('id', fee.student_id)
          .single();

        const studentData = data as any;
        const profiles = studentData?.profiles;
        const userId = Array.isArray(profiles) ? profiles[0]?.user_id : profiles?.user_id;

        if (userId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Payment Reminder',
            message: `Hi, this is a reminder to pay your rent of ₹${fee.amount} for ${fee.billing_period}. Due date was ${new Date(fee.due_date).toLocaleDateString()}.`,
            type: 'payment'
          });
          count++;
        }
      }
      toast.success(`Successfully sent reminders to ${count} students!`);
      setSelectedFeeIds([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send bulk reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (fee: any) => {
    try {
      const { data } = await supabase
        .from('students')
        .select('profiles(user_id)')
        .eq('id', fee.student_id)
        .single();

      const studentData = data as any;
      const profiles = studentData?.profiles;
      const userId = Array.isArray(profiles) ? profiles[0]?.user_id : profiles?.user_id;

      if (!userId) {
        toast.error('Could not find student profile to send notification');
        return;
      }

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Payment Reminder',
        message: `Hi, this is a reminder to pay your rent of ₹${fee.amount} for ${fee.billing_period}. Due date was ${new Date(fee.due_date).toLocaleDateString()}.`,
        type: 'payment'
      });

      toast.success('Reminder notification sent successfully to student!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reminder');
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredFees.map((fee) => ({
      'Student Name': fee.students?.profiles?.full_name || fee.room_allocations?.student_name || 'N/A',
      'Room Number': fee.room_allocations?.rooms?.room_number || 'N/A',
      'Hostel': fee.hostels?.name || 'N/A',
      'Billing Period': fee.billing_period,
      'Amount': fee.amount,
      'Due Date': fee.due_date,
      'Status': fee.status,
      'Payment Method': fee.payment?.payment_method || 'N/A',
      'Reference ID': fee.payment?.reference_number || 'N/A',
      'Paid Date': fee.payment?.paid_date ? new Date(fee.payment.paid_date).toLocaleDateString() : 'N/A'
    }));

    if (exportData.length === 0) {
      toast.error('No payments to export');
      return;
    }

    const headers = Object.keys(exportData[0]).join(',');
    const rows = exportData.map((row) =>
      Object.values(row).map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HostelHub_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported successfully!');
  };

  // Helper filters
  const matchesPeriod = (dateStr: string) => {
    if (periodFilter === 'all') return true;
    const feeDate = new Date(dateStr);
    const today = new Date();
    if (periodFilter === 'this_month') {
      return feeDate.getMonth() === today.getMonth() && feeDate.getFullYear() === today.getFullYear();
    }
    if (periodFilter === 'last_month') {
      let lastMonth = today.getMonth() - 1;
      let lastYear = today.getFullYear();
      if (lastMonth < 0) {
        lastMonth = 11;
        lastYear -= 1;
      }
      return feeDate.getMonth() === lastMonth && feeDate.getFullYear() === lastYear;
    }
    return true;
  };

  // Filter and search logic
  const filteredFees = fees.filter((fee) => {
    const studentName = (fee.students?.profiles?.full_name || fee.room_allocations?.student_name || '').toLowerCase();
    const roomNum = fee.room_allocations?.rooms?.room_number?.toLowerCase() || '';
    const query = searchTerm.toLowerCase();

    const matchesSearch = studentName.includes(query) || roomNum.includes(query);
    const matchesHostel = selectedHostelId === 'all' || fee.hostel_id === selectedHostelId;
    const matchesStatus = statusFilter === 'all' || fee.status === statusFilter;
    const matchesTime = matchesPeriod(fee.due_date);

    const paymentMethod = fee.payment?.payment_method || '';
    const matchesPaymentType =
      paymentTypeFilter === 'all' ||
      (paymentTypeFilter === 'online' && (paymentMethod === 'knitpay' || paymentMethod === 'online')) ||
      (paymentTypeFilter === 'manual' && paymentMethod !== 'knitpay' && paymentMethod !== 'online');

    return matchesSearch && matchesHostel && matchesStatus && matchesTime && matchesPaymentType;
  });

  // Analytics Metrics
  const metrics = {
    totalCollected: fees.filter((f) => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0),
    pendingAmount: fees.filter((f) => f.status === 'pending' || f.status === 'pending_verification').reduce((sum, f) => sum + Number(f.amount), 0),
    overdueAmount: fees.filter((f) => f.status === 'overdue').reduce((sum, f) => sum + Number(f.amount), 0),
    totalStudents: activeStudentsCount
  };

  if (loading && fees.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground max-w-5xl mx-auto min-h-[400px] flex flex-col justify-center items-center">
        <Clock className="animate-spin h-10 w-10 text-primary mb-4" />
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">Loading Payments Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-zinc-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="text-primary h-8 w-8" /> Payments & Collection
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track student rents, verify online transfer receipts, and manage pending dues.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="border hover:bg-zinc-50 dark:hover:bg-zinc-900 text-foreground font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition bg-card"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Collected Rent</span>
            <h3 className="text-2xl font-black text-green-600">₹{metrics.totalCollected.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-950/20 flex items-center justify-center text-green-600">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Pending Dues</span>
            <h3 className="text-2xl font-black text-amber-600">₹{metrics.pendingAmount.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Overdue Dues</span>
            <h3 className="text-2xl font-black text-red-600">₹{metrics.overdueAmount.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-600 font-bold">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Active Students</span>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{metrics.totalStudents}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Payment Type Filter Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setPaymentTypeFilter('all')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition duration-150 ${
            paymentTypeFilter === 'all'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All Payments
        </button>
        <button
          onClick={() => setPaymentTypeFilter('online')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition duration-150 ${
            paymentTypeFilter === 'online'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Online (Knit Pay)
        </button>
        <button
          onClick={() => setPaymentTypeFilter('manual')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition duration-150 ${
            paymentTypeFilter === 'manual'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Manual Submissions
        </button>
      </div>

      {/* Filters and Search toolbar */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search by student name or room number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border bg-card text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Hostel Selector */}
        {hostels.length > 1 && (
          <select
            value={selectedHostelId}
            onChange={(e) => setSelectedHostelId(e.target.value)}
            className="w-full md:w-44 h-9 px-3 border border-border rounded-xl text-xs bg-card focus:outline-none"
          >
            <option value="all">All Hostels</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-40 h-9 px-3 border border-border rounded-xl text-xs bg-card focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="pending_verification">Verifications Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>

        {/* Period Filter */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="w-full md:w-36 h-9 px-3 border border-border rounded-xl text-xs bg-card focus:outline-none"
        >
          <option value="all">All Time</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
        </select>
      </div>

      {/* Main Student Fees Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        {/* Bulk Action Panel (only displays when rows are selected) */}
        {selectedFeeIds.length > 0 && (
          <div className="bg-primary/5 dark:bg-primary/10 border-b border-border px-6 py-3 flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-150">
            <span className="font-bold text-primary">
              {selectedFeeIds.length} students selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkPaid}
                className="bg-primary text-white font-semibold px-3 py-1.5 rounded-lg text-[11px] shadow-sm hover:bg-primary/95 transition"
              >
                Mark Paid (Bulk)
              </button>
              <button
                onClick={handleBulkSendReminders}
                className="border border-primary/20 text-primary font-semibold px-3 py-1.5 rounded-lg text-[11px] hover:bg-primary/5 transition bg-card"
              >
                Send Reminders
              </button>
              <button
                onClick={() => setSelectedFeeIds([])}
                className="text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg transition"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-55/40 dark:bg-zinc-900/30 text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider border-b border-border">
              <tr>
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredFees.length > 0 && selectedFeeIds.length === filteredFees.length}
                    onChange={handleSelectAll}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 border-zinc-300 cursor-pointer"
                  />
                </th>
                <th className="py-4 px-4">Student</th>
                <th className="py-4 px-2">Room</th>
                <th className="py-4 px-2">Hostel</th>
                <th className="py-4 px-2">Month</th>
                <th className="py-4 px-2">Amount</th>
                <th className="py-4 px-2">Due Date</th>
                <th className="py-4 px-2">Status</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && fees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">Loading payments...</td>
                </tr>
              ) : filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground font-medium">No fee records found. Adjust your search or filters.</td>
                </tr>
              ) : (
                filteredFees.map((fee) => (
                  <tr
                    key={fee.id}
                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors ${
                      selectedFeeIds.includes(fee.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedFeeIds.includes(fee.id)}
                        onChange={() => handleSelectRow(fee.id)}
                        className="rounded text-primary focus:ring-primary h-3.5 w-3.5 border-zinc-300 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      <div>
                        <p>{fee.students?.profiles?.full_name || fee.room_allocations?.student_name || 'N/A'}</p>
                        <p className="text-[10px] text-muted-foreground font-normal">{fee.students?.profiles?.email || fee.room_allocations?.student_email || ''}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-2 font-semibold text-foreground">
                      Room {fee.room_allocations?.rooms?.room_number || 'N/A'}
                    </td>
                    <td className="py-3.5 px-2 text-muted-foreground">
                      {fee.hostels?.name || 'N/A'}
                    </td>
                    <td className="py-3.5 px-2 font-semibold text-foreground">
                      {fee.billing_period}
                    </td>
                    <td className="py-3.5 px-2 font-bold text-foreground">
                      <div>
                        <p>₹{fee.amount}</p>
                        {fee.payment && (
                          <div className="text-[10px] font-normal text-muted-foreground mt-0.5 space-y-0.5">
                            <p>
                              Rec'd: <span className="font-semibold text-foreground">₹{fee.payment.amount_paid}</span>
                            </p>
                            {fee.payment.gateway_order_id && (
                              <p className="font-mono text-[9px] text-zinc-500">
                                Order: <span className="select-all font-semibold text-foreground">{fee.payment.gateway_order_id}</span>
                              </p>
                            )}
                            {fee.payment.paid_date && (
                              <p className="text-[9px] text-zinc-500">
                                Paid: <span className="font-semibold text-foreground">{new Date(fee.payment.paid_date).toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-muted-foreground whitespace-nowrap">
                      {new Date(fee.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-2">
                      <div className="flex flex-col gap-1 items-start">
                        {(() => {
                          const isOnline = fee.payment?.payment_method === 'knitpay' || fee.payment?.payment_method === 'online';
                          const isPaid = fee.status === 'paid';
                          const isPendingVerification = fee.status === 'pending_verification';

                          if (isOnline && isPaid) {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300">
                                Online - Verified
                              </span>
                            );
                          }

                          if (!isOnline && isPendingVerification) {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 animate-pulse">
                                Manual - Pending Verification
                              </span>
                            );
                          }

                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              fee.status === 'paid'
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300'
                                : fee.status === 'pending_verification'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 animate-pulse'
                                : fee.status === 'overdue'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                                : 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-300'
                            }`}>
                              {fee.status === 'pending_verification' ? 'Verify Proof' : fee.status.replace('_', ' ')}
                            </span>
                          );
                        })()}
                        {fee.payment && (
                          <div className="flex flex-wrap items-center gap-1">
                            {fee.payment.payment_status === 'verified' && (
                              <span className="text-[9px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center">
                                VERIFIED ✅
                              </span>
                            )}
                            {fee.payment.payment_status === 'partial' && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center">
                                PARTIAL ⚠️
                              </span>
                            )}
                            {fee.payment.payment_status === 'rejected' && (
                              <span className="text-[9px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold px-1.5 py-0.5 rounded uppercase flex items-center">
                                REJECTED ❌
                              </span>
                            )}
                            {fee.payment.auto_verified && (
                              <span className="text-[9px] bg-indigo-55 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded uppercase">
                                Auto-Verified
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {fee.payment && fee.status === 'pending_verification' ? (
                          <button
                            onClick={() => setSelectedFeeForView(fee)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] shadow-sm transition flex items-center gap-1"
                            title="Verify Receipt & Mark Paid"
                          >
                            <Eye size={12} /> Verify & Mark Paid
                          </button>
                        ) : fee.status !== 'paid' ? (
                          <button
                            onClick={() => setSelectedFeeForMark(fee)}
                            className="bg-primary hover:bg-primary/95 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] shadow-sm transition"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-[11px] text-green-600 font-semibold px-2">Verified</span>
                        )}
                        {fee.status !== 'paid' && fee.status !== 'pending_verification' && (
                          <button
                            onClick={() => handleSendReminder(fee)}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 border rounded-lg text-muted-foreground hover:text-foreground transition"
                            title="Send Notification Reminder"
                          >
                            <Send size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: MARK PAYMENT AS PAID */}
      {selectedFeeForMark && (
        <MarkPaidModal
          fee={selectedFeeForMark}
          ownerProfileId={profile!.user_id}
          onClose={() => setSelectedFeeForMark(null)}
          onSuccess={() => {
            setSelectedFeeForMark(null);
            fetchData();
          }}
        />
      )}

      {/* MODAL 2: VERIFY PAYMENT RECEIPT DETAILS */}
      {selectedFeeForView && (
        <VerifyPaymentModal
          fee={selectedFeeForView}
          ownerUserId={profile!.user_id}
          onClose={() => setSelectedFeeForView(null)}
          onSuccess={() => {
            setSelectedFeeForView(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- MODAL: MARK PAYMENT AS PAID ---------------- */

interface MarkPaidModalProps {
  fee: any;
  ownerProfileId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function MarkPaidModal({ fee, ownerProfileId, onClose, onSuccess }: MarkPaidModalProps) {
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Set default reference if fee has existing pending reference
  useEffect(() => {
    if (fee?.payment?.reference_number) {
      // If it starts with CASH-, don't prefill reference (let them leave blank or input reference)
      if (!fee.payment.reference_number.startsWith('CASH-')) {
        setReference(fee.payment.reference_number);
      }
    }
  }, [fee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.rpc('mark_fee_paid_manual', {
        p_student_fees_id: fee.id,
        p_amount: fee.amount,
        p_payment_method: method,
        p_date: date,
        p_notes: notes.trim() || 'Payment approved by owner',
        p_verified_by: ownerProfileId
      });

      if (error) throw error;

      toast.success('Fee successfully marked as Paid!');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to mark payment as paid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h3 className="font-bold text-base text-foreground font-display">Mark Payment as Paid</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Record a manual rent payment or approve receipt.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-muted-foreground transition">
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Read Only Stats */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800/80 rounded-xl p-3.5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Student Name</p>
              <p className="font-bold text-foreground mt-0.5">{fee.students?.profiles?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Billing Period</p>
              <p className="font-bold text-foreground mt-0.5">{fee.billing_period}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Room</p>
              <p className="font-bold text-foreground mt-0.5">Room {fee.room_allocations?.rooms?.room_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Amount Due</p>
              <p className="font-black text-primary mt-0.5">₹{fee.amount}</p>
            </div>
          </div>

          {/* Payment Method Received */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Method Received</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['upi', 'bank', 'cash', 'other'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`h-9 border text-xs font-semibold rounded-lg transition capitalize ${
                    method === m
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'bank' ? 'Bank Transfer' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction ID / Reference */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transaction ID / Reference (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UTR number, Cash Receipt #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Payment Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-lg focus:outline-none"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verification Notes (Optional)</label>
            <textarea
              placeholder="e.g. Verified in Bank statement, cash received in office"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-border bg-card text-foreground rounded-lg"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 border rounded-lg font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg flex items-center justify-center gap-1 shadow-md shadow-primary/10 transition"
            >
              {loading ? 'Processing...' : 'Confirm & Mark Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- MODAL: VERIFY PAYMENT RECEIPT DETAILS ---------------- */

interface VerifyPaymentModalProps {
  fee: any;
  ownerUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function VerifyPaymentModal({ fee, ownerUserId, onClose, onSuccess }: VerifyPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const payment = fee.payment;
  const expectedAmount = Number(fee.amount);
  const receivedAmount = Number(payment?.amount_paid || 0);
  const amountsMatch = expectedAmount === receivedAmount;
  const isOverpayment = receivedAmount > expectedAmount;
  const isPartial = receivedAmount < expectedAmount;

  const handleAction = async (action: 'verify' | 'partial' | 'reject', override: boolean = false) => {
    setLoading(true);
    try {
      let finalStatus: string = 'verified';
      let feeStatus: string = 'paid';
      let autoVerified = false;

      if (action === 'verify') {
        finalStatus = 'verified';
        feeStatus = 'paid';
        autoVerified = amountsMatch && !override;
      } else if (action === 'partial') {
        finalStatus = 'partial';
        feeStatus = 'pending';
      } else if (action === 'reject') {
        finalStatus = 'rejected';
        feeStatus = 'pending';
      }

      // 1. Update payments table
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          payment_status: finalStatus,
          verified_at: new Date().toISOString(),
          verified_by: ownerUserId,
          auto_verified: autoVerified
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // 2. Update student_fees table
      const { error: feeError } = await supabase
        .from('student_fees')
        .update({
          status: feeStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', fee.id);

      if (feeError) throw feeError;

      // 3. Create Notification for the student
      const studentProfiles = fee.students?.profiles;
      const studentUserId = Array.isArray(studentProfiles) ? studentProfiles[0]?.user_id : studentProfiles?.user_id;

      if (studentUserId) {
        let title = 'Payment Verified';
        let msg = `Your payment of ₹${receivedAmount} for ${fee.billing_period} has been verified as PAID ✓.`;

        if (action === 'partial') {
          title = 'Partial Payment Received';
          msg = `Your payment of ₹${receivedAmount} for ${fee.billing_period} has been recorded as partial. Balance is still pending.`;
        } else if (action === 'reject') {
          title = 'Payment Rejected';
          msg = `Your payment verification request of ₹${receivedAmount} for ${fee.billing_period} has been rejected. Please re-upload proof.`;
        }

        await supabase.from('notifications').insert({
          user_id: studentUserId,
          title,
          message: msg,
          type: 'payment'
        });
      }

      toast.success(
        action === 'verify'
          ? 'Payment marked as PAID and verified!'
          : action === 'partial'
          ? 'Payment marked as partial.'
          : 'Payment verification rejected.'
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h3 className="font-bold text-base text-foreground font-display">Verify Payment Receipt</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Submitted by {fee.students?.profiles?.full_name} for {fee.billing_period} Rent.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-muted-foreground transition">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left panel: Receipt preview */}
          <div className="p-5 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 mb-2">Uploaded Document</h4>
              <div className="aspect-[4/3] w-full border rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center p-1 shadow-inner relative group">
                {payment?.proof_url ? (
                  payment.proof_url.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <FileText className="h-10 w-10 text-red-500 mb-2" />
                      <span className="font-bold text-xs">PDF Document Receipt</span>
                      <a href={payment.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] mt-2 font-semibold">Open PDF in new tab</a>
                    </div>
                  ) : (
                    <>
                      <img src={payment.proof_url} alt="Receipt proof" className="w-full h-full object-contain rounded-lg" />
                      <a href={payment.proof_url} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/85 text-white font-bold p-1.5 rounded-lg text-[10px] flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100">
                        Full View <ExternalLink size={10} />
                      </a>
                    </>
                  )
                ) : (
                  <div className="text-center text-muted-foreground text-xs p-4 flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                    <span>No receipt screenshot uploaded (e.g. Cash request)</span>
                  </div>
                )}
              </div>
            </div>

            {payment?.notes && (
              <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/50 rounded-xl p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-0.5">Student Notes:</span>
                <p className="italic">&ldquo;{payment.notes}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Right panel: Comparison and Actions */}
          <div className="p-5 space-y-5 text-xs flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400">Verification Metrics</h4>
              
              {/* Amounts box */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Expected Fee Amount:</span>
                  <span className="font-bold text-foreground text-sm">₹{expectedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Received Amount:</span>
                  <span className="font-extrabold text-foreground text-sm">₹{receivedAmount.toLocaleString()}</span>
                </div>
                
                <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-2.5 flex justify-between items-center">
                  <span className="text-muted-foreground">Amount Match Check:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase flex items-center gap-1 ${
                    amountsMatch 
                      ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300' 
                      : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                  }`}>
                    {amountsMatch ? '✅ Match (YES)' : '❌ Mismatch (NO)'}
                  </span>
                </div>
              </div>

              {/* Status specific notices */}
              {amountsMatch && (
                <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-200/50 dark:border-green-900/50 rounded-xl p-3 flex gap-2 text-green-800 dark:text-green-300">
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Amount verified!</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">Ready to mark as paid. Amounts match exactly.</p>
                  </div>
                </div>
              )}

              {isPartial && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/50 rounded-xl p-3 flex gap-2 text-amber-800 dark:text-amber-300">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Amount mismatch (Underpayment)</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">Expected: ₹{expectedAmount.toLocaleString()} vs Received: ₹{receivedAmount.toLocaleString()}.</p>
                  </div>
                </div>
              )}

              {isOverpayment && (
                <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/50 rounded-xl p-3 flex gap-2 text-red-800 dark:text-red-300">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Amount mismatch (Overpayment)</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">Expected: ₹{expectedAmount.toLocaleString()} vs Received: ₹{receivedAmount.toLocaleString()}.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Panel */}
            <div className="space-y-2 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-4">
              {amountsMatch ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleAction('verify', false)}
                    disabled={loading}
                    className="w-full h-9 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-1 transition"
                  >
                    {loading ? 'Processing...' : 'Auto-Mark as Paid'}
                  </button>
                  <button
                    onClick={() => handleAction('reject', false)}
                    disabled={loading}
                    className="w-full h-9 border border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20 text-red-600 font-semibold rounded-lg flex items-center justify-center gap-1 transition bg-card"
                  >
                    Override & Reject Payment
                  </button>
                </div>
              ) : isPartial ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('partial', false)}
                      disabled={loading}
                      className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition"
                    >
                      {loading ? 'Processing...' : 'Mark as Partial'}
                    </button>
                    <button
                      onClick={() => handleAction('reject', false)}
                      disabled={loading}
                      className="flex-1 h-9 bg-red-605 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition"
                    >
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() => handleAction('verify', true)}
                    disabled={loading}
                    className="w-full h-9 border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-semibold rounded-lg shadow-sm transition bg-card"
                  >
                    Override & Mark Paid Anyway
                  </button>
                </div>
              ) : (
                // Overpayment
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('verify', true)}
                      disabled={loading}
                      className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition"
                    >
                      {loading ? 'Processing...' : 'Mark Paid + Refund'}
                    </button>
                    <button
                      onClick={() => handleAction('reject', false)}
                      disabled={loading}
                      className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition"
                    >
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() => handleAction('verify', true)}
                    disabled={loading}
                    className="w-full h-9 border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground font-semibold rounded-lg shadow-sm transition bg-card"
                  >
                    Override
                  </button>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="w-full h-9 border text-muted-foreground hover:text-foreground font-semibold rounded-lg transition bg-card"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
