'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  X, 
  Calendar, 
  DollarSign, 
  User, 
  Download, 
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/* -------------------------------------------------------------
   1. Mark Deposit Paid Modal
------------------------------------------------------------- */
export function MarkDepositPaidModal({ 
  alloc, 
  ownerUserId: _ownerUserId,
  onClose, 
  onSuccess 
}: { 
  alloc: any; 
  ownerUserId?: string;
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (alloc) {
      // Default deposit to rooms.security_deposit or rent * 2 if not set
      const defaultDeposit = alloc.rooms?.security_deposit || (alloc.rooms?.rent * 2) || 0;
      setAmount(defaultDeposit.toString());
    }
  }, [alloc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alloc) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const depositFee = alloc.student_fees?.find(
        (f: any) => f.billing_period?.toLowerCase().includes('deposit')
      );
      const feeId = depositFee?.id || alloc.id;

      const { error } = await supabase.rpc('mark_payment_paid', {
        p_fee_id: feeId
      });

      if (error) throw error;

      toast.success('Fee marked as paid successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update deposit status');
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
            <h3 className="font-bold text-lg text-foreground font-display">Mark Security Deposit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Confirm security deposit payment details</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</label>
            <div className="text-sm font-semibold p-3 bg-muted/30 border rounded-xl flex items-center gap-2">
              <User size={14} className="text-muted-foreground" />
              {alloc.students?.profiles?.full_name || alloc.student_name || 'Student'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount Paid (₹) <span className="text-red-500">*</span></label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter deposit amount"
                className="w-full h-10 pl-9 pr-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Date <span className="text-red-500">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1 shadow-md shadow-primary/10 transition-colors"
            >
              {loading ? 'Confirming...' : 'Confirm Paid ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   2. Mark Monthly Fee Paid Modal
------------------------------------------------------------- */
export function MarkFeePaidModal({ 
  alloc, 
  initialFeeId,
  ownerUserId,
  onClose, 
  onSuccess 
}: { 
  alloc: any; 
  initialFeeId?: string;
  ownerUserId?: string;
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [selectedFeeId, setSelectedFeeId] = useState(initialFeeId || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter fees to show pending or overdue ones
  const pendingFees = alloc.student_fees?.filter((fee: any) => fee.status === 'pending' || fee.status === 'overdue' || fee.status === 'pending_verification') || [];

  useEffect(() => {
    if (pendingFees.length > 0) {
      const activeFee = initialFeeId 
        ? pendingFees.find((f: any) => f.id === initialFeeId) || pendingFees[0]
        : pendingFees[0];
      setSelectedFeeId(activeFee.id);
      setAmount((activeFee.amount ?? activeFee.amount_due ?? 0).toString());
    }
  }, [alloc, initialFeeId]);

  const handleFeeChange = (feeId: string) => {
    setSelectedFeeId(feeId);
    const fee = pendingFees.find((f: any) => f.id === feeId);
    if (fee) {
      setAmount((fee.amount ?? fee.amount_due ?? 0).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeId) {
      toast.error('Please select a fee to mark paid');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('mark_fee_paid_manual', {
        p_student_fees_id: selectedFeeId,
        p_amount: numericAmount,
        p_payment_method: method,
        p_date: date,
        p_notes: notes.trim() || 'Manual verification by owner',
        p_verified_by: ownerUserId
      });

      if (error) throw error;

      toast.success('Fee marked as PAID successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update fee status');
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
            <h3 className="font-bold text-lg text-foreground font-display">Mark Fee as Paid</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Owner manual verification of student rent/bills</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Month / Due Fee <span className="text-red-500">*</span></label>
            <select
              value={selectedFeeId}
              onChange={(e) => handleFeeChange(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
              required
            >
              {pendingFees.length === 0 ? (
                <option value="">No unpaid fees schedule found</option>
              ) : (
                pendingFees.map((fee: any) => (
                  <option key={fee.id} value={fee.id}>
                    {(fee.billing_period || new Date(fee.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))} - ₹{fee.amount_due || fee.amount || 0} (Due: {new Date(fee.due_date).toLocaleDateString()})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount (₹) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Method <span className="text-red-500">*</span></label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                required
              >
                <option value="upi">UPI ID</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash Payment</option>
                <option value="card">Debit/Credit Card</option>
                <option value="other">Other / Digital Wallet</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Received <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference / Notes</label>
            <textarea
              placeholder="e.g. Transaction Reference or Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card h-16 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || pendingFees.length === 0}
              className="flex-1 h-10 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1 shadow-md shadow-primary/10 transition-colors disabled:opacity-50"
            >
              {loading ? 'Confirming...' : 'Mark Fee Paid ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   3. Payment History Modal
------------------------------------------------------------- */
export function PaymentHistoryModal({ 
  alloc, 
  onClose 
}: { 
  alloc: any; 
  onClose: () => void; 
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch payments for this student
  useEffect(() => {
    const fetchPayments = async () => {
      if (!alloc) return;
      try {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            id,
            amount_paid,
            payment_method,
            reference_number,
            payment_status,
            paid_date,
            notes,
            student_fees_id,
            student_fees (
              due_date
            )
          `)
          .eq('student_id', alloc.student_id)
          .order('paid_date', { ascending: false });

        if (error) throw error;
        
        // Map database fields to UI format
        const formattedPayments = (data ?? []).map((p: any) => {
          const billing_period = p.student_fees?.due_date
            ? new Date(p.student_fees.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : undefined;

          return {
            id: p.id,
            amount_paid: p.amount_paid,
            payment_method: p.payment_method,
            reference_number: p.reference_number,
            payment_status: p.payment_status,
            paid_date: p.paid_date,
            notes: p.notes,
            student_fees_id: p.student_fees_id,
            student_fees: p.student_fees ? {
              ...p.student_fees,
              billing_period
            } : null
          };
        });
        
        setPayments(formattedPayments);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load payments history');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [alloc]);

  const handlePrint = (payment: any) => {
    // Basic printable receipt window
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;

    const studentName = alloc.students?.profiles?.full_name || alloc.student_name || 'Student';
    const hostelName = alloc.hostels?.name || 'HostelHub Accommodation';

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt - ${payment.id}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #333; }
            .receipt-card { border: 1px solid #eaeaea; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
            .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .label { font-weight: 600; color: #666; }
            .value { font-weight: 700; color: #111; }
            .footer { border-top: 1px solid #eaeaea; padding-top: 15px; margin-top: 25px; text-align: center; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="header">
              <div class="title">HostelHub Receipt</div>
              <div style="font-size: 12px; margin-top: 4px; color: #666;">Generated on ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="row">
              <span class="label">Receipt ID:</span>
              <span class="value">${payment.id}</span>
            </div>
            <div class="row">
              <span class="label">Hostel:</span>
              <span class="value">${hostelName}</span>
            </div>
            <div class="row">
              <span class="label">Student Name:</span>
              <span class="value">${studentName}</span>
            </div>
            <div class="row">
              <span class="label">Billing Item:</span>
              <span class="value">${payment.student_fees?.billing_period || 'Security Deposit'}</span>
            </div>
            <div class="row">
              <span class="label">Amount Paid:</span>
              <span class="value" style="color: #16a34a; font-size: 16px;">₹${payment.amount_paid}</span>
            </div>
            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value uppercase">${payment.payment_method.replace('_', ' ')}</span>
            </div>
            <div class="row">
              <span class="label">Reference:</span>
              <span class="value">${payment.reference_number || 'Cash/Manual'}</span>
            </div>
            <div class="row">
              <span class="label">Payment Date:</span>
              <span class="value">${new Date(payment.paid_date).toLocaleDateString()}</span>
            </div>
            <div class="row">
              <span class="label">Status:</span>
              <span class="value" style="color: #16a34a;">${payment.payment_status.toUpperCase()}</span>
            </div>
            <div class="footer">
              Thank you for choosing HostelHub. Keep this copy for records.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h3 className="font-bold text-lg text-foreground font-display">Payment History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payments record for {alloc.students?.profiles?.full_name || alloc.student_name || 'Student'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[450px] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading payment records...</div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
              <AlertCircle size={24} className="text-muted-foreground/60" />
              <p className="font-semibold text-foreground">No payments recorded</p>
              <p className="text-xs">Any rent or deposit payments will show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((pm: any) => (
                <div key={pm.id} className="p-4 border rounded-xl flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">₹{pm.amount_paid}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        pm.payment_status === 'completed'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300'
                          : pm.payment_status === 'pending_verification'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                      }`}>
                        {pm.payment_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Billing: <span className="font-semibold text-foreground">{pm.student_fees?.billing_period || 'Security Deposit'}</span></p>
                      <p>Method: <span className="font-semibold text-foreground uppercase">{pm.payment_method}</span></p>
                      {pm.reference_number && <p>Ref: <span className="font-semibold text-foreground select-all">{pm.reference_number}</span></p>}
                      <p>Date: <span className="font-semibold text-foreground">{new Date(pm.paid_date).toLocaleDateString()}</span></p>
                      {pm.notes && <p>Notes: <span className="italic text-foreground">{pm.notes}</span></p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pm.payment_status === 'completed' && (
                      <button
                        onClick={() => handlePrint(pm)}
                        className="text-xs flex items-center gap-1 bg-primary text-white rounded-lg px-2.5 py-1.5 hover:bg-primary/95 transition font-semibold"
                      >
                        <Download size={12} /> Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-xl text-sm font-semibold hover:bg-muted transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
