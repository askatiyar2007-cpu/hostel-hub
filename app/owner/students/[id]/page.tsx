'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Building2, 
  Calendar, AlertTriangle, FileText, QrCode, 
  DollarSign, Activity, Settings, UserCheck, GraduationCap, X
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PaymentHistoryModal } from '../../requests/payment-modals';

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const allocationId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [allocation, setAllocation] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [latestRequest, setLatestRequest] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [electricityBills, setElectricityBills] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  // Modal states
  const [showAgreement, setShowAgreement] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!user?.id || !allocationId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Room Allocation
      const { data: allocData, error: allocErr } = await supabase
        .from('room_allocations')
        .select('*, rooms(*), hostels(*)')
        .eq('id', allocationId)
        .single();

      if (allocErr) throw allocErr;
      if (!allocData) throw new Error('Room allocation not found');
      
      // Safety check: ensure current owner owns this hostel
      if (allocData.hostels?.owner_id !== user.id) {
        throw new Error('You do not have permission to view this resident profile.');
      }
      setAllocation(allocData);

      // 2. Fetch Student record & Profile
      const { data: studentData, error: studentErr } = await supabase
        .from('students')
        .select('*, profiles(*)')
        .eq('id', allocData.student_id)
        .single();

      if (studentErr) throw studentErr;
      setStudent(studentData);

      // 3. Fetch latest approved room request
      const { data: reqData } = await supabase
        .from('room_requests')
        .select('*')
        .eq('student_id', allocData.student_id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestRequest(reqData);

      // 4. Fetch Student Fees
      const { data: feesData } = await supabase
        .from('student_fees')
        .select('*')
        .eq('allocation_id', allocationId)
        .order('due_date', { ascending: false });
      setFees(feesData || []);

      // 5. Fetch Electricity Bills
      if (studentData?.profiles?.user_id) {
        const { data: billsData } = await supabase
          .from('bills')
          .select('*')
          .eq('student_id', studentData.profiles.user_id)
          .eq('bill_type', 'electricity');
        setElectricityBills(billsData || []);

        // 6. Fetch Student Complaints
        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*')
          .eq('student_id', studentData.profiles.user_id)
          .order('created_at', { ascending: false });
        setComplaints(complaintsData || []);
      }
    } catch (err: any) {
      console.error('Error loading profile data:', err);
      setError(err.message || 'An error occurred while fetching student details.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, allocationId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleCheckout = async () => {
    if (!window.confirm('Are you sure you want to check out this student? This will deactivate their room allocation immediately.')) return;
    setCheckoutLoading(true);
    try {
      const { error: checkoutErr } = await supabase.rpc('checkout_student', { p_alloc_id: allocationId });
      if (checkoutErr) throw checkoutErr;
      toast.success('Student checked out successfully!');
      router.push('/owner/students');
    } catch (err: any) {
      console.error('Error checking out student:', err);
      toast.error(err.message || 'Failed to check out student');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Calculations for Financial Card
  const monthlyRent = allocation?.rooms?.rent || 0;
  const securityDeposit = allocation?.rooms?.security_deposit || (monthlyRent * 2);
  const depositStatus = allocation?.deposit_status || 'pending';
  
  // Outstanding Balance: sum of all unpaid student fees
  const outstandingBalance = fees
    .filter(f => f.status === 'pending' || f.status === 'overdue')
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);

  // Current Month Fee
  const currentMonthFee = fees.length > 0 ? Number(fees[0].amount || 0) : monthlyRent;

  // Electricity Charges (unpaid electricity bills)
  const electricityCharges = electricityBills
    .filter(b => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  // Helper for displaying fields
  const renderProfileField = (label: string, value: any, icon?: React.ReactNode) => {
    if (value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-') return null;
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/10 border border-border/40">
        {icon && <span className="mt-0.5 text-primary shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">{label}</span>
          <p className="text-foreground font-semibold text-sm mt-0.5 leading-tight">{value}</p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardShell title="Resident Profile" subtitle="Loading profile..." badge="Owner">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">Loading student database...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !allocation || !student) {
    return (
      <DashboardShell title="Resident Profile" subtitle="Error loading profile" badge="Owner">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-500 max-w-md text-center">
            <AlertTriangle size={40} />
            <p className="text-sm font-semibold">Error: {error || 'Student profile not found'}</p>
            <Button onClick={() => router.push('/owner/students')} variant="outline" className="mt-2">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Students
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const profile = student.profiles;
  const studentName = profile?.full_name || allocation.student_name || 'N/A';
  const studentEmail = profile?.email || allocation.student_email || 'N/A';
  const studentPhone = profile?.phone_number || allocation.student_phone || 'N/A';
  
  const dobFormatted = profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  const parentName = latestRequest?.parent_name || student?.parent_name;
  const parentPhone = latestRequest?.parent_phone || student?.parent_phone;
  const parentEmail = latestRequest?.parent_email || student?.parent_email;
  const address = latestRequest?.address || student?.address;
  const emergencyContact = latestRequest?.emergency_contact || (latestRequest?.emergency_contact_name && latestRequest?.emergency_contact_phone ? `${latestRequest?.emergency_contact_name} - ${latestRequest?.emergency_contact_phone}` : latestRequest?.emergency_contact_name);

  return (
    <DashboardShell 
      title="Resident Profile" 
      subtitle={`Detailed resident ledger and profile card for ${studentName}.`} 
      badge="Owner"
    >
      {/* Back to list button */}
      <div className="mb-6">
        <Button 
          onClick={() => router.push('/owner/students')} 
          variant="ghost" 
          className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-xl border p-3 hover:bg-muted"
        >
          <ArrowLeft size={14} />
          Back to Residents List
        </Button>
      </div>

      {/* 1. Profile Header Row */}
      <div className="bg-card border border-border p-6 rounded-3xl shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={studentName} 
              className="h-20 w-20 rounded-full object-cover border-2 border-primary shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-3xl shadow-sm">
              {studentName?.[0]?.toUpperCase()}
            </div>
          )}
          
          <div className="text-center md:text-left space-y-1">
            <div className="flex flex-col md:flex-row items-center gap-2">
              <h2 className="text-2xl font-bold font-display text-foreground">{studentName}</h2>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none capitalize text-xs">
                {allocation.active ? 'Active Resident' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-muted-foreground flex items-center justify-center md:justify-start gap-1">
              <Building2 size={14} />
              {allocation.hostels?.name} &bull; Room {allocation.rooms?.room_number} &bull; {allocation.booking_type === 'entire_room' ? 'Private' : 'Shared Bed'}
            </p>
            <p className="text-xs text-muted-foreground">
              Checked in on {new Date(allocation.start_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Ledger Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Demographic Cards (Col span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Personal Information */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2 border-b pb-3">
              <User className="text-primary h-5 w-5" /> Personal Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderProfileField("Full Name", studentName, <User size={14} />)}
              {renderProfileField("Email Address", studentEmail, <Mail size={14} />)}
              {renderProfileField("Phone Number", studentPhone, <Phone size={14} />)}
              {renderProfileField("Gender", profile?.gender, <Activity size={14} />)}
              {renderProfileField("Date of Birth", dobFormatted, <Calendar size={14} />)}
              {renderProfileField("College / Institution", student?.college || student?.institution, <GraduationCap size={14} />)}
              {renderProfileField("Course", student?.course || student?.education_level, <FileText size={14} />)}
              {renderProfileField("Year / Level", student?.year, <Calendar size={14} />)}
              
              <div className="sm:col-span-2">
                {renderProfileField("Permanent Address", address, <MapPin size={14} />)}
              </div>
            </div>
          </section>

          {/* Guardian Information */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2 border-b pb-3">
              <UserCheck className="text-primary h-5 w-5" /> Guardian & Emergency Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderProfileField("Guardian Name", parentName, <User size={14} />)}
              {renderProfileField("Guardian Phone", parentPhone, <Phone size={14} />)}
              {renderProfileField("Guardian Email", parentEmail, <Mail size={14} />)}
              {renderProfileField("Emergency Contact", emergencyContact, <Phone size={14} />)}
            </div>
          </section>

        </div>

        {/* Right Side: Ledger & Actions Cards (Col span 1) */}
        <div className="space-y-6">
          
          {/* Financial Summary Ledger */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2 border-b pb-3">
              <DollarSign className="text-primary h-5 w-5" /> Financial Information
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground font-semibold">Monthly Rent:</span>
                <span className="font-bold text-foreground">₹{Number(monthlyRent).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground font-semibold">Security Deposit:</span>
                <span className="font-bold text-foreground">₹{Number(securityDeposit).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 items-center">
                <span className="text-muted-foreground font-semibold">Deposit Status:</span>
                {depositStatus === 'paid' ? (
                  <Badge className="bg-green-50 text-green-700 hover:bg-green-50 border-none font-bold">✓ Paid</Badge>
                ) : (
                  <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-none font-bold">📋 Pending</Badge>
                )}
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground font-semibold">Current Month Rent:</span>
                <span className="font-bold text-foreground">₹{Number(currentMonthFee).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground font-semibold">Electricity Charges:</span>
                <span className="font-bold text-foreground">₹{Number(electricityCharges).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground font-bold text-base">Outstanding Balance:</span>
                <span className={`font-bold text-base ${outstandingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  ₹{outstandingBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* Quick Actions Ledger */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2 border-b pb-3">
              <Settings className="text-primary h-5 w-5" /> Actions
            </h3>

            <div className="flex flex-col gap-2.5">
              <Button 
                onClick={() => setShowAgreement(true)}
                variant="outline" 
                className="w-full justify-start rounded-xl font-semibold gap-2 py-5"
              >
                <FileText size={16} className="text-primary" /> View Agreement Contract
              </Button>
              
              <Button 
                onClick={() => setShowQrCode(true)}
                variant="outline" 
                className="w-full justify-start rounded-xl font-semibold gap-2 py-5"
              >
                <QrCode size={16} className="text-primary" /> Show Payment QR Code
              </Button>

              <Button 
                onClick={() => setShowPaymentHistory(true)}
                variant="outline" 
                className="w-full justify-start rounded-xl font-semibold gap-2 py-5"
              >
                <DollarSign size={16} className="text-primary" /> View Payment History
              </Button>

              <Button 
                onClick={() => setShowComplaints(true)}
                variant="outline" 
                className="w-full justify-start rounded-xl font-semibold gap-2 py-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-primary" /> Resident Complaints
                </div>
                {complaints.length > 0 && (
                  <span className="bg-orange-500 text-white rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {complaints.filter(c => c.status !== 'resolved' && c.status !== 'closed').length}
                  </span>
                )}
              </Button>

              <Button 
                onClick={handleCheckout}
                disabled={checkoutLoading}
                variant="outline" 
                className="w-full justify-start rounded-xl font-bold gap-2 py-5 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <X size={16} /> Checkout Student
              </Button>
            </div>
          </section>

        </div>

      </div>

      {/* Modals Implementations */}

      {/* 1. Rental Agreement Modal */}
      {showAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-base font-bold text-foreground font-display flex items-center gap-1.5">
                <FileText size={16} className="text-primary" /> Rental Accommodation Agreement
              </h3>
              <button onClick={() => setShowAgreement(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 border border-border/80 bg-zinc-50 dark:bg-zinc-950/20 rounded-2xl text-xs space-y-4 font-mono leading-relaxed">
              <p className="font-bold text-center underline text-sm">HOSTEL BOARDING CONTRACT</p>
              <p>
                <strong>BETWEEN:</strong> The Hostel Management Owner, herein referred to as the Landlord, and 
                <strong> {studentName}</strong>, herein referred to as the Boarding Tenant.
              </p>
              <p>
                <strong>1. PREMISES:</strong> The Landlord agrees to allocate shared room quarters within Room <strong>{allocation.rooms?.room_number}</strong> at hostel project <strong>{allocation.hostels?.name}</strong>.
              </p>
              <p>
                <strong>2. TERM:</strong> The contract term starts on date <strong>{new Date(allocation.start_date).toLocaleDateString()}</strong> and terminates upon tenant checking out via the official landlord requests console.
              </p>
              <p>
                <strong>3. RENT & SECURITY:</strong> Tenant agrees to pay the monthly rental sum of <strong>₹{Number(monthlyRent).toLocaleString()}</strong>. A security deposit equaling one month rent is due prior to final occupancy.
              </p>
              <p>
                <strong>4. RULES:</strong> Tenant agrees to comply with the curfew, cleanliness parameters, and structural rules of the boarding hostel.
              </p>
              <div className="pt-6 border-t flex justify-between gap-6 flex-wrap">
                <div className="border-t border-zinc-400 pt-1 w-32 text-center text-[10px]">Landlord Signature</div>
                <div className="border-t border-zinc-400 pt-1 w-32 text-center text-[10px]">Tenant Signature</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast.success('Agreement copy downloaded!')} className="flex-1 rounded-xl gap-1">
                <FileText size={14} /> Download PDF
              </Button>
              <Button onClick={() => setShowAgreement(false)} className="flex-1 rounded-xl">
                Close Agreement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. QR Code Modal */}
      {showQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl text-center space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-foreground font-display flex items-center gap-1.5">
                <QrCode size={16} className="text-primary" /> Digital Check-In QR
              </h3>
              <button onClick={() => setShowQrCode(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl inline-flex items-center justify-center border border-zinc-200 shadow-inner">
              <svg className="h-44 w-44 text-zinc-900" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="none" />
                <rect x="10" y="10" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
                <rect x="65" y="10" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
                <rect x="10" y="65" width="25" height="25" stroke="currentColor" strokeWidth="4" fill="none" />
                <rect x="15" y="15" width="15" height="15" fill="currentColor" />
                <rect x="70" y="15" width="15" height="15" fill="currentColor" />
                <rect x="15" y="70" width="15" height="15" fill="currentColor" />
                <rect x="45" y="10" width="10" height="10" fill="currentColor" />
                <rect x="45" y="25" width="5" height="20" fill="currentColor" />
                <rect x="10" y="45" width="15" height="5" fill="currentColor" />
                <rect x="30" y="45" width="20" height="15" fill="currentColor" />
                <rect x="55" y="65" width="30" height="10" fill="currentColor" />
                <rect x="65" y="45" width="15" height="15" fill="currentColor" />
                <rect x="85" y="80" width="10" height="15" fill="currentColor" />
              </svg>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">{studentName}</p>
              <p className="text-xs text-muted-foreground">Allocation ID: {allocation.id.substring(0, 8)}...</p>
            </div>

            <Button onClick={() => setShowQrCode(false)} className="w-full rounded-xl">
              Close QR
            </Button>
          </div>
        </div>
      )}

      {/* 3. Payment History Modal */}
      {showPaymentHistory && (
        <PaymentHistoryModal 
          alloc={{
            ...allocation,
            students: {
              id: allocation.student_id,
              profiles: {
                full_name: studentName
              }
            },
            payments: (fees || []).flatMap(f => f.payments || [])
          }}
          onClose={() => setShowPaymentHistory(false)}
        />
      )}

      {/* 4. Complaints Modal */}
      {showComplaints && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-base font-bold text-foreground font-display flex items-center gap-1.5">
                <Activity size={16} className="text-primary" /> Resident Complaints History
              </h3>
              <button onClick={() => setShowComplaints(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {complaints.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic text-sm">
                  No complaints submitted by this resident.
                </div>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="p-4 border border-border rounded-2xl bg-muted/20 space-y-2 text-sm">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <span className="font-bold text-foreground block">{c.title}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">Category: {c.category} &bull; Filed: {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border-none tracking-wide ${
                          c.priority === 1 ? 'bg-red-100 text-red-700' :
                          c.priority === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {c.priority === 1 ? 'High' : c.priority === 2 ? 'Medium' : 'Low'} Priority
                        </Badge>
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border-none tracking-wide ${
                          c.status === 'resolved' || c.status === 'closed' ? 'bg-green-100 text-green-700' :
                          c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                          'bg-zinc-100 text-zinc-700'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap pt-1.5 border-t border-dashed">
                      {c.description || 'No description provided.'}
                    </p>
                  </div>
                ))
              )}
            </div>

            <Button onClick={() => setShowComplaints(false)} className="w-full rounded-xl">
              Close Complaints
            </Button>
          </div>
        </div>
      )}

    </DashboardShell>
  );
}
