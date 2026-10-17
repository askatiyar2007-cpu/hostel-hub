'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useTheme } from '@/lib/theme-context';
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
  Moon,
  Monitor,
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
  Phone, 
  Mail, 
  Calendar,
  ExternalLink,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { AccountPasswordDialog } from '@/components/auth/AccountPasswordDialog';
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
              isDestructive ? "text-rose-600 group-hover:text-rose-700 dark:text-rose-400 dark:group-hover:text-rose-300" : "text-slate-900 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-400"
            )}>
              {title}
            </h3>
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-normal">
            {description}
          </p>
        </div>
      </div>

      {/* Trailing Chevron / Action Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <ChevronRight className={cn(
          "h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5",
          isDestructive ? "text-rose-400 group-hover:text-rose-600 dark:text-rose-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
        )} />
      </div>
    </div>
  );

  const rowClasses = cn(
    "group flex items-center w-full text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset",
    isDestructive 
      ? "hover:bg-rose-50/60 active:bg-rose-100/60 dark:hover:bg-rose-950/20 dark:active:bg-rose-900/30" 
      : "hover:bg-slate-50/90 active:bg-slate-100/90 dark:hover:bg-[#16364a] dark:active:bg-[#1a3d52]"
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
// Main Settings Page Component
// =========================================================================
export default function OwnerSettingsPage() {
  const { user, profile, signOut, refreshAuthState, loading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Defensive redirect if not authenticated
  useEffect(() => {
    if (!loading && (!user || !profile)) {
      window.location.replace('/auth/login');
    }
  }, [loading, user, profile]);

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

  // Security session state
  const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  // Real database metadata for business & KYC
  const [hostels, setHostels] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [paymentMethodsCount, setPaymentMethodsCount] = useState<number>(0);

  // Notification preferences
  const [notifyRoomRequests, setNotifyRoomRequests] = useState(true);
  const [notifyComplaints, setNotifyComplaints] = useState(true);
  const [notifyElectricity, setNotifyElectricity] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load user metadata for preferences
  useEffect(() => {
    if (user?.user_metadata) {
      setNotifyRoomRequests(user.user_metadata.notify_room_requests !== false);
      setNotifyComplaints(user.user_metadata.notify_complaints !== false);
      setNotifyElectricity(user.user_metadata.notify_electricity !== false);
    }
  }, [user]);

  // Sync profile form when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || ''
      });
    }
  }, [profile]);

  // Load real business data (hostels and payment methods) from Supabase
  useEffect(() => {
    if (!user?.id) return;
    let isCancelled = false;

    async function fetchOwnerBusinessData() {
      try {
        // Fetch hostels
        const { data: hostelData } = await supabase
          .from('hostels')
          .select('id, name, status')
          .eq('owner_id', user!.id);

        if (!isCancelled && hostelData) {
          setHostels(hostelData);
        }

        // Fetch payment methods count
        const { count: pmCount } = await supabase
          .from('payment_methods')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id);

        if (!isCancelled && typeof pmCount === 'number') {
          setPaymentMethodsCount(pmCount);
        }

        // Fetch session expiry
        const { data: sessionData } = await supabase.auth.getSession();
        if (!isCancelled && sessionData?.session?.expires_at) {
          const expDate = new Date(sessionData.session.expires_at * 1000);
          setSessionExpiry(expDate.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }));
        }
      } catch (err) {
        console.error('Error fetching business settings data:', err);
      }
    }

    fetchOwnerBusinessData();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  // Lock body scroll and close on Escape key when any modal is open
  useEffect(() => {
    if (!activeModal) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  // Handle Profile Update with immediate refresh
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Immediately synchronize auth state so profile card and header update
      await refreshAuthState();
      toast.success('Profile updated successfully');
      setActiveModal(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Sign Out Other Devices
  const handleSignOutOtherDevices = async () => {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Successfully signed out of all other devices');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign out other devices';
      toast.error(message);
    } finally {
      setSigningOutOthers(false);
    }
  };

  // Handle Notification Preferences Save
  const handleSaveNotifications = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          notify_room_requests: notifyRoomRequests,
          notify_complaints: notifyComplaints,
          notify_electricity: notifyElectricity
        }
      });
      if (error) throw error;
      await refreshAuthState();
      toast.success('Notification preferences saved successfully');
      setActiveModal(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      toast.error(message);
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    : null;

  const ownerName = profile?.full_name || user?.user_metadata?.full_name || 'Hostel Owner';
  const ownerEmail = profile?.email || user?.email || 'owner@hostelhub.in';
  const ownerPhone = profile?.phone_number || '';
  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const hasApprovedHostel = hostels.some(h => h.status === 'approved');
  const hasPendingHostel = hostels.some(h => h.status === 'pending');

  // Dynamic KYC Status calculation
  const kycStatusBadge = hasApprovedHostel ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
      <CheckCircle2 size={10} /> Property Verified
    </span>
  ) : hasPendingHostel ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
      <Clock size={10} /> In Review
    </span>
  ) : (
    <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      No Property
    </span>
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 min-w-0">
      {/* ========================================================================= */}
      {/* 1. Page Title & Subtitle                                                  */}
      {/* ========================================================================= */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Settings
        </h1>
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
                {isEmailVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Verified Email
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-slate-500 font-medium">
                <span className="truncate">{ownerEmail}</span>
                {ownerPhone && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={11} className="text-slate-400" /> {ownerPhone}
                    </span>
                  </>
                )}
              </div>
              {memberSince && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
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
              description="Update your password or request recovery OTP"
              onClick={() => setActiveModal('password')}
            />

            {/* Security */}
            <SettingsRow
              icon={<Shield size={20} />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200/80"
              title="Security"
              description="Login sessions, provider info and sign-out controls"
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
              description="Hostel verification status and direct payout readiness"
              badge={kycStatusBadge}
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
              title="Business & Properties"
              description="Hostel property portfolio, room inventory & addresses"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  {hostels.length} {hostels.length === 1 ? 'Hostel' : 'Hostels'}
                </span>
              }
              href="/owner/hostels"
            />

            {/* Bank Accounts */}
            <SettingsRow
              icon={<CreditCard size={20} />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200/80"
              title="Bank & Payout Methods"
              description="Configure UPI ID, Bank Transfer & QR Code for fee collections"
              badge={
                paymentMethodsCount > 0 ? (
                  <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    {paymentMethodsCount} Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                    Setup Needed
                  </span>
                )
              }
              href="/owner/settings/payment-methods"
            />

            {/* Billing & Invoices */}
            <SettingsRow
              icon={<FileText size={20} />}
              iconBg="bg-sky-50 text-sky-700 border border-sky-200/80"
              title="Student Billing & Dues"
              description="Manage resident fee schedules, collection cycles & dues"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full">
                  Student Fees
                </span>
              }
              href="/owner/billing"
            />

            {/* Subscription & Plan */}
            <SettingsRow
              icon={<Sparkles size={20} />}
              iconBg="bg-amber-50 text-amber-700 border border-amber-200/80"
              title="Subscription & Plan"
              description="Complimentary owner access & included features"
              badge={
                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Standard (Complimentary)
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
            <span className="text-[11px] font-medium text-slate-400">Workspace Customization</span>
          </div>

          <div className="bg-white rounded-2xl border border-sky-100/90 shadow-[0_4px_20px_-2px_rgba(14,42,71,0.06),0_2px_6px_-1px_rgba(14,42,71,0.04)] divide-y divide-slate-100 overflow-hidden relative z-10">
            {/* Notifications */}
            <SettingsRow
              icon={<Bell size={20} />}
              iconBg="bg-purple-50 text-purple-700 border border-purple-200/80"
              title="Notifications"
              description="Email alerts for bookings, maintenance & electricity"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
                  Email Active
                </span>
              }
              onClick={() => setActiveModal('notifications')}
            />

            {/* Appearance */}
            <SettingsRow
              icon={
                resolvedTheme === 'dark' ? (
                  <Moon size={20} />
                ) : theme === 'system' ? (
                  <Monitor size={20} />
                ) : (
                  <Sun size={20} />
                )
              }
              iconBg="bg-cyan-50 text-cyan-700 border border-cyan-200/80"
              title="Appearance"
              description="Select Light, Dark, or System visual workspace"
              badge={
                <span className="inline-flex items-center text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full capitalize">
                  {theme === 'system' ? 'System Theme' : `${theme} Theme`}
                </span>
              }
              onClick={() => setActiveModal('appearance')}
            />

            {/* Language */}
            <SettingsRow
              icon={<Globe size={20} />}
              iconBg="bg-violet-50 text-violet-700 border border-violet-200/80"
              title="Language"
              description="Standard locale & number format"
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
              description="Authoritative accounting & UPI settlement currency"
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
              description="Direct email support, helpline & documentation"
              onClick={() => setActiveModal('help')}
            />

            {/* Terms & Privacy */}
            <SettingsRow
              icon={<FileCheck size={20} />}
              iconBg="bg-slate-100 text-slate-700 border border-slate-200/80"
              title="Terms & Privacy"
              description="Owner partner standards & student data privacy"
              onClick={() => setActiveModal('terms')}
            />

            {/* About HostelHub */}
            <SettingsRow
              icon={<Info size={20} />}
              iconBg="bg-teal-50 text-teal-700 border border-teal-200/80"
              title="About HostelHub"
              description="Application version, framework & database architecture"
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
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-2xs">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Profile Information</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update your identity and contact details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form id="profile-form" onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-10 rounded-xl bg-slate-50/70 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0e222e] focus:border-teal-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  {isEmailVerified ? (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Verified
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={11} /> Pending Verification
                    </span>
                  )}
                </div>
                <Input
                  id="email"
                  type="email"
                  value={ownerEmail}
                  disabled
                  className="h-10 rounded-xl bg-slate-100 dark:bg-[#16364a] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1a3d52] cursor-not-allowed text-sm"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Email is locked to your authenticated credentials.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone_number" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="pl-9 h-10 rounded-xl bg-slate-50/70 dark:bg-[#122b3b] border-slate-200 dark:border-[#1a3d52] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-[#0e222e] focus:border-teal-500 text-sm"
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#122b3b] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="profile-form"
                disabled={profileSaving}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                {profileSaving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Change Password & Recovery Modal */}
      <AccountPasswordDialog
        isOpen={activeModal === 'password'}
        onClose={() => setActiveModal(null)}
        userEmail={profile?.email || user?.email}
      />

      {/* 3. Security Details Modal */}
      {activeModal === 'security' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-2xs">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Security Details</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active authentication & session status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">Session Status</p>
                  <p className="text-slate-500 dark:text-slate-400">Authenticated via Supabase Auth</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> Active
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">Authentication Method</p>
                <p className="text-slate-600 dark:text-slate-300 capitalize">
                  {user?.app_metadata?.provider || 'Email & Secure Password'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">Signed-in Email</p>
                <p className="text-slate-600 dark:text-slate-300 break-all">{ownerEmail}</p>
              </div>

              {sessionExpiry && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Session Valid Until</p>
                  <p className="text-slate-600 dark:text-slate-300">{sessionExpiry}</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">Access Level</p>
                <p className="text-slate-600 dark:text-slate-300">Owner Workspace & Hostel Property Administrator</p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOutOtherDevices}
                  disabled={signingOutOthers}
                  className="w-full h-9 rounded-xl border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>{signingOutOthers ? 'Signing Out Other Devices...' : 'Sign Out of Other Devices'}</span>
                </Button>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5">
                  Revokes all active sessions on other phones and computers.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. KYC & Verification Modal (Honest, Real Status) */}
      {activeModal === 'kyc' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center shadow-2xs">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Verification & Compliance</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Property approvals & settlement status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Email Status */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">Account Email Verification</p>
                  <p className="text-slate-500 dark:text-slate-400">{ownerEmail}</p>
                </div>
                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={11} /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                    <Clock size={11} /> Pending
                  </span>
                )}
              </div>

              {/* Property Approval Status */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Hostel Properties Status</p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {hostels.length} {hostels.length === 1 ? 'Property' : 'Properties'}
                  </span>
                </div>
                {hostels.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    No hostel properties registered yet. Create your first hostel from{' '}
                    <Link href="/owner/hostels" onClick={() => setActiveModal(null)} className="text-teal-600 dark:text-teal-400 underline">
                      Hostels Management
                    </Link>.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {hostels.map(hostel => (
                      <div key={hostel.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52]">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">{hostel.name}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          hostel.status === 'approved' 
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                            : hostel.status === 'pending'
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        )}>
                          {hostel.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct UPI / Bank Settlement Readiness */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Direct Fee Collections</p>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    paymentMethodsCount > 0 
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  )}>
                    {paymentMethodsCount > 0 ? `${paymentMethodsCount} Channels Active` : 'Action Required'}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  HostelHub enables direct peer-to-peer student collections to your own UPI ID, QR code, or Bank Account. Payments go directly to you without platform escrow.
                </p>
              </div>

              {/* Regulatory KYC Notice */}
              <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/50 text-[11px] text-teal-800 dark:text-teal-300 space-y-1">
                <p className="font-bold text-teal-900 dark:text-teal-200">Banking & KYC Standards</p>
                <p className="leading-relaxed">
                  Additional business documents (PAN, GSTIN, Trade License) are not required for direct owner UPI/Cash fee collections. Document submission will only be required if activating optional automated third-party payment gateway disbursements.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Subscription & Plan Modal (Truthful & Honest) */}
      {activeModal === 'subscription' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shadow-2xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Subscription & Plan</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your current workspace entitlements</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">Current Plan</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200">Complimentary Active</span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">Standard Owner Tier</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Full SaaS platform access for property operations, sub-meter electricity computation, and direct student fee collections with zero platform commission.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1a3d52]">
                  <span className="text-slate-500 dark:text-slate-400">Subscription Cost</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₹0 / Free (Complimentary)</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1a3d52]">
                  <span className="text-slate-500 dark:text-slate-400">Next Billing Renewal</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">No charges scheduled</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-[#1a3d52]">
                  <span className="text-slate-500 dark:text-slate-400">Hostel Property Limit</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Unlimited</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Electricity Sub-Meters</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Unlimited Multi-occupant</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Platform software access is provided complimentary to verified property managers. No credit card or recurring payment mandate is attached.
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Notifications Preferences Modal */}
      {activeModal === 'notifications' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center shadow-2xs">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Notification Preferences</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Configure email alerts & operational updates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email Alerts (Active via Brevo)</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Delivered directly to {ownerEmail}</p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#1a3d52] rounded-xl border border-slate-200 dark:border-[#1a3d52] overflow-hidden bg-white dark:bg-[#0e222e]">
                {/* Toggle 1: Room Requests */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0e222e] hover:bg-slate-50/60 dark:hover:bg-[#122b3b]/60 transition-colors">
                  <div className="pr-4 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Room Booking & Allocations</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Receive email alerts when students submit new room booking requests.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyRoomRequests}
                    onClick={() => setNotifyRoomRequests(!notifyRoomRequests)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500",
                      notifyRoomRequests ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"
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

                {/* Toggle 2: Complaints */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0e222e] hover:bg-slate-50/60 dark:hover:bg-[#122b3b]/60 transition-colors">
                  <div className="pr-4 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Complaints & Maintenance</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Receive email alerts when a resident logs an urgent hostel maintenance issue.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyComplaints}
                    onClick={() => setNotifyComplaints(!notifyComplaints)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500",
                      notifyComplaints ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"
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

                {/* Toggle 3: Electricity Billing Reminders */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0e222e] hover:bg-slate-50/60 dark:hover:bg-[#122b3b]/60 transition-colors">
                  <div className="pr-4 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Electricity Reading Reminders</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Receive monthly cycle reminders to record sub-meter readings before cycle finalization.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyElectricity}
                    onClick={() => setNotifyElectricity(!notifyElectricity)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500",
                      notifyElectricity ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out",
                        notifyElectricity ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* SMS & Push Notification Channels Status */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">SMS & Push Notification Gateways</span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Not Configured / Coming Soon
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  SMS OTP and mobile push services require dedicated DLT registration under TRAI guidelines. All transactional notifications are currently dispatched via Brevo Email.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl border-slate-200 dark:border-[#1a3d52] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#122b3b] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveNotifications}
                disabled={savingPrefs}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Appearance Modal (Real Light, Dark & System Theme Switching) */}
      {activeModal === 'appearance' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center shadow-2xs">
                  <Sun size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">Appearance & Theme</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Choose your workspace display mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Light Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    toast.success('Switched to Light theme');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'light'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-800/40 shadow-2xs">
                    <Sun size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Light</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Daylight crisp</p>
                  </div>
                  {theme === 'light' && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={10} />
                    </span>
                  )}
                </button>

                {/* Dark Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    toast.success('Switched to Dark theme');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'dark'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-11 w-11 rounded-xl bg-slate-900 dark:bg-[#07151e] text-teal-400 flex items-center justify-center border border-slate-700 dark:border-[#1a3d52] shadow-2xs">
                    <Moon size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Dark</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Night navy</p>
                  </div>
                  {theme === 'dark' && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={10} />
                    </span>
                  )}
                </button>

                {/* System Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setTheme('system');
                    toast.success('Theme set to match device system preference');
                  }}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border text-center transition-all cursor-pointer relative",
                    theme === 'system'
                      ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-500/40 text-teal-950 dark:text-teal-100 font-bold"
                      : "border-slate-200 dark:border-[#1a3d52] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#122b3b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#16364a]"
                  )}
                >
                  <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/80 dark:border-blue-800/40 shadow-2xs">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">System</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Match device</p>
                  </div>
                  {theme === 'system' && (
                    <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <Check size={10} />
                    </span>
                  )}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Theme changes apply immediately across the entire owner workspace and persist across browser sessions.
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Language Modal */}
      {activeModal === 'language' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 flex items-center justify-center shadow-2xs">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 font-display">System Language</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Supported workspace languages</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {/* Active language */}
              <div className="p-3.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/40 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">English (India & International)</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Indian numbering system (Lakhs/Crores) & DD/MM/YYYY formats</p>
                </div>
                <Check size={16} className="text-teal-600 dark:text-teal-400 shrink-0 ml-2" />
              </div>

              {/* Upcoming languages */}
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-2">Coming Soon</p>
                <div className="space-y-1.5 opacity-70">
                  {['Hindi (हिंदी)', 'Kannada (ಕನ್ನಡ)', 'Telugu (తెలుగు)', 'Tamil (தமிழ்)'].map(lang => (
                    <div key={lang} className="p-2.5 rounded-lg border border-slate-200 dark:border-[#1a3d52] bg-slate-50 dark:bg-[#122b3b] flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{lang}</span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Currency Modal */}
      {activeModal === 'currency' && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-2xs">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Billing Currency</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Authoritative currency for calculations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16364a] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">INR (₹) - Indian Rupee</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Authoritative currency for all hostel rents, electricity meters, and UPI QR codes.</p>
                </div>
                <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200 dark:border-[#1a3d52] text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                To maintain 100% calculation accuracy and regulatory compliance with Indian banking rails, all room dues, sub-meter tariffs, and student payment receipts are fixed in INR.
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Help & Support Modal */}
      {activeModal === 'help' && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-2xs">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Help & Support</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Contact HostelHub assistance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16364a] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Mail size={13} className="text-teal-600 dark:text-teal-400" /> Support Email
                </p>
                <p className="text-slate-600 dark:text-slate-300 select-all font-medium">support@hostelhub.in</p>
                <a
                  href="mailto:support@hostelhub.in?subject=HostelHub%20Owner%20Support%20Request"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 pt-1"
                >
                  <span>Open Mail App</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Phone size={13} className="text-teal-600 dark:text-teal-400" /> Owner Operations Helpline
                </p>
                <p className="text-slate-600 dark:text-slate-300 font-medium">+91 (080) 4567-8900</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Available Mon - Sat, 9:00 AM - 7:00 PM IST</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#122b3b] border border-slate-200/80 dark:border-[#1a3d52] space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">Electricity Sub-Meter Guidelines</p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Need help recording meter readings or allocating shared bills? Visit{' '}
                  <Link href="/owner/electricity/billing" onClick={() => setActiveModal(null)} className="text-teal-600 dark:text-teal-400 font-semibold underline">
                    Electricity Billing Overview
                  </Link>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Terms & Privacy Modal */}
      {activeModal === 'terms' && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-2xs">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Terms & Privacy</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Owner agreement & standards</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16364a] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">1. Property & Pricing Integrity</p>
                <p>
                  HostelHub provides property management and tenant allocation tools. By listing properties, owners agree to keep room pricing, availability, and electricity meter readings accurate and up to date.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">2. Student Data Protection & Privacy</p>
                <p>
                  All resident tenant records (names, phone numbers, parent details) are protected by strict Supabase Row-Level Security (RLS) policies. Owner access is strictly limited to tenants allocated to their own authorized hostels.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">3. Direct Payment Settlements</p>
                <p>
                  Payment transactions initiated via owner UPI IDs or bank accounts settle directly between student and owner. HostelHub does not escrow funds or charge commission on standard fee collections.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">4. Electricity Tariff Regulations</p>
                <p>
                  Owners agree to configure electricity rates in compliance with state electricity regulatory commission (SERC) limits without unlawful commercial markups.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 12. About HostelHub Modal */}
      {activeModal === 'about' && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md my-auto bg-white dark:bg-[#0e222e] border border-slate-200 dark:border-[#1a3d52] rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center shadow-2xs">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">About HostelHub</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Platform release details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16364a] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1a3d52]">
                <span className="text-slate-500 dark:text-slate-400">Application</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">HostelHub</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1a3d52]">
                <span className="text-slate-500 dark:text-slate-400">Version</span>
                <span className="font-bold text-teal-700 dark:text-teal-400">1.0.0 (Production Release)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1a3d52]">
                <span className="text-slate-500 dark:text-slate-400">Framework</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Next.js 14 App Router</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1a3d52]">
                <span className="text-slate-500 dark:text-slate-400">Database & Security</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Supabase Cloud + PostgreSQL RLS</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1a3d52]">
                <span className="text-slate-500 dark:text-slate-400">Notification Engine</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Brevo Transactional SMTP</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">System Status</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> All Services Operational
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1a3d52] bg-slate-50/80 dark:bg-[#0b1b25] shrink-0">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="h-9.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 cursor-pointer text-xs"
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