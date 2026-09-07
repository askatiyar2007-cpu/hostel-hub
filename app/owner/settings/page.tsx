'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { 
  User, 
  Lock, 
  Shield, 
  CheckCircle2, 
  Building2, 
  CreditCard, 
  FileText, 
  Sparkles, 
  Bell, 
  Sun, 
  Globe, 
  Coins, 
  HelpCircle, 
  FileCheck, 
  Info, 
  LogOut, 
  ChevronRight, 
  ArrowRight, 
  X, 
  Check, 
  Eye, 
  EyeOff, 
  Phone, 
  Mail, 
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// =========================================================================
// Setting Row Component with Crisp Contrast & Semantic Pastel Icons
// =========================================================================
interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  isDestructive?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  title,
  description,
  badge,
  onClick,
  href,
  isDestructive = false
}: SettingsRowProps) {
  const content = (
    <div className="flex items-center justify-between gap-4 p-4 sm:p-5 w-full">
      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
        {/* ~48px Semantic Pastel Icon Container */}
        <div className={cn(
          "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 group-hover:scale-105",
          iconBg
        )}>
          {icon}
        </div>

        {/* Title & Short Description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(
              "text-sm font-bold tracking-tight leading-snug transition-colors",
              isDestructive ? "text-rose-600 group-hover:text-rose-700" : "text-slate-900 group-hover:text-teal-700"
            )}>
              {title}
            </h3>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 leading-normal">
            {description}
          </p>
        </div>
      </div>

      {/* Trailing Chevron / Action Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <ChevronRight className={cn(
          "h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5",
          isDestructive ? "text-rose-400 group-hover:text-rose-600" : "text-slate-400 group-hover:text-slate-600"
        )} />
      </div>
    </div>
  );

  const rowClasses = cn(
    "group flex items-center w-full text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset",
    isDestructive 
      ? "hover:bg-rose-50/60 active:bg-rose-100/60" 
      : "hover:bg-slate-50/90 active:bg-slate-100/90"
  );

  if (href) {
    return (
      <Link href={href} className={rowClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={rowClasses}>
      {content}
    </button>
  );
}

// =========================================================================
// Main Owner Settings Page Component
// =========================================================================
export default function OwnerSettingsPage() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'profile' | 'password' | 'security' | 'kyc' | 'subscription' | 'notifications' | 'appearance' | 'language' | 'currency' | 'help' | 'terms' | 'about' | null
  >(null);

  // Profile Form state
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification preferences
  const [notifyRoomRequests, setNotifyRoomRequests] = useState(true);
  const [notifyComplaints, setNotifyComplaints] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      setNotifyRoomRequests(user.user_metadata.notify_room_requests !== false);
      setNotifyComplaints(user.user_metadata.notify_complaints !== false);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || ''
      });
    }
  }, [profile]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
      setActiveModal(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Password Update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setVerifyingPassword(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile?.email || user?.email || '',
        password: oldPassword
      });

      if (signInErr) {
        throw new Error('Current password verification failed. Please check your credentials.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) throw updateErr;

      toast.success('Password updated successfully');
      setActiveModal(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password update failed.';
      toast.error(message);
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Handle Notification Preferences Save
  const handleSaveNotifications = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          notify_room_requests: notifyRoomRequests,
          notify_complaints: notifyComplaints
        }
      });
      if (error) throw error;
      toast.success('Notification preferences saved successfully');
      setActiveModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      toast.error(message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    : null;

  const ownerName = profile?.full_name || user?.user_metadata?.full_name || 'Hostel Owner';
  const ownerEmail = profile?.email || user?.email || 'owner@hostelhub.in';

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-8 min-w-0">
      {/* ========================================================================= */}
      {/* 1. Page Title & Subtitle                                                  */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Settings
          </h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Owner Workspace
          </span>
        </div>
        <p className="mt-1.5 text-sm md:text-base text-slate-500 leading-relaxed">
          Manage your account, business, preferences and support.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. Compact Owner Profile Summary Card (Real Logged-in Info)              */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-sky-100/90 bg-white p-5 sm:p-6 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] relative z-10 transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            {/* Circular Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={ownerName}
                className="h-16 w-16 rounded-full object-cover ring-4 ring-sky-100/80 shadow-sm shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-teal-600 via-teal-700 to-emerald-600 text-white flex items-center justify-center text-xl font-bold tracking-wider ring-4 ring-sky-100/80 shadow-sm shrink-0">
                {ownerName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight truncate">
                  {ownerName}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 uppercase tracking-wider">
                  Owner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-1">
                {ownerEmail}
              </p>
              {memberSince && (
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar size={11} /> Member since {memberSince}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:self-center shrink-0">
            <Button
              onClick={() => setActiveModal('profile')}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm px-4 h-9.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span>Edit Profile</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Section Grid: ACCOUNT & BUSINESS (Side-by-side on desktop)             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* ACCOUNT SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Account
            </h2>
            <span className="text-[11px] font-medium text-slate-400">Personal & Security</span>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100/90 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] divide-y divide-slate-100 overflow-hidden relative z-10">
            {/* Profile Information */}
            <SettingsRow
              icon={<User size={20} />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              title="Profile Information"
              description="Your name, email, phone and profile details"
              onClick={() => setActiveModal('profile')}
            />

            {/* Change Password */}
            <SettingsRow
              icon={<Lock size={20} />}
              iconBg="bg-indigo-50 text-indigo-700 border border-indigo-200/80"
              title="Change Password"
              description="Update your password securely"
              onClick={() => setActiveModal('password')}
            />

            {/* Security */}
            <SettingsRow
              icon={<Shield size={20} />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200/80"
              title="Security"
              description="Login sessions and security preferences"
              badge={
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={10} /> Protected
                </span>
              }
              onClick={() => setActiveModal('security')}
            />

            {/* KYC & Verification */}
            <SettingsRow
              icon={<CheckCircle2 size={20} />}
              iconBg="bg-teal-50 text-teal-700 border border-teal-200/80"
              title="KYC & Verification"
              description="Verification status and owner information"
              badge={
                <span className="inline-flex items-center text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Verified
                </span>
              }
              onClick={() => setActiveModal('kyc')}
            />
          </div>
        </div>

        {/* BUSINESS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Business
            </h2>
            <span className="text-[11px] font-medium text-slate-400">Operations & Finance</span>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100/90 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] divide-y divide-slate-100 overflow-hidden relative z-10">
            {/* Business Information */}
            <SettingsRow
              icon={<Building2 size={20} />}
              iconBg="bg-teal-50 text-teal-700 border border-teal-200/80"
              title="Business Information"
              description="Hostel business details and property portfolio"
              href="/owner/hostels"
            />

            {/* Bank Accounts */}
            <SettingsRow
              icon={<CreditCard size={20} />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              title="Bank Accounts"
              description="Manage accounts used for settlements/payouts"
              href="/owner/settings/payment-methods"
            />

            {/* Billing & Invoices */}
            <SettingsRow
              icon={<FileText size={20} />}
              iconBg="bg-sky-50 text-sky-700 border border-sky-200/80"
              title="Billing & Invoices"
              description="Billing history, invoices and fee tracking"
              href="/owner/billing"
            />

            {/* Subscription & Plan */}
            <SettingsRow
              icon={<Sparkles size={20} />}
              iconBg="bg-amber-50 text-amber-700 border border-amber-200/80"
              title="Subscription & Plan"
              description="Current plan and subscription information"
              badge={
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Owner Tier
                </span>
              }
              onClick={() => setActiveModal('subscription')}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Section Grid: PREFERENCES & SUPPORT/ABOUT (Side-by-side on desktop)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* PREFERENCES SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Preferences
            </h2>
            <span className="text-[11px] font-medium text-slate-400">Workspace & System</span>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100/90 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] divide-y divide-slate-100 overflow-hidden relative z-10">
            {/* Notifications */}
            <SettingsRow
              icon={<Bell size={20} />}
              iconBg="bg-purple-50 text-purple-700 border border-purple-200/80"
              title="Notifications"
              description="Push/email/SMS notification preferences"
              onClick={() => setActiveModal('notifications')}
            />

            {/* Appearance */}
            <SettingsRow
              icon={<Sun size={20} />}
              iconBg="bg-cyan-50 text-cyan-700 border border-cyan-200/80"
              title="Appearance"
              description="Theme and visual preferences"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  Light Theme
                </span>
              }
              onClick={() => setActiveModal('appearance')}
            />

            {/* Language */}
            <SettingsRow
              icon={<Globe size={20} />}
              iconBg="bg-violet-50 text-violet-700 border border-violet-200/80"
              title="Language"
              description="Preferred language"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  English (India)
                </span>
              }
              onClick={() => setActiveModal('language')}
            />

            {/* Currency */}
            <SettingsRow
              icon={<Coins size={20} />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              title="Currency"
              description="Preferred currency"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  INR (₹)
                </span>
              }
              onClick={() => setActiveModal('currency')}
            />
          </div>
        </div>

        {/* SUPPORT & ABOUT SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Support & About
            </h2>
            <span className="text-[11px] font-medium text-slate-400">Help & Info</span>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100/90 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] divide-y divide-slate-100 overflow-hidden relative z-10">
            {/* Help & Support */}
            <SettingsRow
              icon={<HelpCircle size={20} />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200/80"
              title="Help & Support"
              description="Get help with HostelHub"
              onClick={() => setActiveModal('help')}
            />

            {/* Terms & Privacy */}
            <SettingsRow
              icon={<FileCheck size={20} />}
              iconBg="bg-slate-100 text-slate-700 border border-slate-200/80"
              title="Terms & Privacy"
              description="Terms of service and privacy information"
              onClick={() => setActiveModal('terms')}
            />

            {/* About HostelHub */}
            <SettingsRow
              icon={<Info size={20} />}
              iconBg="bg-teal-50 text-teal-700 border border-teal-200/80"
              title="About HostelHub"
              description="App version and application information"
              badge={
                <span className="inline-flex items-center text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full">
                  v1.0.0
                </span>
              }
              onClick={() => setActiveModal('about')}
            />

            {/* Logout (Clearly Destructive / Red treatment) */}
            <SettingsRow
              icon={<LogOut size={20} />}
              iconBg="bg-rose-50 text-rose-600 border border-rose-200/80"
              title="Logout"
              description="Securely sign out of this device"
              isDestructive={true}
              onClick={() => signOut()}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODALS & INTERACTIVE DIALOGS                                           */}
      {/* ========================================================================= */}

      {/* 1. Profile Edit Modal */}
      {activeModal === 'profile' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-2xs">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Profile Information</h3>
                  <p className="text-xs text-slate-500">Update your identity and contact details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-semibold text-slate-700">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Verified
                  </span>
                </div>
                <Input
                  id="email"
                  type="email"
                  value={ownerEmail}
                  disabled
                  className="h-10 rounded-xl bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Email is locked to your authenticated credentials.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone_number" className="text-xs font-semibold text-slate-700">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="pl-9 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="h-9.5 rounded-xl border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={profileSaving}
                  className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Change Password Modal */}
      {activeModal === 'password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shadow-2xs">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Change Password</h3>
                  <p className="text-xs text-slate-500">Update your account password securely</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="old_password" className="text-xs font-semibold text-slate-700">
                    Current Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      router.push('/auth/forgot-password');
                    }}
                    className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-medium p-0 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="old_password"
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new_password" className="text-xs font-semibold text-slate-700">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className="text-xs font-semibold text-slate-700">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Password Requirements
                </p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-3.5 w-3.5 rounded-full flex items-center justify-center text-[10px]",
                    newPassword.length >= 8 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    <Check size={10} />
                  </div>
                  <span className={newPassword.length >= 8 ? "text-slate-900 font-medium" : "text-slate-500"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-3.5 w-3.5 rounded-full flex items-center justify-center text-[10px]",
                    newPassword && newPassword === confirmPassword ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    <Check size={10} />
                  </div>
                  <span className={newPassword && newPassword === confirmPassword ? "text-slate-900 font-medium" : "text-slate-500"}>
                    Passwords match
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="h-9.5 rounded-xl border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verifyingPassword}
                  className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
                >
                  {verifyingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Security Details Modal */}
      {activeModal === 'security' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shadow-2xs">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Security Details</h3>
                  <p className="text-xs text-slate-500">Active authentication status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Session Status</p>
                  <p className="text-slate-500">Authenticated via Supabase Auth</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> Active
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900">Signed-in Email</p>
                <p className="text-slate-600 break-all">{ownerEmail}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900">Access Level</p>
                <p className="text-slate-600">Owner Workspace & Hostels Administrator</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. KYC & Verification Modal */}
      {activeModal === 'kyc' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shadow-2xs">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">KYC & Verification</h3>
                  <p className="text-xs text-slate-500">HostelHub verified partner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-start gap-3 text-xs">
              <CheckCircle2 size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-teal-900">Owner Identity Verified</p>
                <p className="text-teal-700 mt-0.5 leading-relaxed">
                  Your owner account credentials and hostel management permissions are fully verified for direct fee collections and tenant contracts.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Verification Tier</span>
                <span className="font-bold text-slate-900">Standard Owner Partner</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Direct Settlement</span>
                <span className="font-bold text-emerald-600">Enabled</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Account Type</span>
                <span className="font-bold text-slate-900">Hostel Administrator</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Subscription & Plan Modal */}
      {activeModal === 'subscription' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-2xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Subscription & Plan</h3>
                  <p className="text-xs text-slate-500">Your current workspace entitlements</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 to-amber-100/40 border border-amber-200/80 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Current Plan</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900">Active</span>
              </div>
              <h4 className="text-lg font-bold text-slate-900">HostelHub Owner Workspace</h4>
              <p className="text-slate-600 leading-relaxed">
                Complete platform access for property management, electricity metering, and billing workflows.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Check size={14} className="text-teal-600" />
                <span>Unlimited hostel property listings</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check size={14} className="text-teal-600" />
                <span>Automated room & sub-meter electricity computation</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check size={14} className="text-teal-600" />
                <span>Direct UPI and Bank Transfer payout channels</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Notifications Preferences Modal */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shadow-2xs">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Notification Preferences</h3>
                  <p className="text-xs text-slate-500">Configure operational alerts and updates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {/* Toggle 1 */}
                <div className="flex items-center justify-between p-4 bg-white">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-slate-900">Room Booking & Allocations</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Receive alerts when students apply for rooms or bed allocations.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyRoomRequests}
                    onClick={() => setNotifyRoomRequests(!notifyRoomRequests)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500",
                      notifyRoomRequests ? "bg-teal-600" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out",
                        notifyRoomRequests ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Toggle 2 */}
                <div className="flex items-center justify-between p-4 bg-white">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-slate-900">Complaints & Maintenance</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Receive alerts when a resident logs an urgent hostel complaint.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyComplaints}
                    onClick={() => setNotifyComplaints(!notifyComplaints)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500",
                      notifyComplaints ? "bg-teal-600" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out",
                        notifyComplaints ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveModal(null)}
                  className="h-9.5 rounded-xl border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={savingPrefs}
                  className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
                >
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Appearance Modal */}
      {activeModal === 'appearance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center shadow-2xs">
                  <Sun size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Appearance & Theme</h3>
                  <p className="text-xs text-slate-500">Visual workspace environment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl border-2 border-teal-500 bg-teal-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">HostelHub Daylight Architecture</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">Active</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Carefully optimized for daytime administrative readability with high-contrast elevated white cards over a pale atmospheric architectural skyline.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Language Modal */}
      {activeModal === 'language' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center shadow-2xs">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">System Language</h3>
                  <p className="text-xs text-slate-500">Supported workspace languages</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-teal-300 bg-teal-50/50 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">English (India & International)</p>
                <p className="text-slate-500">Standard system locale for Indian hostels</p>
              </div>
              <Check size={16} className="text-teal-600" />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Currency Modal */}
      {activeModal === 'currency' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shadow-2xs">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Billing Currency</h3>
                  <p className="text-xs text-slate-500">Default rent and electricity unit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">INR (₹) - Indian Rupee</p>
                <p className="text-slate-500">Configured for UPI and Indian bank settlements</p>
              </div>
              <Check size={16} className="text-emerald-600" />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Help & Support Modal */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shadow-2xs">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Help & Support</h3>
                  <p className="text-xs text-slate-500">Contact HostelHub assistance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Mail size={13} className="text-teal-600" /> Support Email
                </p>
                <p className="text-slate-600 select-all font-medium">support@hostelhub.in</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Phone size={13} className="text-teal-600" /> Owner Operations Helpline
                </p>
                <p className="text-slate-600 font-medium">+91 (080) 4567-8900 (Mon - Sat, 9 AM - 7 PM)</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Terms & Privacy Modal */}
      {activeModal === 'terms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shadow-2xs">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Terms & Privacy</h3>
                  <p className="text-xs text-slate-500">Owner agreement & standards</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed max-h-60 overflow-y-auto pr-1">
              <p>
                HostelHub provides property management and tenant allocation tools. By managing properties on HostelHub, owners agree to keep room pricing, availability, and electricity readings accurate and up to date.
              </p>
              <p>
                All student tenant data is protected by strict Row-Level Security (RLS) policies. PII (phone numbers, IDs) is confidential and solely intended for tenancy administration.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 12. About HostelHub Modal */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shadow-2xs">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">About HostelHub</h3>
                  <p className="text-xs text-slate-500">Platform release details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Application</span>
                <span className="font-bold text-slate-900">HostelHub Owner Workspace</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Version</span>
                <span className="font-bold text-teal-700">1.0.0 (Production)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Framework</span>
                <span className="font-semibold text-slate-800">Next.js 14 App Router</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Database & Auth</span>
                <span className="font-semibold text-slate-800">Supabase Cloud</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}