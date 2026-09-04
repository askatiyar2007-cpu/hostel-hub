/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  User, Lock, Bell, ShieldCheck, FileText, LogOut, 
  Building2, Calendar, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';

export default function StudentSettingsPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Preference states
  const [emailNotif, setEmailNotif] = useState(true);
  const [announceNotif, setAnnounceNotif] = useState(true);
  const [payRemind, setPayRemind] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load preferences from user metadata
  useEffect(() => {
    if (user?.user_metadata) {
      setEmailNotif(user.user_metadata.email_notifications !== false);
      setAnnounceNotif(user.user_metadata.announcements_notifications !== false);
      setPayRemind(user.user_metadata.payment_reminders !== false);
    }
  }, [user]);

  // Fetch student record
  const { data: studentRecord } = useQuery({
    queryKey: ['student-record', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const studentId = studentRecord?.id;

  // Fetch active allocation
  const { data: allocation } = useQuery({
    queryKey: ['allocation', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_allocations')
        .select('*, rooms(*), hostels(*)')
        .eq('student_id', studentId!)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Fetch latest approved request for profile snapshot (address, parent details, etc.)
  const { data: latestRequest } = useQuery({
    queryKey: ['latest-approved-request', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_requests')
        .select('*')
        .eq('student_id', studentId!)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Save Preferences Mutation
  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          email_notifications: emailNotif,
          announcements_notifications: announceNotif,
          payment_reminders: payRemind
        }
      });
      if (error) throw error;
      toast.success('Preferences saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Change Password Mutation
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setVerifyingPassword(true);
    try {
      // Verify old password by signing in again
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: oldPassword
      });

      if (signInErr) {
        throw new Error('Verification of old password failed. Please check your credentials.');
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) throw updateErr;

      toast.success('Password updated successfully!');
      setIsPasswordModalOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Password update failed.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleDownloadDoc = (docName: string) => {
    toast.success(`Generating and downloading ${docName}...`);
  };

  return (
    <DashboardShell title="Settings" subtitle="Manage your account settings, preferences and documents." badge="Student">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Navigation Links & Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Profile Details (Read Only) */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <User className="text-primary h-5 w-5" /> My Profile
              </h3>
              <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">Read-Only</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Full Name</Label>
                <Input disabled value={profile?.full_name || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Email Address</Label>
                <Input disabled value={profile?.email || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Phone Number</Label>
                <Input disabled value={profile?.phone_number || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Parent/Guardian Name</Label>
                <Input disabled value={latestRequest?.parent_name || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Parent Phone</Label>
                <Input disabled value={latestRequest?.parent_phone || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Parent Email</Label>
                <Input disabled value={latestRequest?.parent_email || 'N/A'} className="mt-1 bg-muted/40 cursor-not-allowed" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Address</Label>
                <textarea 
                  disabled 
                  value={latestRequest?.address || 'N/A'} 
                  rows={2}
                  className="mt-1 flex w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm shadow-sm cursor-not-allowed focus-visible:outline-none disabled:opacity-80" 
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/20 p-3 rounded-xl border border-border/50 mt-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
              <span>Cannot edit details - Linked directly to your active room request/allocation.</span>
            </p>
          </section>

          {/* Section 2: Preferences (Editable) */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <Bell className="text-primary h-5 w-5" /> Preferences
              </h3>
            </div>

            <div className="space-y-4">
              {/* Toggle 1 */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-foreground block">Email Notifications</span>
                  <span className="text-xs text-muted-foreground">Receive payment receipts and invoice updates via email.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={emailNotif}
                  onChange={(e) => setEmailNotif(e.target.checked)}
                  className="h-5 w-10 appearance-none bg-muted rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-primary before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-5.5 border border-border"
                />
              </div>

              {/* Toggle 2 */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-foreground block">Hostel Announcements</span>
                  <span className="text-xs text-muted-foreground">Receive push notifications for notices published by the owner.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={announceNotif}
                  onChange={(e) => setAnnounceNotif(e.target.checked)}
                  className="h-5 w-10 appearance-none bg-muted rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-primary before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-5.5 border border-border"
                />
              </div>

              {/* Toggle 3 */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border">
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-foreground block">Payment Reminders</span>
                  <span className="text-xs text-muted-foreground">Receive monthly rent reminders 3 days before the due date.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={payRemind}
                  onChange={(e) => setPayRemind(e.target.checked)}
                  className="h-5 w-10 appearance-none bg-muted rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-primary before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-5.5 border border-border"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={savePreferences} disabled={savingPrefs} className="rounded-xl px-6 font-semibold">
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </section>

          {/* Section 3: Documents */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <FileText className="text-primary h-5 w-5" /> My Documents
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex-col items-center justify-center text-center gap-1.5 rounded-2xl border bg-muted/10"
                onClick={() => handleDownloadDoc('Agreement PDF')}
              >
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-xs font-semibold leading-none">Agreement PDF</span>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 flex-col items-center justify-center text-center gap-1.5 rounded-2xl border bg-muted/10"
                onClick={() => handleDownloadDoc('Allocation Certificate')}
              >
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <span className="text-xs font-semibold leading-none">Allocation Cert.</span>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 flex-col items-center justify-center text-center gap-1.5 rounded-2xl border bg-muted/10"
                onClick={() => handleDownloadDoc('Billing Receipts')}
              >
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <span className="text-xs font-semibold leading-none">Receipts List</span>
              </Button>
            </div>
          </section>

        </div>

        {/* Right Side: Account, Allocation Details & Security */}
        <div className="space-y-6">
          
          {/* Section 4: Security (Password Reset) */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <Lock className="text-primary h-5 w-5" /> Security & Passwords
              </h3>
            </div>
            
            <p className="text-xs text-muted-foreground">Keep your account secure by resetting your password periodically.</p>
            <Button onClick={() => setIsPasswordModalOpen(true)} className="w-full rounded-xl py-5 font-semibold">
              Change Password
            </Button>
          </section>

          {/* Section 5: My Allocation (Read Only) */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <Building2 className="text-primary h-5 w-5" /> My Allocation
              </h3>
            </div>

            {allocation ? (
              <div className="space-y-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground font-semibold">Hostel:</span>
                    <span className="font-semibold text-foreground">{allocation.hostels?.name}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground font-semibold">Room Number:</span>
                    <span className="font-semibold text-foreground">Room {allocation.rooms?.room_number}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-muted-foreground font-semibold">Allocation Date:</span>
                    <span className="font-medium text-foreground">{new Date(allocation.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-muted-foreground font-semibold">Status:</span>
                    <span className="font-bold text-green-600">Active ✅</span>
                  </div>
                </div>

                <a href="/student/dashboard" className="block w-full">
                  <Button variant="outline" className="w-full rounded-xl font-semibold">
                    View Full Room Details
                  </Button>
                </a>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground">No active allocation details.</p>
                <a href="/student/room-request" className="block w-full">
                  <Button variant="outline" className="w-full rounded-xl font-semibold">
                    Request a Room
                  </Button>
                </a>
              </div>
            )}
          </section>

          {/* Section 6: Account Actions */}
          <section className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-foreground font-display flex items-center gap-2">
                <User className="text-primary h-5 w-5" /> Account Details
              </h3>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Account Created:</span>
                <span className="font-medium text-foreground">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Room Allocated:</span>
                <span className="font-medium text-foreground">{allocation?.start_date ? new Date(allocation.start_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Login:</span>
                <span className="font-medium text-foreground">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleTimeString() : 'N/A'}</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full rounded-xl py-5 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold gap-2"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </section>

        </div>

      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-bold text-lg text-foreground font-display flex items-center gap-2">
                <Lock className="text-primary h-5 w-5" /> Change Password
              </h4>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                &times;
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="old-pass">Current Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      router.push('/auth/forgot-password');
                    }}
                    className="text-xs text-primary hover:underline font-medium bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot your current password?
                  </button>
                </div>
                <Input 
                  id="old-pass" 
                  type="password" 
                  required 
                  placeholder="Enter current password"
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-pass">New Password</Label>
                <Input 
                  id="new-pass" 
                  type="password" 
                  required 
                  placeholder="Min. 8 characters"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirm-pass">Confirm New Password</Label>
                <Input 
                  id="confirm-pass" 
                  type="password" 
                  required 
                  placeholder="Repeat new password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                />
              </div>

              <div className="rounded-xl bg-muted/30 p-3 border space-y-1 text-xs text-muted-foreground">
                <span className="font-bold text-foreground block uppercase text-[9px] tracking-wider font-display">Password Requirements</span>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> Minimum 8 characters
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> Numbers, symbols, and uppercase letters recommended
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={() => setIsPasswordModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={verifyingPassword} className="rounded-xl px-5 font-semibold">
                  {verifyingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardShell>
  );
}
