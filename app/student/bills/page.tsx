'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { 
  Clock, 
  CreditCard, 
  Info,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Building2,
  IndianRupee,
  Copy,
  Upload,
  FileText,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function formatBillingMonth(monthYear?: string, dueDate?: string): string {
  if (monthYear) {
    const parts = monthYear.split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (!isNaN(year) && !isNaN(month)) {
        const d = new Date(year, month - 1, 1);
        return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }
    }
    return monthYear;
  }
  if (dueDate) {
    return new Date(dueDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return 'Monthly Fee';
}

export default function StudentBillsPage() {
  const { profile } = useAuth();
  const [studentRecord, setStudentRecord] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [feesData, setFeesData] = useState<any>({ fees: [], total_due: 0, total_paid: 0, total_overdue: 0 });
  const [loading, setLoading] = useState(true);

  // Offline Payment Submission State
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'upi' | 'bank' | 'cash'>('upi');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, profile_id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) {
        setLoading(false);
        return;
      }
      setStudentRecord(student);

      const { data: alloc, error: allocError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          active,
          start_date,
          deposit_status,
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
        const { data: depositPayments } = await supabase
          .from('payments')
          .select('id, payment_status, status')
          .eq('student_id', student.id)
          .is('student_fees_id', null)
          .limit(1);

        const hasPaidDeposit = (alloc as any).deposit_status === 'paid' || 
          (depositPayments && depositPayments.some((p: any) => p.payment_status === 'completed' || p.status === 'completed'));
        const allocationWithDeposit = {
          ...alloc,
          deposit_status: hasPaidDeposit ? 'paid' : 'pending'
        };
        setAllocation(allocationWithDeposit);

        const hostelData = alloc.hostels as any;
        const ownerId = Array.isArray(hostelData) ? hostelData[0]?.owner_id : hostelData?.owner_id;
        let methodsQuery = supabase
          .from('payment_methods')
          .select('*')
          .eq('hostel_id', alloc.hostel_id)
          .eq('is_active', true);

        if (ownerId) {
          methodsQuery = methodsQuery.eq('owner_id', ownerId);
        }

        const { data: methods, error: methodsError } = await methodsQuery.order('is_primary', { ascending: false });

        if (methodsError) throw methodsError;
        setPaymentMethods(methods ?? []);

        const { data: fees, error: feesError } = await supabase
          .from('student_fees')
          .select(`
            *,
            payments (
              id,
              amount_paid,
              amount,
              payment_method,
              reference_number,
              payment_status,
              status,
              paid_date,
              paid_at,
              notes
            )
          `)
          .eq('student_id', student.id)
          .eq('allocation_id', alloc.id)
          .order('due_date', { ascending: false });

        if (feesError) throw feesError;

        const formattedFees = (fees ?? []).map((fee: any) => {
          const payment = fee.payments && fee.payments.length > 0
            ? fee.payments.find((p: any) => p.payment_status === 'completed' || p.status === 'completed' || p.payment_status === 'pending_verification') || fee.payments[0]
            : null;
          const feeAmount = Number(fee.amount_due ?? fee.amount ?? 0);
          return {
            ...fee,
            amount: feeAmount,
            month_year: fee.month_year,
            reference_number: payment?.reference_number,
            payment_method: payment?.payment_method || fee.payment_method,
            paid_date: payment?.paid_date || payment?.paid_at || fee.paid_date,
            payment_status: payment?.payment_status || payment?.status || fee.status
          };
        });

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

  const getSummaryFee = () => {
    if (!feesData.fees || feesData.fees.length === 0) return null;
    const now = new Date();
    const currentMonthFee = feesData.fees.find((f: any) => {
      if (f.month_year) {
        const parts = f.month_year.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (y === now.getFullYear() && m === (now.getMonth() + 1)) return true;
        }
      }
      if (f.due_date) {
        const d = new Date(f.due_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return false;
    });
    if (currentMonthFee) return currentMonthFee;

    const firstUnpaid = feesData.fees.find((f: any) => f.status !== 'paid');
    if (firstUnpaid) return firstUnpaid;

    return feesData.fees[0];
  };

  const summaryFee = getSummaryFee();

  const getDaysRemainingBadge = (fee: any) => {
    if (fee.status === 'paid') {
      return { text: 'Paid ✓', className: 'bg-green-100 text-green-800' };
    }
    if (fee.status === 'pending_verification') {
      return { text: 'Verification Pending', className: 'bg-amber-100 text-amber-800' };
    }
    const due = new Date(fee.due_date);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { text: `${diffDays} days remaining`, className: 'bg-blue-100 text-blue-800' };
    } else if (diffDays === 0) {
      return { text: 'Due Today', className: 'bg-teal-100 text-teal-800 font-bold' };
    } else {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, className: 'bg-rose-100 text-rose-800 font-bold' };
    }
  };

  const openPaymentModal = (fee: any) => {
    if (fee.status === 'paid') {
      toast.info('This fee is already marked as paid.');
      return;
    }
    if (fee.status === 'pending_verification') {
      toast.info('Payment proof has already been submitted and is pending verification.');
      return;
    }
    setSelectedFeeForPayment(fee);
    setPaymentMode('upi');
    setReferenceNumber('');
    setPaymentNotes('');
    setReceiptFile(null);
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeForPayment) return;

    if (selectedFeeForPayment.status === 'paid') {
      toast.error('This fee is already marked as paid.');
      return;
    }
    if (selectedFeeForPayment.status === 'pending_verification') {
      toast.error('Payment proof is already pending verification for this fee.');
      return;
    }

    // Authenticated student ownership validation
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be signed in to submit payment proof.');
      return;
    }

    if (!studentRecord?.id || selectedFeeForPayment.student_id !== studentRecord.id) {
      toast.error('Unauthorized: You can only submit payment proof for your own fees.');
      return;
    }

    const trimmedRef = referenceNumber.trim();
    if (paymentMode !== 'cash' && (!trimmedRef || trimmedRef.length < 4)) {
      toast.error(`Please provide a valid reference / UTR number for ${paymentMode.toUpperCase()} payment (at least 4 characters).`);
      return;
    }

    if (receiptFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(receiptFile.type)) {
        toast.error('Invalid file format. Allowed formats: JPG, PNG, WEBP, PDF.');
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        toast.error('Receipt file size must be less than 5MB.');
        return;
      }
    }

    setIsSubmittingPayment(true);
    try {
      let proofUrl: string | null = null;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop()?.toLowerCase() || 'png';
        const cleanFileName = `${studentRecord.id}/${selectedFeeForPayment.id}_${Date.now()}.${fileExt}`;
        const filePath = `receipts/${cleanFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payments')
          .upload(filePath, receiptFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Receipt upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('payments')
          .getPublicUrl(filePath);

        proofUrl = urlData.publicUrl;
      }

      const formattedRef = trimmedRef
        ? `[${paymentMode.toUpperCase()}] ${trimmedRef}`
        : `[${paymentMode.toUpperCase()}] Offline Payment`;

      // Call authoritative record_student_payment RPC
      const { error: rpcError } = await supabase.rpc('record_student_payment', {
        p_student_fees_id: selectedFeeForPayment.id,
        p_reference_number: formattedRef,
        p_proof_url: proofUrl
      });

      if (rpcError) throw rpcError;

      // Dual-compatibility sync on payments table
      await supabase
        .from('payments')
        .update({
          student_fees_id: selectedFeeForPayment.id,
          amount_paid: selectedFeeForPayment.amount,
          payment_method: paymentMode,
          payment_status: 'pending_verification',
          notes: paymentNotes.trim() || null
        })
        .eq('fee_id', selectedFeeForPayment.id)
        .eq('status', 'pending_verification');

      toast.success('Payment proof submitted successfully! Awaiting owner verification.');
      setIsPaymentModalOpen(false);
      setSelectedFeeForPayment(null);
      setReferenceNumber('');
      setPaymentNotes('');
      setReceiptFile(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit payment proof');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );
  }

  if (!studentRecord) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="h-16 w-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Student Record Not Found</h2>
        <p className="text-slate-600 text-center max-w-md">Please make sure you are registered as a student to access bills.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 font-display">Fees & Billing</h1>
        <p className="text-slate-600">Monitor your rents, safety deposits, and submit payment verifications.</p>
      </div>

      {!allocation ? (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <Info className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Room Allocation</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              Your billing details and payment tracking will become active once the owner approves your room booking request and allocates you a room.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Due</p>
                    <p className="font-bold text-slate-900">₹{feesData.total_due.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{feesData.fees.filter((f: any) => f.status === 'pending' || f.status === 'overdue').length} pending bills</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Paid</p>
                    <p className="font-bold text-slate-900">₹{feesData.total_paid.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{feesData.fees.filter((f: any) => f.status === 'paid').length} paid bills</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Overdue</p>
                    <p className="font-bold text-slate-900">₹{feesData.total_overdue.toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{feesData.fees.filter((f: any) => f.status === 'overdue').length} overdue bills</p>
              </CardContent>
            </Card>
          </div>

          {/* Current Month Summary */}
          {summaryFee && (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {formatBillingMonth(summaryFee.month_year, summaryFee.due_date)}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-3xl font-bold text-slate-900">
                        ₹{summaryFee.status === 'paid' ? 0 : summaryFee.amount}
                      </h2>
                      <span className="text-sm text-slate-500">due of ₹{summaryFee.amount} rent</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        Due: {new Date(summaryFee.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={cn("font-medium", 
                        summaryFee.status === 'paid' ? 'text-green-600' :
                        summaryFee.status === 'pending_verification' ? 'text-amber-600' :
                        summaryFee.status === 'overdue' ? 'text-rose-600' : 'text-amber-600'
                      )}>
                        {summaryFee.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className={cn("px-3 py-1.5 rounded-full text-xs font-semibold", getDaysRemainingBadge(summaryFee).className)}>
                      {getDaysRemainingBadge(summaryFee).text}
                    </span>
                    {(summaryFee.status === 'pending' || summaryFee.status === 'overdue') && (
                      <Button
                        onClick={() => openPaymentModal(summaryFee)}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 h-8 shadow-sm"
                      >
                        <CreditCard size={14} />
                        Submit Payment Proof
                      </Button>
                    )}
                    {summaryFee.status === 'pending_verification' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock size={14} />
                        Awaiting Verification
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900">Payment History</h3>
              </div>

              {feesData.fees.length === 0 ? (
                <div className="text-center py-12">
                  <Info className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No billing schedule generated yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feesData.fees.map((fee: any) => {
                    const daysBadge = getDaysRemainingBadge(fee);
                    return (
                      <div key={fee.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{formatBillingMonth(fee.month_year, fee.due_date)}</p>
                              <p className="text-xs text-slate-500">Due: {new Date(fee.due_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">₹{fee.amount}</p>
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", 
                              fee.status === 'paid'
                                ? 'bg-green-100 text-green-700' 
                                : fee.status === 'pending_verification'
                                ? 'bg-amber-100 text-amber-700' 
                                : fee.status === 'overdue'
                                ? 'bg-rose-100 text-rose-700' 
                                : 'bg-amber-100 text-amber-700'
                            )}>
                              {fee.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <div className="text-xs text-slate-500">
                            {fee.status === 'paid' ? (
                              <span>Paid on {fee.paid_date ? new Date(fee.paid_date).toLocaleDateString() : new Date(fee.updated_at).toLocaleDateString()} via {fee.payment_method || 'Manual'}</span>
                            ) : fee.status === 'pending_verification' ? (
                              <span className="text-amber-600">Awaiting Owner Approval</span>
                            ) : (
                              <span className={cn("font-medium", daysBadge.className === 'bg-rose-100 text-rose-800' ? 'text-rose-600' : 'text-slate-600')}>
                                {daysBadge.text}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {fee.status === 'paid' && (
                              <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                                <CheckCircle2 size={14} /> Verified
                              </span>
                            )}
                            {fee.status === 'pending_verification' && (
                              <span className="text-amber-600 font-medium text-xs flex items-center gap-1">
                                <Clock size={14} /> In Review
                              </span>
                            )}
                            {(fee.status === 'pending' || fee.status === 'overdue') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPaymentModal(fee)}
                                className="text-xs font-semibold text-teal-700 border-teal-300 hover:bg-teal-50 h-7"
                              >
                                Submit Proof
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Hostel Payment Details</h3>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>Owner has not set payment methods yet. Please contact your hostel owner for payment instructions.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method: any) => (
                    <div key={method.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="h-8 w-8 flex items-center justify-center rounded-lg bg-teal-100 text-teal-700 font-bold text-xs uppercase">
                            {method.payment_type === 'qr_code' ? 'QR' : method.payment_type}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {method.payment_type === 'upi' && 'UPI Payment'}
                            {method.payment_type === 'bank' && 'Bank Transfer'}
                            {method.payment_type === 'qr_code' && 'Scan QR'}
                          </span>
                        </div>
                        {method.is_primary && (
                          <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-1 rounded-full">Primary</span>
                        )}
                      </div>

                      {method.payment_type === 'upi' && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">UPI ID</p>
                            <p className="font-mono font-semibold text-slate-900">{method.upi_id}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(method.upi_id || '');
                              toast.success('UPI ID copied');
                            }}
                            className="rounded-lg"
                          >
                            <Copy size={14} />
                          </Button>
                        </div>
                      )}

                      {method.payment_type === 'bank' && (
                        <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-200">
                          <div>
                            <p className="text-xs text-slate-500">Account Holder</p>
                            <p className="font-semibold text-slate-900">{method.account_holder_name}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-slate-500">Account Number</p>
                              <p className="font-mono font-semibold text-slate-900">{method.bank_account}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(method.bank_account || '');
                                toast.success('Account number copied');
                              }}
                              className="rounded-lg"
                            >
                              <Copy size={14} />
                            </Button>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">IFSC Code</p>
                            <p className="font-mono font-semibold text-slate-900 uppercase">{method.ifsc_code}</p>
                          </div>
                        </div>
                      )}

                      {method.payment_type === 'qr_code' && method.qr_code_url && (
                        <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
                          <button
                            className="h-20 w-20 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-teal-400 transition-all"
                          >
                            <img src={method.qr_code_url} alt="QR Code" className="h-full w-full object-contain" />
                          </button>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 mb-1">Scan to Pay</p>
                            <p className="text-xs text-slate-500">Use any UPI app to scan this QR code</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Proof Submission Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-2xl p-6 border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              Submit Payment Proof
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Record your offline payment details and receipt for hostel owner verification.
            </DialogDescription>
          </DialogHeader>

          {selectedFeeForPayment && (
            <form onSubmit={handleSubmitPaymentProof} className="space-y-4 pt-2">
              {/* Fee summary card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Billing Period</p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {formatBillingMonth(selectedFeeForPayment.month_year, selectedFeeForPayment.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">Amount Due</p>
                  <p className="font-bold text-teal-700 text-base">₹{selectedFeeForPayment.amount}</p>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Payment Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('upi')}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all text-xs font-semibold flex flex-col items-center gap-1",
                      paymentMode === 'upi'
                        ? "border-teal-600 bg-teal-50/50 text-teal-800 ring-1 ring-teal-600"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    )}
                  >
                    <CreditCard size={16} className={paymentMode === 'upi' ? "text-teal-600" : "text-slate-500"} />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('bank')}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all text-xs font-semibold flex flex-col items-center gap-1",
                      paymentMode === 'bank'
                        ? "border-teal-600 bg-teal-50/50 text-teal-800 ring-1 ring-teal-600"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    )}
                  >
                    <Building2 size={16} className={paymentMode === 'bank' ? "text-teal-600" : "text-slate-500"} />
                    <span>Bank Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={cn(
                      "p-2.5 rounded-xl border text-center transition-all text-xs font-semibold flex flex-col items-center gap-1",
                      paymentMode === 'cash'
                        ? "border-teal-600 bg-teal-50/50 text-teal-800 ring-1 ring-teal-600"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    )}
                  >
                    <IndianRupee size={16} className={paymentMode === 'cash' ? "text-teal-600" : "text-slate-500"} />
                    <span>Cash</span>
                  </button>
                </div>
              </div>

              {/* Reference / UTR Number */}
              <div className="space-y-1.5">
                <Label htmlFor="ref-input" className="text-xs font-semibold text-slate-700">
                  {paymentMode === 'upi' && 'UPI Reference ID / Transaction UTR *'}
                  {paymentMode === 'bank' && 'Bank IMPS / NEFT UTR Number *'}
                  {paymentMode === 'cash' && 'Receipt Note / Reference (Optional)'}
                </Label>
                <Input
                  id="ref-input"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder={
                    paymentMode === 'upi'
                      ? 'e.g. 12-digit UPI reference ID (e.g. 428172910291)'
                      : paymentMode === 'bank'
                      ? 'e.g. UTR / Transaction reference number'
                      : 'e.g. Handed cash to warden / receipt #123'
                  }
                  required={paymentMode !== 'cash'}
                  className="text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  {paymentMode === 'upi' && 'Found in your UPI app receipt details (PhonePe, GPay, Paytm).'}
                  {paymentMode === 'bank' && 'Found on your net banking debit confirmation.'}
                  {paymentMode === 'cash' && 'Optional note describing who you handed the cash to.'}
                </p>
              </div>

              {/* Receipt File Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Payment Receipt / Screenshot {paymentMode === 'cash' ? '(Optional)' : '(Recommended)'}
                </Label>
                <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center hover:border-teal-400 transition-colors bg-slate-50/50">
                  {receiptFile ? (
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 overflow-hidden text-left">
                        <FileText className="h-5 w-5 text-teal-600 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-800 truncate">{receiptFile.name}</p>
                          <p className="text-[10px] text-slate-400">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setReceiptFile(null)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error('File size must be 5MB or less');
                              return;
                            }
                            setReceiptFile(file);
                          }
                        }}
                      />
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-slate-700">Upload screenshot or PDF receipt</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG, WEBP, or PDF up to 5MB</p>
                    </label>
                  )}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes-input" className="text-xs font-semibold text-slate-700">
                  Notes for Owner (Optional)
                </Label>
                <Textarea
                  id="notes-input"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid from HDFC account ending in 4102..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <DialogFooter className="pt-2 flex sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmittingPayment}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  {isSubmittingPayment && <Loader2 size={14} className="animate-spin" />}
                  {isSubmittingPayment ? 'Submitting...' : 'Submit Payment Proof'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
