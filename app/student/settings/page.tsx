/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  User, Lock, Bell, ShieldCheck, FileText,
  Building2, Calendar, ShieldAlert, ArrowRight, Home,
  Palette, Sun, Moon, Monitor, Check, KeyRound, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { useTheme } from '@/lib/theme-context';
import { AccountPasswordDialog } from '@/components/auth/AccountPasswordDialog';
import { cn } from '@/lib/utils';

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
        checked ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function StudentSettingsPage() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Manage your student profile, visual theme, notification alerts, and security credentials.
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || 'Student'}
                className="h-16 w-16 sm:h-18 sm:w-18 rounded-full object-cover ring-2 ring-teal-400/40 shrink-0"
              />
            ) : (
              <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xl sm:text-2xl font-bold ring-2 ring-teal-400/40 shrink-0 select-none">
                {(() => { const parts = (profile?.full_name || 'Shubham Singh').trim().split(/\s+/); return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.slice(0, 2) || 'SS').toUpperCase(); })()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate capitalize">
                {profile?.full_name || 'Student'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                {profile?.email || 'No email registered'}
              </p>
              {profile?.phone_number && (
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                  {profile.phone_number}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  Student
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Left Column: Appearance, Account, Notifications */}
        <div className="space-y-4 sm:space-y-5">
          {/* 1. Appearance & Theme Selector */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Palette className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Appearance &amp; Theme</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Choose your workspace display mode</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {/* Light Theme */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    toast.success('Switched to Light theme');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'light'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/40">
                    <Sun size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Light</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">Daylight</p>
                  </div>
                  {theme === 'light' && (
                    <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={9} />
                    </span>
                  )}
                </button>

                {/* Dark Theme */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    toast.success('Switched to Dark theme');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'dark'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-800/40">
                    <Moon size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Dark</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">Night-time</p>
                  </div>
                  {theme === 'dark' && (
                    <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={9} />
                    </span>
                  )}
                </button>

                {/* System Theme */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('system');
                    toast.success('Switched to System theme');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'system'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <Monitor size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">System</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">Device sync</p>
                  </div>
                  {theme === 'system' && (
                    <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={9} />
                    </span>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Account Section */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Account</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Profile identity information</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Full Name</Label>
                  <Input disabled value={profile?.full_name || 'N/A'} className="mt-1 h-9 bg-slate-50 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-300 disabled:opacity-100 disabled:text-slate-700 dark:disabled:text-slate-300 font-medium text-xs cursor-not-allowed capitalize" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Email Address</Label>
                  <Input disabled value={profile?.email || 'N/A'} className="mt-1 h-9 bg-slate-50 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-300 disabled:opacity-100 disabled:text-slate-700 dark:disabled:text-slate-300 font-medium text-xs cursor-not-allowed" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Phone Number</Label>
                  <Input disabled value={profile?.phone_number || 'Not provided'} className="mt-1 h-9 bg-slate-50 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-300 disabled:opacity-100 disabled:text-slate-700 dark:disabled:text-slate-300 font-medium text-xs cursor-not-allowed" />
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                  To update your profile details, please contact the hostel office.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Notifications Section */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Bell className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Notifications</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Email alerts and payment reminders</p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Email Receipts</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Payment receipts and invoices</p>
                  </div>
                  <ToggleSwitch
                    checked={emailNotif}
                    onChange={setEmailNotif}
                    label="Email Receipts"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Announcements</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Hostel notices and broadcast updates</p>
                  </div>
                  <ToggleSwitch
                    checked={announceNotif}
                    onChange={setAnnounceNotif}
                    label="Announcements"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Payment Reminders</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Advance notification before fee due dates</p>
                  </div>
                  <ToggleSwitch
                    checked={payRemind}
                    onChange={setPayRemind}
                    label="Payment Reminders"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button 
                  onClick={savePreferences} 
                  disabled={savingPrefs} 
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-5 py-2.5 text-sm font-medium rounded-lg h-auto cursor-pointer shadow-sm hover:shadow transition-all flex items-center gap-2 active:scale-95"
                >
                  {savingPrefs ? (
                    <>
                      <span className="h-3.5 w-3.5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Preferences</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Current Allocation, Security, Documents */}
        <div className="space-y-4 sm:space-y-5">
          {/* 1. Allocation Card */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Current Allocation</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Assigned room &amp; residency status</p>
                </div>
              </div>

              {allocation ? (
                <div className="space-y-2.5 pt-1">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#1a3d52]">
                      <span className="text-slate-600 dark:text-slate-400">Hostel</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{allocation.hostels?.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#1a3d52]">
                      <span className="text-slate-600 dark:text-slate-400">Room</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Room {allocation.rooms?.room_number}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#1a3d52]">
                      <span className="text-slate-600 dark:text-slate-400">Check-in</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{new Date(allocation.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400">Residency Status</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    </div>
                  </div>

                  <a href="/student/dashboard" className="block pt-1.5">
                    <Button 
                      size="sm" 
                      className="w-full rounded-xl font-semibold text-xs bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:via-teal-800 hover:to-emerald-700 text-white shadow-sm hover:shadow h-9 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <Building2 className="h-4 w-4" />
                      <span>View Living Dashboard</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="text-center py-5 space-y-2.5">
                  <Home className="h-7 w-7 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-600 dark:text-slate-400">No active room allocation</p>
                  <a href="/student/room-request" className="inline-block">
                    <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs border-slate-200 dark:border-[#1a3d52] h-8.5 text-slate-700 dark:text-slate-200">
                      Request a Room
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Security Card */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Security</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Password and account protection</p>
                </div>
              </div>

              <Button 
                onClick={() => setIsPasswordModalOpen(true)} 
                size="sm"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/15 rounded-xl font-semibold text-xs h-9 cursor-pointer shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2 group active:scale-95"
              >
                <KeyRound className="h-3.5 w-3.5 transition-transform group-hover:rotate-45" />
                <span>Change Password</span>
              </Button>
            </CardContent>
          </Card>

          {/* 3. Documents Card */}
          <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-xs rounded-2xl">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Documents</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Agreements, certificates &amp; records</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div 
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 text-xs font-medium" 
                  onClick={() => toast.info('Document download coming soon')}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Allocation Certificate</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
                <div 
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 text-xs font-medium" 
                  onClick={() => toast.info('Payment receipt export coming soon')}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>Payment Receipts</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Dialog */}
      <AccountPasswordDialog
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        userEmail={user?.email}
        role="student"
      />
    </div>
  );
}
