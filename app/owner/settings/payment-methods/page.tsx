'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  QrCode, 
  Info,
  ChevronLeft,
  UploadCloud,
  Building,
  Edit2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface PaymentMethod {
  id: string;
  owner_id: string;
  hostel_id: string;
  payment_type: 'upi' | 'bank' | 'qr_code';
  upi_id?: string;
  bank_account?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  qr_code_url?: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  hostels?: {
    name: string;
  };
}

export default function PaymentMethodsPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [activeFormTab, setActiveFormTab] = useState<'upi' | 'bank' | 'qr'>('upi');
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [viewingQrUrl, setViewingQrUrl] = useState<string | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');

  // Fetch owner's hostels
  const { data: hostels, isLoading: hostelsLoading } = useQuery<any[]>({
    queryKey: ['owner-hostels', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hostels')
        .select('id, name')
        .eq('owner_id', user!.id);

      if (error) throw error;
      return data ?? [];
    }
  });

  // Set default selected hostel
  useEffect(() => {
    if (hostels && hostels.length > 0 && !selectedHostelId) {
      setSelectedHostelId(hostels[0].id);
    }
  }, [hostels, selectedHostelId]);

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['owner-payment-methods', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*, hostels(name)')
        .eq('owner_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as any[]) ?? [];
    }
  });

  // Set Primary Mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (methodId: string) => {
      // First, set all owner's payment methods to is_primary = false
      const { error: resetError } = await supabase
        .from('payment_methods')
        .update({ is_primary: false })
        .eq('owner_id', profile!.id);

      if (resetError) throw resetError;

      // Then set the selected to true
      const { error: setError } = await supabase
        .from('payment_methods')
        .update({ is_primary: true })
        .eq('id', methodId);

      if (setError) throw setError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-payment-methods'] });
      toast.success('Primary payment method updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update primary payment method');
    }
  });

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-payment-methods'] });
      toast.success('Payment method status updated');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status');
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-payment-methods'] });
      toast.success('Payment method deleted successfully');
      if (editingMethod) {
        setEditingMethod(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete payment method');
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 bg-zinc-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6 border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/owner/settings" className="hover:text-foreground flex items-center gap-1 transition-colors">
              <ChevronLeft size={14} /> Settings
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Payment Methods</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="text-primary h-8 w-8" /> Payment Methods
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure payment details students will see when making rent and deposit payments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form (Add or Edit) & Read-only Instructions */}
        <div className="lg:col-span-1 space-y-6">
          {editingMethod ? (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                    <Edit2 size={18} className="text-primary" /> Edit Payment Method
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Modify details for your saved method.</p>
                </div>
                <button
                  onClick={() => setEditingMethod(null)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold border rounded-lg px-2.5 py-1 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <EditMethodForm
                method={editingMethod}
                ownerId={profile?.id}
                onSuccess={() => {
                  setEditingMethod(null);
                  qc.invalidateQueries({ queryKey: ['owner-payment-methods'] });
                }}
              />
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                  <Plus size={18} className="text-primary" /> Add New Method
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Configure UPI, Bank accounts, or custom QR codes.</p>
              </div>

              {/* Hostel Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Link to Hostel <span className="text-red-500">*</span></label>
                <select
                  value={selectedHostelId}
                  onChange={(e) => setSelectedHostelId(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {hostelsLoading ? (
                    <option>Loading hostels...</option>
                  ) : hostels && hostels.length > 0 ? (
                    hostels.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))
                  ) : (
                    <option value="">No hostels found. Create a hostel first.</option>
                  )}
                </select>
              </div>

              {/* Form Tabs */}
              <div className="flex border-b border-border gap-2">
                <button
                  onClick={() => setActiveFormTab('upi')}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${
                    activeFormTab === 'upi'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  UPI ID
                </button>
                <button
                  onClick={() => setActiveFormTab('bank')}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${
                    activeFormTab === 'bank'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bank A/C
                </button>
                <button
                  onClick={() => setActiveFormTab('qr')}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${
                    activeFormTab === 'qr'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  QR Code
                </button>
              </div>

              {/* Forms */}
              {!selectedHostelId ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-center space-y-2">
                  <AlertCircle className="mx-auto text-amber-500" size={24} />
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Please select a hostel first</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">You must select a hostel before adding payment details.</p>
                </div>
              ) : (
                <>
                  {activeFormTab === 'upi' && <AddUPIForm ownerId={profile?.id} hostelId={selectedHostelId} onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-payment-methods'] })} />}
                  {activeFormTab === 'bank' && <AddBankDetailsForm ownerId={profile?.id} hostelId={selectedHostelId} onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-payment-methods'] })} />}
                  {activeFormTab === 'qr' && <AddQRCodeForm ownerId={profile?.id} hostelId={selectedHostelId} onSuccess={() => qc.invalidateQueries({ queryKey: ['owner-payment-methods'] })} />}
                </>
              )}
            </div>
          )}

          {/* Payment Instructions (Read-Only) */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-zinc-500">
              <HelpCircle size={16} className="text-primary" /> How Students Pay
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">1</span>
                <p>Students access their <strong>Fees & Billing</strong> dashboard to check due rents or safety deposits.</p>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
                <p>They view your <strong>Primary Payment Method</strong> details (or scan your QR code) to execute the transfer.</p>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">3</span>
                <p>Students upload their <strong>Receipt Screenshot</strong> and enter the <strong>Amount Paid + Reference ID</strong>.</p>
              </div>
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">4</span>
                <p>HostelHub matches amounts and enables <strong>Auto-verification</strong> to instantly clear matched transactions.</p>
              </div>
            </div>
            <div className="pt-2 border-t text-[11px] text-amber-600 flex gap-1.5 items-start">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Make sure to set at least one method as <strong>Primary</strong> so students can view it by default.</span>
            </div>
          </div>
        </div>

        {/* Right Column: List Saved Methods */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b pb-4 border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-foreground">Saved Payment Methods</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage which payment methods are available to students.</p>
              </div>
              <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full">
                {paymentMethods?.length || 0} methods
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading payment methods...</div>
            ) : !paymentMethods || paymentMethods.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <Info className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="font-semibold text-foreground">No payment methods configured</p>
                  <p className="text-xs mt-1">Please add a UPI ID or Bank account detail to start receiving rents.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`p-4 rounded-xl border transition-all ${
                      method.is_primary
                        ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-border bg-card hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-bold border border-zinc-200 dark:border-zinc-805">
                          {method.payment_type === 'upi' && <span className="text-[10px] text-primary font-extrabold uppercase">UPI</span>}
                          {method.payment_type === 'bank' && <Building size={18} className="text-primary" />}
                          {method.payment_type === 'qr_code' && <QrCode size={18} className="text-primary" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground">
                              {method.payment_type === 'upi' && 'UPI Payment'}
                              {method.payment_type === 'bank' && 'Bank Transfer Details'}
                              {method.payment_type === 'qr_code' && 'QR Code Scanner'}
                            </h3>
                            {method.is_primary && (
                              <span className="bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Primary
                              </span>
                            )}
                            {!method.is_active && (
                              <span className="bg-muted text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border">
                                Inactive
                              </span>
                            )}
                          </div>
                          {method.hostels?.name && (
                            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Linked Hostel: {method.hostels.name}</p>
                          )}

                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            {method.payment_type === 'upi' && (
                              <p>UPI ID: <span className="font-semibold text-foreground select-all font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{method.upi_id}</span></p>
                            )}
                            {method.payment_type === 'bank' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 bg-zinc-50/50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/80">
                                <p>Holder: <span className="font-semibold text-foreground">{method.account_holder_name}</span></p>
                                <p>A/C No: <span className="font-semibold text-foreground select-all font-mono">{method.bank_account}</span></p>
                                <p>IFSC: <span className="font-semibold text-foreground select-all font-mono uppercase">{method.ifsc_code}</span></p>
                              </div>
                            )}
                            {method.payment_type === 'qr_code' && (
                              <div className="flex items-center gap-3">
                                <div>
                                  <p>Status: <span className="font-semibold text-foreground">Scan QR to Transfer</span></p>
                                </div>
                                {method.qr_code_url && (
                                  <button
                                    onClick={() => setViewingQrUrl(method.qr_code_url ?? null)}
                                    className="flex h-12 w-12 items-center justify-center border rounded-lg bg-white overflow-hidden hover:ring-2 hover:ring-primary transition-all shadow-sm shrink-0"
                                    title="View QR Code"
                                  >
                                    <img src={method.qr_code_url} alt="QR" className="h-full w-full object-contain" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5">
                          {!method.is_primary && method.is_active && (
                            <button
                              onClick={() => setPrimaryMutation.mutate(method.id)}
                              className="text-xs text-primary hover:underline font-bold px-2 py-1"
                              disabled={setPrimaryMutation.isPending}
                            >
                              Make Primary
                            </button>
                          )}
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: method.id, active: !method.is_active })}
                            className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-805 text-foreground font-semibold px-2.5 py-1 rounded-lg border border-border transition-colors bg-card"
                          >
                            {method.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setEditingMethod(method)}
                            className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-805 text-foreground font-semibold p-1.5 rounded-lg border border-border transition-colors bg-card"
                            title="Edit Details"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this payment method?')) {
                                deleteMutation.mutate(method.id);
                              }
                            }}
                            className="text-xs hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 font-semibold p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          Added {new Date(method.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Lightbox Modal */}
      {viewingQrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setViewingQrUrl(null)}>
          <div className="bg-white p-4 rounded-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-zinc-900 text-sm">QR Code Preview</h3>
              <button onClick={() => setViewingQrUrl(null)} className="text-zinc-400 hover:text-zinc-950 font-bold text-xs border rounded-md px-2 py-0.5">Close</button>
            </div>
            <div className="aspect-square w-full max-w-[280px] mx-auto border rounded-xl overflow-hidden bg-zinc-50 flex items-center justify-center p-2 shadow-inner">
              <img src={viewingQrUrl} alt="QR Code Large" className="w-full h-full object-contain" />
            </div>
            <p className="text-[10px] text-center text-zinc-500">Scan this QR code using any UPI App (GPay, PhonePe, Paytm, etc.) to complete payment.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- SUB-FORMS FOR ADDING ---------------- */

// 1. UPI ID Form
interface AddFormProps {
  ownerId: string | undefined;
  hostelId: string;
  onSuccess: () => void;
}

function AddUPIForm({ ownerId, hostelId, onSuccess }: AddFormProps) {
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Add validation BEFORE submit
    if (!hostelId) {
      toast.error('Please select a hostel');
      return;
    }
    if (!ownerId) {
      toast.error('Owner ID missing');
      return;
    }

    const trimmedUPI = upiId.trim();
    if (!trimmedUPI) {
      toast.error('UPI ID is required');
      return;
    }

    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(trimmedUPI)) {
      toast.error('Invalid UPI ID format (must be like name@bank)');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          owner_id: ownerId,      // REQUIRED
          hostel_id: hostelId,    // REQUIRED - MUST NOT BE NULL
          payment_type: 'upi',    // REQUIRED
          upi_id: trimmedUPI,
          is_primary: false,
          is_active: true
        });

      if (error) {
        console.error('Save error:', error.code, error.message);
        if (error.code === '23502') {
          toast.error('Missing required field');
        } else if (error.code === '23503') {
          toast.error('Invalid hostel selected');
        } else {
          toast.error(error.message || 'An error occurred');
        }
        return;
      }

      toast.success('UPI details added successfully!');
      setUpiId('');
      onSuccess();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error('Save error:', err.code || 'UNKNOWN', err.message || err);
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">UPI ID <span className="text-red-500">*</span></label>
        <input
          type="text"
          placeholder="e.g. 9876543210@upi"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors"
      >
        {loading ? 'Saving...' : 'Save UPI Method'}
      </button>
    </form>
  );
}

// 2. Bank Details Form
function AddBankDetailsForm({ ownerId, hostelId, onSuccess }: AddFormProps) {
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Add validation BEFORE submit
    if (!hostelId) {
      toast.error('Please select a hostel');
      return;
    }
    if (!ownerId) {
      toast.error('Owner ID missing');
      return;
    }

    const holder = accountHolder.trim();
    const acNum = accountNumber.trim();
    const ifsc = ifscCode.trim().toUpperCase();

    if (!holder) {
      toast.error('Account holder name is required');
      return;
    }
    if (!acNum) {
      toast.error('Account number is required');
      return;
    }
    if (!ifsc) {
      toast.error('IFSC Code is required');
      return;
    }

    if (!/^\d{9,18}$/.test(acNum)) {
      toast.error('Bank account number must be between 9 and 18 digits');
      return;
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      toast.error('Invalid IFSC Code (e.g. HDFC0000123)');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          owner_id: ownerId,
          hostel_id: hostelId,
          payment_type: 'bank',
          bank_account: acNum,
          ifsc_code: ifsc,
          account_holder_name: holder,
          is_primary: false,
          is_active: true
        });

      if (error) {
        console.error('Save error:', error.code, error.message);
        if (error.code === '23502') {
          toast.error('Missing required field');
        } else if (error.code === '23503') {
          toast.error('Invalid hostel selected');
        } else {
          toast.error(error.message || 'An error occurred');
        }
        return;
      }

      toast.success('Bank details added successfully!');
      setAccountHolder('');
      setAccountNumber('');
      setIfscCode('');
      onSuccess();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error('Save error:', err.code || 'UNKNOWN', err.message || err);
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Holder Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          placeholder="e.g. John Doe"
          value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Number <span className="text-red-500">*</span></label>
        <input
          type="text"
          placeholder="e.g. 123456789012"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">IFSC Code <span className="text-red-500">*</span></label>
        <input
          type="text"
          placeholder="e.g. HDFC0000123"
          value={ifscCode}
          onChange={(e) => setIfscCode(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-card uppercase"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors"
      >
        {loading ? 'Saving...' : 'Save Bank Account'}
      </button>
    </form>
  );
}

// 3. QR Code Form
function AddQRCodeForm({ ownerId, hostelId, onSuccess }: AddFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB');
        return;
      }
      if (!selectedFile.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG/JPG)');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Add validation BEFORE submit
    if (!hostelId) {
      toast.error('Please select a hostel');
      return;
    }
    if (!ownerId) {
      toast.error('Owner ID missing');
      return;
    }

    if (!file) {
      toast.error('Please upload a QR Code image');
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${ownerId}_qr_${Date.now()}.${fileExt}`;
      const filePath = `qrcodes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-methods')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.error('QR Upload error:', uploadError);
        toast.error('Failed to upload QR Code image');
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-methods')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('payment_methods')
        .insert({
          owner_id: ownerId,
          hostel_id: hostelId,
          payment_type: 'qr_code',
          qr_code_url: publicUrl,
          is_primary: false,
          is_active: true
        });

      if (error) {
        console.error('Save error:', error.code, error.message);
        if (error.code === '23502') {
          toast.error('Missing required field');
        } else if (error.code === '23503') {
          toast.error('Invalid hostel selected');
        } else {
          toast.error(error.message || 'An error occurred');
        }
        return;
      }

      toast.success('QR Code payment details added!');
      setFile(null);
      setPreview(null);
      onSuccess();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error('Save error:', err.code || 'UNKNOWN', err.message || err);
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {/* File Upload Zone */}
      <div className="space-y-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Upload QR Code Screenshot <span className="text-red-500">*</span></label>
        <div className="flex flex-col items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 hover:bg-zinc-55/40 transition cursor-pointer relative min-h-[120px]">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            required={!preview}
          />
          {preview ? (
            <div className="flex flex-col items-center space-y-2">
              <img src={preview} alt="QR Preview" className="h-20 w-20 object-contain rounded border bg-white" />
              <span className="text-[10px] text-muted-foreground">Click to replace QR image</span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1.5 py-1">
              <UploadCloud size={24} className="text-muted-foreground" />
              <span className="text-[11px] font-bold text-foreground">Choose File or Drag QR</span>
              <span className="text-[9px] text-muted-foreground">PNG, JPG up to 5MB</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors"
      >
        {loading ? 'Uploading...' : 'Save QR Method'}
      </button>
    </form>
  );
}

/* ---------------- EDIT PAYMENT METHOD FORM ---------------- */

function EditMethodForm({ method, ownerId, onSuccess }: { method: PaymentMethod; ownerId: string | undefined; onSuccess: () => void }) {
  // UPI states
  const [upiId, setUpiId] = useState(method.upi_id || '');

  // Bank states
  const [accountHolder, setAccountHolder] = useState(method.account_holder_name || '');
  const [accountNumber, setAccountNumber] = useState(method.bank_account || '');
  const [ifscCode, setIfscCode] = useState(method.ifsc_code || '');

  // QR Code states
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(method.qr_code_url || null);

  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File size must be under 5MB');
        return;
      }
      if (!selectedFile.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG/JPG)');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) {
      toast.error('Owner ID missing');
      return;
    }
    if (!method.hostel_id) {
      toast.error('Hostel ID missing');
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (method.payment_type === 'upi') {
        const trimmedUPI = upiId.trim();
        if (!trimmedUPI) {
          toast.error('UPI ID is required');
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(trimmedUPI)) {
          toast.error('Invalid UPI ID format');
          setLoading(false);
          return;
        }
        updates.upi_id = trimmedUPI;
      }

      else if (method.payment_type === 'bank') {
        const holder = accountHolder.trim();
        const acNum = accountNumber.trim();
        const ifsc = ifscCode.trim().toUpperCase();

        if (!holder) {
          toast.error('Account holder name is required');
          setLoading(false);
          return;
        }
        if (!acNum) {
          toast.error('Account number is required');
          setLoading(false);
          return;
        }
        if (!ifsc) {
          toast.error('IFSC Code is required');
          setLoading(false);
          return;
        }

        if (!/^\d{9,18}$/.test(acNum)) {
          toast.error('Account number must be 9 to 18 digits');
          setLoading(false);
          return;
        }

        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
          toast.error('Invalid IFSC Code');
          setLoading(false);
          return;
        }

        updates.account_holder_name = holder;
        updates.bank_account = acNum;
        updates.ifsc_code = ifsc;
      }

      else if (method.payment_type === 'qr_code') {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${ownerId}_qr_${Date.now()}.${fileExt}`;
          const filePath = `qrcodes/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('payment-methods')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

          if (uploadError) {
            console.error('QR Upload error:', uploadError);
            toast.error('Failed to upload QR Code image');
            setLoading(false);
            return;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('payment-methods')
            .getPublicUrl(filePath);

          updates.qr_code_url = publicUrl;
        }
      }

      const { error } = await supabase
        .from('payment_methods')
        .update(updates)
        .eq('id', method.id);

      if (error) {
        console.error('Save error:', error.code, error.message);
        if (error.code === '23502') {
          toast.error('Missing required field');
        } else if (error.code === '23503') {
          toast.error('Invalid hostel selected');
        } else {
          toast.error(error.message || 'Update failed');
        }
        return;
      }

      toast.success('Payment method updated successfully!');
      onSuccess();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error('Save error:', err.code || 'UNKNOWN', err.message || err);
      toast.error(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {method.payment_type === 'upi' && (
        <>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">UPI ID <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:ring-1 focus:ring-primary"
              required
            />
          </div>
        </>
      )}

      {method.payment_type === 'bank' && (
        <>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Holder Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account Number <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">IFSC Code <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
              className="w-full h-9 px-3 border border-border rounded-lg text-xs bg-card focus:ring-1 focus:ring-primary uppercase"
              required
            />
          </div>
        </>
      )}

      {method.payment_type === 'qr_code' && (
        <>
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">QR Code Screenshot</label>
            <div className="flex flex-col items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 hover:bg-zinc-55/40 transition cursor-pointer relative min-h-[100px]">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              {preview ? (
                <div className="flex flex-col items-center space-y-2">
                  <img src={preview} alt="QR Preview" className="h-16 w-16 object-contain rounded border bg-white" />
                  <span className="text-[10px] text-muted-foreground">Click to upload new image to replace</span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-1.5">
                  <UploadCloud size={20} className="text-muted-foreground" />
                  <span className="text-[11px] font-bold text-foreground">Change QR Code Image</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors"
      >
        {loading ? 'Updating...' : 'Save Changes'}
      </button>
    </form>
  );
}
