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
  IndianRupee
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StudentBillsPage() {
  const { profile } = useAuth();
  const [studentRecord, setStudentRecord] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [feesData, setFeesData] = useState<any>({ fees: [], total_due: 0, total_paid: 0, total_overdue: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
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

      const { data: alloc, error: allocError } = await supabase
        .from('room_allocations')
        .select(`
          id,
          room_id,
          student_id,
          hostel_id,
          active,
          start_date,
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
      const d = new Date(f.due_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
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
                      {summaryFee.billing_period}
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

                  <div className="flex items-center gap-4">
                    <span className={cn("px-3 py-1.5 rounded-full text-xs font-semibold", getDaysRemainingBadge(summaryFee).className)}>
                      {getDaysRemainingBadge(summaryFee).text}
                    </span>
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
                              <p className="font-semibold text-slate-900">{fee.billing_period}</p>
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
                          {fee.status === 'paid' && (
                            <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                              <CheckCircle2 size={14} /> Verified
                            </span>
                          )}
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
                            <Calendar size={14} />
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
                              <Calendar size={14} />
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
    </div>
  );
}
