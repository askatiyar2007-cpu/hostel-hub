/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  User, Lock, Bell, ShieldCheck, FileText, LogOut,
  Building2, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Home
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

  // Save Preferences
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

  // Change Password
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
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: oldPassword
      });

      if (signInErr) {
        throw new Error('Verification of old password failed. Please check your credentials.');
      }

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900 font-display">Settings</h1>
        <p className="text-slate-600">Manage your profile, notifications, security and HostelHub account.</p>
      </div>

      {/* Profile Card */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || 'Student'}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-teal-400/40"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-2xl font-bold ring-2 ring-teal-400/40">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900">{profile?.full_name || 'Student'}</h3>
              <p className="text-sm text-slate-500">{profile?.email || 'No email'}</p>
              {profile?.phone_number && (
                <p className="text-sm text-slate-500">{profile.phone_number}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 border border-teal-200 px-2.5 py-0.5 text-[10px] font-semibold text-teal-700">
                  Student
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Active
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Account Section */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Account</h3>
                  <p className="text-xs text-slate-500">Profile information</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-slate-500">Full Name</Label>
                  <Input disabled value={profile?.full_name || 'N/A'} className="mt-1 bg-slate-50 border-slate-200 cursor-not-allowed" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  <Input disabled value={profile?.email || 'N/A'} className="mt-1 bg-slate-50 border-slate-200 cursor-not-allowed" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Phone</Label>
                  <Input disabled value={profile?.phone_number || 'N/A'} className="mt-1 bg-slate-50 border-slate-200 cursor-not-allowed" />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">Profile details are linked to your room request and cannot be edited here.</p>
              </div>
            </CardContent>
          </Card>

          {/* Preferences Section */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500">Email alerts and reminders</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Notifications</p>
                    <p className="text-xs text-slate-500">Payment receipts and invoices</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotif}
                    onChange={(e) => setEmailNotif(e.target.checked)}
                    className="h-5 w-9 appearance-none bg-slate-300 rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-teal-600 before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-4.5 border border-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Announcements</p>
                    <p className="text-xs text-slate-500">Hostel notices and updates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={announceNotif}
                    onChange={(e) => setAnnounceNotif(e.target.checked)}
                    className="h-5 w-9 appearance-none bg-slate-300 rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-teal-600 before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-4.5 border border-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Payment Reminders</p>
                    <p className="text-xs text-slate-500">3 days before due date</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={payRemind}
                    onChange={(e) => setPayRemind(e.target.checked)}
                    className="h-5 w-9 appearance-none bg-slate-300 rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-teal-600 before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-4.5 border border-slate-400"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={savePreferences} disabled={savingPrefs} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Allocation Card */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Current Allocation</h3>
                  <p className="text-xs text-slate-500">Your room details</p>
                </div>
              </div>

              {allocation ? (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Hostel</span>
                      <span className="font-medium text-slate-900">{allocation.hostels?.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Room</span>
                      <span className="font-medium text-slate-900">Room {allocation.rooms?.room_number}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Check-in</span>
                      <span className="font-medium text-slate-900">{new Date(allocation.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Status</span>
                      <span className="font-bold text-emerald-600">Active</span>
                    </div>
                  </div>

                  <a href="/student/dashboard" className="block">
                    <Button variant="outline" className="w-full rounded-xl font-medium">
                      View Details <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <Home className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-500">No active allocation</p>
                  <a href="/student/room-request" className="block">
                    <Button variant="outline" className="w-full rounded-xl font-medium">
                      Request a Room
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Security</h3>
                  <p className="text-xs text-slate-500">Password and account</p>
                </div>
              </div>

              <Button onClick={() => setIsPasswordModalOpen(true)} className="w-full border border-slate-200 hover:bg-slate-50 rounded-xl font-medium">
                Change Password
              </Button>
            </CardContent>
          </Card>

          {/* Documents Card */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Documents</h3>
                  <p className="text-xs text-slate-500">Agreements and receipts</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button variant="ghost" className="w-full justify-start rounded-xl text-slate-700 hover:bg-slate-50" onClick={() => toast.info('Document download coming soon')}>
                  <ShieldCheck className="h-4 w-4 mr-3 text-emerald-600" />
                  <span className="text-sm">Allocation Certificate</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start rounded-xl text-slate-700 hover:bg-slate-50" onClick={() => toast.info('Document download coming soon')}>
                  <Calendar className="h-4 w-4 mr-3 text-blue-600" />
                  <span className="text-sm">Payment Receipts</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Button
            variant="outline"
            className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-medium"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-[540px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <Lock className="text-teal-600 h-4 w-4" />
                </div>
                <h4 className="font-bold text-base text-slate-900 font-display">Change Password</h4>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                &times;
              </button>
            </div>

            <div className="overflow-y-auto p-5 pt-4 flex-1">
              <form onSubmit={handleChangePassword} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="old-pass" className="text-xs font-medium">Current Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPasswordModalOpen(false);
                        router.push('/auth/forgot-password');
                      }}
                      className="text-xs text-teal-600 hover:underline font-medium bg-transparent border-none p-0 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="old-pass"
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-pass" className="text-xs font-medium">New Password</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    required
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pass" className="text-xs font-medium">Confirm New Password</Label>
                  <Input
                    id="confirm-pass"
                    type="password"
                    required
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1.5 text-xs text-slate-600">
                  <span className="font-bold text-slate-900 block uppercase text-[9px] tracking-wider font-display">Password Requirements</span>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" /> Minimum 8 characters
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-teal-600 shrink-0" /> Numbers, symbols, and uppercase letters recommended
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" type="button" onClick={() => setIsPasswordModalOpen(false)} className="rounded-lg h-9 px-4">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={verifyingPassword} className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg h-9 px-5 font-semibold">
                    {verifyingPassword ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
