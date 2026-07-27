'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { 
  Clock, 
  CreditCard, 
  Info,
  Calendar,
  UploadCloud,
  Copy,
  AlertCircle,
  X,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentBillsPage() {
  const { profile } = useAuth();
  const [studentRecord, setStudentRecord] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [feesData, setFeesData] = useState<any>({ fees: [], total_due: 0, total_paid: 0, total_overdue: 0 });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedPayFee, setSelectedPayFee] = useState<any | null>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Student ID
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) {
        setLoading(false);
        return;
      }
      setStudentRecord(student);

      // 2. Fetch Active Allocation
      const { data: alloc, error: allocError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          active,
          start_date,
          created_at,
          rooms(
            id,
            room_number,
            rent
          ),
          hostels(
            id,
            name,
            owner_id
          )
        `)
        .eq('student_id', student.id)
        .eq('active', true)
        .maybeSingle();

      if (allocError) throw allocError;

      if (alloc) {
        // Fetch if security deposit is paid
        const { data: depositPayments } = await supabase
          .from('payments')
          .select('id, payment_status')
          .eq('student_id', student.id)
          .is('student_fees_id', null)
          .eq('payment_status', 'completed')
          .limit(1);

        const hasPaidDeposit = depositPayments && depositPayments.length > 0;
        const allocationWithDeposit = {
          ...alloc,
          deposit_status: hasPaidDeposit ? 'paid' : 'pending'
        };
        setAllocation(allocationWithDeposit);

        // 3. Fetch Owner Payment Methods
        const hostelData = alloc.hostels as any;
        const ownerId = Array.isArray(hostelData) ? hostelData[0]?.owner_id : hostelData?.owner_id;
        const { data: methods, error: methodsError } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('owner_id', ownerId)
          .eq('is_active', true)
          .order('is_primary', { ascending: false });

        if (methodsError) throw methodsError;
        setPaymentMethods(methods ?? []);

        // 4. Fetch Student Fees separately
        const { data: fees, error: feesError } = await supabase
          .from('student_fees')
          .select(`
            *,
            payments (
              id,
              amount_paid,
              payment_method,
              reference_number,
              payment_status,
              paid_date,
              notes
            )
          `)
          .eq('student_id', student.id)
          .eq('allocation_id', alloc.id)
          .order('due_date', { ascending: false });

        if (feesError) throw feesError;

        // Map/flatten fee data to match the UI expectation
        const formattedFees = (fees ?? []).map((fee: any) => {
          const payment = fee.payments && fee.payments.length > 0
            ? fee.payments.find((p: any) => p.payment_status === 'completed' || p.payment_status === 'pending_verification') || fee.payments[0]
            : null;
          return {
            ...fee,
            reference_number: payment?.reference_number,
            payment_method: payment?.payment_method,
            paid_date: payment?.paid_date,
            payment_status: payment?.payment_status
          };
        });

        // Compute totals manually
        const total_due = formattedFees
          .filter((f: any) => f.status === 'pending' || f.status === 'overdue')
          .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

        const total_overdue = formattedFees
          .filter((f: any) => f.status === 'overdue')
          .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

        const total_paid = formattedFees
          .filter((f: any) => f.status === 'paid')
          .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

        setFeesData({
          fees: formattedFees,
          total_due,
          total_paid,
          total_overdue
        });
      } else {
        setAllocation(null);
        setPaymentMethods([]);
        setFeesData({ fees: [], total_due: 0, total_paid: 0, total_overdue: 0 });
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load billing details');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate current month's fee summary
  const getSummaryFee = () => {
    if (!feesData.fees || feesData.fees.length === 0) return null;
    const now = new Date();
    // 1. Try to find a fee for the current calendar month/year
    const currentMonthFee = feesData.fees.find((f: any) => {
      const d = new Date(f.due_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    if (currentMonthFee) return currentMonthFee;

    // 2. Otherwise find the first unpaid fee
    const firstUnpaid = feesData.fees.find((f: any) => f.status !== 'paid');
    if (firstUnpaid) return firstUnpaid;

    // 3. Otherwise return the latest fee
    return feesData.fees[0];
  };

  const summaryFee = getSummaryFee();

  // Days remaining calculation helper
  const getDaysRemainingBadge = (fee: any) => {
    if (fee.status === 'paid') {
      return { text: 'Paid ✓', className: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300' };
    }
    if (fee.status === 'pending_verification') {
      return { text: 'Verification Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' };
    }
    const due = new Date(fee.due_date);
    const today = new Date();
    // Strip time parts
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { text: `${diffDays} days remaining`, className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300' };
    } else if (diffDays === 0) {
      return { text: 'Due Today', className: 'bg-orange-100 text-orange-850 dark:bg-orange-950/30 dark:text-orange-350 font-bold' };
    } else {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, className: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300 font-bold animate-pulse' };
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground max-w-5xl mx-auto min-h-[400px] flex flex-col justify-center items-center">
        <Clock className="animate-spin h-10 w-10 text-primary mb-4" />
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">Loading your fees and payments dashboard...</p>
      </div>
    );
  }

  if (!studentRecord) {
    return (
      <div className="p-8 text-center max-w-4xl mx-auto space-y-4 min-h-[400px] flex flex-col justify-center items-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Student Record Not Found</h2>
        <p className="text-muted-foreground">Please make sure you are registered as a student to access bills.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-zinc-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Header */}
      <div className="border-b pb-6 border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="text-primary h-8 w-8" /> Fees & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your rents, safety deposits, and submit payment verifications.
        </p>
      </div>

      {!allocation ? (
        <div className="bg-card rounded-2xl border p-8 text-center max-w-2xl mx-auto space-y-4 shadow-sm">
          <Info className="h-10 w-10 text-muted-foreground/60 mx-auto" />
          <h3 className="text-lg font-bold text-foreground">No Active Room Allocation</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your billing details and payment tracking will become active once the owner approves your room booking request and allocates you a room.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Row 1: Monthly Fees Summary Card */}
          {summaryFee && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Rent Summary for {summaryFee.billing_period}
                </span>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                    ₹{summaryFee.status === 'paid' ? 0 : summaryFee.amount}
                  </h2>
                  <span className="text-xs text-muted-foreground">due of ₹{summaryFee.amount} rent</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-zinc-400" />
                    Due Date: <span className="font-semibold text-foreground">{new Date(summaryFee.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </span>
                  <span>•</span>
                  <span>
                    Status:{' '}
                    <span className={`font-semibold capitalize ${
                      summaryFee.status === 'paid' ? 'text-green-600' :
                      summaryFee.status === 'pending_verification' ? 'text-amber-600' :
                      summaryFee.status === 'overdue' ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {summaryFee.status.replace('_', ' ')}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getDaysRemainingBadge(summaryFee).className}`}>
                  {getDaysRemainingBadge(summaryFee).text}
                </span>
                {summaryFee.status !== 'paid' && summaryFee.status !== 'pending_verification' && (
                  <button
                    onClick={() => setSelectedPayFee(summaryFee)}
                    className="bg-primary hover:bg-primary/95 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-primary/10 transition"
                  >
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 2: Grid for History & Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column (Wide) - Fees Payment History Table */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Fees Payment History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">List of all scheduled monthly fees, statuses, and receipt logs.</p>
              </div>

              {feesData.fees.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                  <Info className="h-10 w-10 text-muted-foreground/40" />
                  <p className="font-semibold text-foreground">No billing schedule generated yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">
                        <th className="py-3 px-2">Month</th>
                        <th className="py-3 px-2">Amount</th>
                        <th className="py-3 px-2">Due Date</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2">Paid Details</th>
                        <th className="py-3 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {feesData.fees.map((fee: any) => {
                        const daysBadge = getDaysRemainingBadge(fee);
                        return (
                          <tr key={fee.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                            <td className="py-3.5 px-2 font-bold text-foreground whitespace-nowrap">{fee.billing_period}</td>
                            <td className="py-3.5 px-2 font-semibold text-foreground">₹{fee.amount}</td>
                            <td className="py-3.5 px-2 text-muted-foreground whitespace-nowrap">
                              <p>{new Date(fee.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                              {fee.status !== 'paid' && (
                                <p className="text-[10px] text-amber-600 font-medium">{daysBadge.text}</p>
                              )}
                            </td>
                            <td className="py-3.5 px-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                fee.status === 'paid'
                                  ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300'
                                  : fee.status === 'pending_verification'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                                  : fee.status === 'overdue'
                                  ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                                  : 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-300'
                              }`}>
                                {fee.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-muted-foreground">
                              {fee.status === 'paid' ? (
                                <div className="space-y-0.5 text-[11px]">
                                  <p>Date: <span className="font-semibold text-foreground">{fee.paid_date ? new Date(fee.paid_date).toLocaleDateString() : new Date(fee.updated_at).toLocaleDateString()}</span></p>
                                  <p>Method: <span className="font-semibold uppercase text-foreground">{fee.payment_method || 'Manual'}</span></p>
                                </div>
                              ) : fee.status === 'pending_verification' ? (
                                <span className="italic text-[11px]">Awaiting Owner Approval</span>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              {fee.status !== 'paid' && fee.status !== 'pending_verification' && (
                                <button
                                  onClick={() => setSelectedPayFee(fee)}
                                  className="bg-primary hover:bg-primary/95 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition"
                                >
                                  Pay Now
                                </button>
                              )}
                              {fee.status === 'paid' && (
                                <span className="text-green-600 font-bold text-[11px]">✓ Verified</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Column (Narrow) - Payment Methods & Accom Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Payment Methods card */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-zinc-500">
                    Hostel Payment Details
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Use these details to pay your rent manually.</p>
                </div>

                {paymentMethods.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>Owner has not set payment methods yet. Please contact your hostel owner for payment instructions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((method: any) => (
                      <div key={method.id} className="p-3 border.5 border-zinc-100 dark:border-zinc-800 rounded-xl space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="h-5 w-8 flex items-center justify-center rounded bg-primary/10 text-primary font-bold text-[10px] uppercase">
                              {method.payment_type === 'qr_code' ? 'QR' : method.payment_type}
                            </span>
                            <span className="font-bold text-foreground">
                              {method.payment_type === 'upi' && 'UPI Payment'}
                              {method.payment_type === 'bank' && 'Bank Transfer'}
                              {method.payment_type === 'qr_code' && 'Scan QR'}
                            </span>
                          </div>
                          {method.is_primary && (
                            <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Primary</span>
                          )}
                        </div>

                        {method.payment_type === 'upi' && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                              <p className="text-[10px] text-muted-foreground">UPI ID:</p>
                              <p className="font-mono font-bold text-foreground truncate select-all">{method.upi_id}</p>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(method.upi_id || '');
                                toast.success('UPI ID copied');
                              }}
                              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 border rounded-lg shrink-0 transition"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        )}

                        {method.payment_type === 'bank' && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Account Holder:</p>
                                <p className="font-semibold text-foreground">{method.account_holder_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Account Number:</p>
                                <p className="font-mono font-bold text-foreground select-all">{method.bank_account}</p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(method.bank_account || '');
                                  toast.success('Account number copied');
                                }}
                                className="p-1 border rounded"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">IFSC Code:</p>
                              <p className="font-mono font-bold text-foreground uppercase select-all">{method.ifsc_code}</p>
                            </div>
                          </div>
                        )}

                        {method.payment_type === 'qr_code' && (
                          <div className="flex items-center gap-3">
                            {method.qr_code_url && (
                              <button
                                onClick={() => setViewingReceiptUrl(method.qr_code_url)}
                                className="flex h-14 w-14 items-center justify-center border rounded-lg bg-white overflow-hidden shrink-0 hover:ring-2 hover:ring-primary shadow-sm transition-all"
                                title="View QR Code"
                              >
                                <img src={method.qr_code_url} alt="QR Code" className="h-full w-full object-contain" />
                              </button>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">QR Scanner</p>
                              {method.upi_id && <p className="font-mono text-[10px] text-muted-foreground truncate">{method.upi_id}</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Accommodation card */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-zinc-500">
                  Accommodation Details
                </h3>
                <div className="text-xs text-muted-foreground space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border">
                  <div className="flex justify-between items-center py-1">
                    <span>Hostel:</span>
                    <span className="font-bold text-foreground">{allocation.hostels?.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span>Room Number:</span>
                    <span className="font-bold text-foreground">Room {allocation.rooms?.room_number}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span>Monthly Rent:</span>
                    <span className="font-bold text-foreground">₹{allocation.rooms?.rent}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                    <span>Security Deposit:</span>
                    {allocation.deposit_status === 'paid' ? (
                      <span className="bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-300 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">Paid ✓</span>
                    ) : (
                      <span className="bg-orange-100 text-orange-850 dark:bg-orange-950/20 dark:text-orange-300 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD PAYMENT PROOF MODAL */}
      {selectedPayFee && (
        <UploadProofModal
          fee={selectedPayFee}
          paymentMethods={paymentMethods}
          onClose={() => setSelectedPayFee(null)}
          onSuccess={() => {
            setSelectedPayFee(null);
            fetchData();
          }}
        />
      )}

      {/* RECEIPT VIEW MODAL */}
      {viewingReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setViewingReceiptUrl(null)}>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2 border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-foreground text-sm">Document Preview</h3>
              <button
                onClick={() => setViewingReceiptUrl(null)}
                className="text-muted-foreground hover:text-foreground font-semibold text-xs border rounded-lg px-2.5 py-1"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-zinc-55 dark:bg-zinc-950 border rounded-xl p-2 shadow-inner">
              {viewingReceiptUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe src={viewingReceiptUrl} className="w-full h-[400px] rounded-lg" title="PDF Document" />
              ) : (
                <img src={viewingReceiptUrl} alt="Receipt proof preview" className="max-w-full max-h-[450px] object-contain rounded-lg" />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <a
                href={viewingReceiptUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                Open in New Tab <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- UPLOAD PAYMENT PROOF MODAL ---------------- */

interface UploadProofModalProps {
  fee: any;
  paymentMethods: any[];
  onClose: () => void;
  onSuccess: () => void;
}

function UploadProofModal({ fee, paymentMethods, onClose, onSuccess }: UploadProofModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<any | null>(null);
  const [isCash, setIsCash] = useState(false);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState<string>(String(fee.amount));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingKnitPay, setLoadingKnitPay] = useState(false);

  const handleKnitPayCheckout = async () => {
    setLoadingKnitPay(true);
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feeId: fee.id,
          amount: Number(amountPaid),
          studentId: fee.student_id
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const orderData = await res.json();
      const orderId = orderData.orderId;
      const isSandbox = orderData.mode === 'sandbox';

      // Sandbox checkout simulation
      if (isSandbox) {
        const confirmPayment = window.confirm(
          `[Knit Pay Sandbox Mode]\n\nOrder ID: ${orderId}\nAmount: ₹${amountPaid}\n\nWould you like to complete this mock transaction instantly?`
        );

        if (!confirmPayment) {
          toast.error('Payment cancelled');
          setLoadingKnitPay(false);
          return;
        }

        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: orderId,
            payment_id: `pay_mock_${Math.random().toString(36).substring(2, 10)}`,
            signature: `sig_mock_${Math.random().toString(36).substring(2, 10)}`
          })
        });

        if (!verifyRes.ok) {
          const errorData = await verifyRes.json();
          throw new Error(errorData.error || 'Payment verification failed');
        }

        toast.success('Online Payment Processed & Verified Successfully! ✓');
      } else {
        // Production checkout flow simulation
        toast.success('Initiating Production Payment Checkout...');
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: orderId,
            payment_id: `pay_prod_${Math.random().toString(36).substring(2, 10)}`,
            signature: `sig_prod_${Math.random().toString(36).substring(2, 10)}`
          })
        });

        if (!verifyRes.ok) {
          throw new Error('Failed to verify production signature');
        }
        toast.success('Online Payment Verified Successfully!');
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Online payment checkout failed');
    } finally {
      setLoadingKnitPay(false);
    }
  };

  useEffect(() => {
    if (paymentMethods.length > 0) {
      const primary = paymentMethods.find((m) => m.is_primary && m.is_active) || paymentMethods[0];
      setSelectedMethod(primary);
    }
  }, [paymentMethods]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB');
        return;
      }
      // Support png, jpg, jpeg, pdf
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!ext || !['png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
        toast.error('Only JPG, PNG and PDF files are allowed');
        return;
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview(null); // PDF preview skipped or showing a file icon
      }
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const max = 1200;
          if (width > max || height > max) {
            if (width > height) {
              height = Math.round((height * max) / width);
              width = max;
            } else {
              width = Math.round((width * max) / height);
              height = max;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.7
          );
        };
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amountPaid.trim() || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
      toast.error('Please enter a valid amount paid');
      return;
    }

    if (!isCash) {
      if (!reference.trim()) {
        toast.error('Please enter a Transaction Reference ID / Reference Number');
        return;
      }
      if (!file) {
        toast.error('Please upload your receipt / transfer screenshot');
        return;
      }
    }

    setLoading(true);
    try {
      let publicUrl = '';

      if (!isCash && file) {
        // Compress images, skip PDF compression
        let uploadBlob: Blob | File = file;
        if (file.type.startsWith('image/')) {
          uploadBlob = await compressImage(file);
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `receipt_${fee.id}_${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        // Upload to supabase storage
        const { error: uploadError } = await supabase.storage
          .from('payments')
          .upload(filePath, uploadBlob, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
          .from('payments')
          .getPublicUrl(filePath);

        publicUrl = data.publicUrl;
      }

      // 1. Try to update student_fees status
      const { error: feeError } = await supabase
        .from('student_fees')
        .update({
          status: 'pending_verification'
        })
        .eq('id', fee.id);

      if (feeError) throw feeError;

      // 2. Insert payment record
      const referenceNum = isCash ? `CASH-${Date.now()}` : reference.trim();
      let notesVal = notes.trim() ? notes.trim() : (isCash ? 'Student selected cash payment' : 'Online payment submitted');
      if (!isCash && publicUrl) {
        notesVal += ` (Receipt: ${publicUrl})`;
      }
      
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          student_fees_id: fee.id,
          student_id: fee.student_id,
          allocation_id: fee.allocation_id,
          hostel_id: fee.hostel_id,
          amount_paid: Number(amountPaid),
          payment_method: isCash ? 'cash' : 'upi',
          payment_type: 'rent',
          payment_status: 'pending_verification',
          reference_number: referenceNum,
          notes: notesVal,
          paid_date: new Date().toISOString()
        });

      if (paymentError) throw paymentError;

      if (isCash) {
        toast.success('Cash payment request submitted. Please hand over the cash to the owner!');
      } else {
        toast.success('Payment submitted. Awaiting owner verification!');
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Payment submission failed');
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
            <h3 className="font-bold text-base text-foreground">Upload Payment Proof</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Period: <span className="font-semibold text-foreground">{fee.billing_period}</span> • Rent Amount: <span className="font-bold text-foreground">₹{fee.amount}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-muted-foreground transition">
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Method Select tab */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Flow</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCash(false)}
                className={`flex-1 h-9 border text-xs font-semibold rounded-lg transition ${
                  !isCash
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Online Transfer
              </button>
              <button
                type="button"
                onClick={() => setIsCash(true)}
                className={`flex-1 h-9 border text-xs font-semibold rounded-lg transition ${
                  isCash
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Cash Payment
              </button>
            </div>
          </div>

          {isCash ? (
            <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/50 rounded-xl p-3.5 space-y-2 text-amber-800 dark:text-amber-300">
              <h4 className="font-bold">Manual Cash Instructions:</h4>
              <p className="leading-relaxed text-[11px]">
                1. Hand over the exact amount of <span className="font-bold">₹{fee.amount}</span> in cash directly to your hostel owner.
                <br />
                2. Enter any notes/messages for the owner below.
                <br />
                3. Click &quot;Submit&quot; to notify the owner. The status will update to &quot;Pending Verification&quot; until they mark it Paid.
              </p>
              <div className="pt-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400">Owner Notes (Optional)</label>
                <textarea
                  placeholder="e.g. Will pay by tonight, Handed over cash at office"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 p-2 border border-amber-300 dark:border-amber-900 bg-card text-foreground rounded-lg text-xs"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Knit Pay Online Checkout Option */}
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-xl p-4 space-y-2.5 text-center mb-2 animate-in fade-in duration-200">
                <div className="flex justify-center items-center gap-1.5 text-primary">
                  <CreditCard size={18} className="animate-pulse" />
                  <h4 className="font-bold text-xs">Fast & Secure Online Checkout</h4>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Pay instantly using UPI, cards, or net banking via Knit Pay. Your bill status will update automatically.
                </p>
                <button
                  type="button"
                  onClick={handleKnitPayCheckout}
                  disabled={loadingKnitPay}
                  className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-md shadow-primary/15 transition duration-150"
                >
                  {loadingKnitPay ? (
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="animate-spin" /> Processing Online Payment...
                    </span>
                  ) : (
                    'Pay Online (UPI / Card)'
                  )}
                </button>
              </div>

              {/* Or manual divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-3 text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Or Manual Upload</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Online payment instructions */}
              {paymentMethods.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transfer Account</label>
                  <select
                    value={selectedMethod?.id || ''}
                    onChange={(e) => setSelectedMethod(paymentMethods.find((m) => m.id === e.target.value))}
                    className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:outline-none"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.payment_type.toUpperCase()} - {m.payment_type === 'upi' ? m.upi_id : m.bank_account}
                      </option>
                    ))}
                  </select>

                  {/* Render details of selected method */}
                  {selectedMethod && (
                    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800/80 rounded-xl space-y-2 text-[11px] leading-relaxed">
                      {selectedMethod.payment_type === 'upi' && (
                        <p>Transfer the rent of <span className="font-bold">₹{fee.amount}</span> to UPI ID: <span className="font-mono font-bold text-foreground select-all bg-white dark:bg-zinc-800 border px-1 rounded">{selectedMethod.upi_id}</span></p>
                      )}
                      {selectedMethod.payment_type === 'bank' && (
                        <div className="space-y-0.5">
                          <p>Account Holder: <span className="font-semibold text-foreground">{selectedMethod.account_holder_name}</span></p>
                          <p>A/C Number: <span className="font-mono font-bold text-foreground select-all bg-white dark:bg-zinc-800 border px-1 rounded">{selectedMethod.bank_account}</span></p>
                          <p>IFSC Code: <span className="font-mono font-bold text-foreground select-all bg-white dark:bg-zinc-800 border px-1 rounded">{selectedMethod.ifsc_code}</span></p>
                        </div>
                      )}
                      {selectedMethod.payment_type === 'qr_code' && (
                        <div className="flex gap-3 items-center">
                          {selectedMethod.qr_code_url && (
                            <a href={selectedMethod.qr_code_url} target="_blank" rel="noreferrer" className="flex h-12 w-12 border rounded bg-white overflow-hidden shrink-0 shadow-sm">
                              <img src={selectedMethod.qr_code_url} alt="Scan QR" className="h-full w-full object-contain" />
                            </a>
                          )}
                          <div>
                            <p className="font-bold text-foreground">Scan QR Code via UPI App</p>
                            {selectedMethod.upi_id && <p className="font-mono text-zinc-550 select-all font-semibold">{selectedMethod.upi_id}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount Paid input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount Paid (₹) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                  required
                />
              </div>

              {/* Transaction ID */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transaction ID / UPI Reference ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. UTR Number, Transaction ID, Reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                  required
                />
              </div>

              {/* Upload screenshot */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Upload Receipt / Payment Screenshot <span className="text-red-500">*</span></label>
                <div className="flex flex-col items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 hover:bg-zinc-55/40 cursor-pointer relative min-h-[100px] transition">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    required
                  />
                  {file ? (
                    <div className="flex flex-col items-center space-y-1">
                      {preview ? (
                        <img src={preview} alt="Receipt preview" className="h-14 w-14 object-contain rounded border bg-white" />
                      ) : (
                        <span className="font-semibold text-primary text-[10px] truncate max-w-[200px]">{file.name}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground">Uploaded. Click to replace file.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1.5 py-1">
                      <UploadCloud size={22} className="text-muted-foreground" />
                      <span className="text-[10px] font-bold text-foreground">Click to upload transfer receipt</span>
                      <span className="text-[8px] text-muted-foreground">PNG, JPG, PDF up to 5MB</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 border rounded-lg text-xs font-semibold hover:bg-zinc-55 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1 shadow-md shadow-primary/10 transition"
            >
              {loading ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
