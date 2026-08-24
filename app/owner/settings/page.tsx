'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { User, Bell, Shield, CreditCard, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OwnerSettingsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Independent show/hide toggles per password field -- purely a UI
  // addition, does not touch handleChangePassword's verify/update logic.
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || ''
  });
  const [loading, setLoading] = useState(false);

  // Notification preferences, persisted via Supabase Auth user_metadata --
  // the same mechanism already used by app/student/settings/page.tsx for its
  // notification toggles. Default to true (matching the previous
  // defaultChecked behavior) when the preference has never been saved.
  const [notifyRoomRequests, setNotifyRoomRequests] = useState(true);
  const [notifyComplaints, setNotifyComplaints] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      setNotifyRoomRequests(user.user_metadata.notify_room_requests !== false);
      setNotifyComplaints(user.user_metadata.notify_complaints !== false);
    }
  }, [user]);

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          notify_room_requests: notifyRoomRequests,
          notify_complaints: notifyComplaints
        }
      });
      if (error) throw error;
      toast.success('Notification preferences saved!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences';
      toast.error(message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Profile updated successfully!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
        email: profile?.email || '',
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and platform preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <section className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-border">
            <User className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-foreground">Profile Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <input 
                type="text" 
                value={formData.full_name} 
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="input w-full" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
              <input type="email" defaultValue={profile?.email} className="input w-full bg-muted" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
              <input 
                type="text" 
                value={formData.phone_number} 
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                className="input w-full" 
              />
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="mt-6 btn-primary"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </section>

        {/* Notifications */}
        <section className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-border">
            <Bell className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-foreground">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">New Booking Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified when a student books a room</p>
              </div>
              <input
                type="checkbox"
                checked={notifyRoomRequests}
                onChange={(e) => setNotifyRoomRequests(e.target.checked)}
                className="h-5 w-10 appearance-none bg-muted rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-primary before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-5.5 border border-border"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Complaint Notifications</p>
                <p className="text-sm text-muted-foreground">Get notified when a new complaint is filed</p>
              </div>
              <input
                type="checkbox"
                checked={notifyComplaints}
                onChange={(e) => setNotifyComplaints(e.target.checked)}
                className="h-5 w-10 appearance-none bg-muted rounded-full relative cursor-pointer outline-none transition-all duration-300 checked:bg-primary before:content-[''] before:h-4 before:w-4 before:rounded-full before:bg-white before:absolute before:top-0.5 before:left-0.5 before:transition-all before:duration-300 checked:before:left-5.5 border border-border"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={savePreferences}
                disabled={savingPrefs}
                className="btn-primary"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </section>

        {/* Payment Settings */}
        <section className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-border">
            <CreditCard className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-foreground">Payment Methods</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Configure UPI, Bank details and QR codes to receive fees and deposits from students.</p>
          <Link href="/owner/settings/payment-methods" className="btn-secondary inline-block">
            Manage Payment Methods
          </Link>
        </section>

        {/* Security */}
        <section className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-border">
            <Shield className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-foreground">Security</h2>
          </div>
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="btn-secondary"
          >
            Change Password
          </button>
        </section>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Shield className="text-primary h-5 w-5" /> Change Password
              </h4>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-muted-foreground hover:text-foreground text-xl font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-foreground">Current Password</label>
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
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showOldPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-muted p-3 border border-border space-y-1 text-xs text-muted-foreground">
                <span className="font-bold text-foreground block uppercase text-[9px] tracking-wider font-display">Password Requirements</span>
                <p className="flex items-center gap-1.5">
                  • Minimum 8 characters
                </p>
                <p className="flex items-center gap-1.5">
                  • Numbers, symbols, and uppercase letters recommended
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={verifyingPassword} className="btn-primary px-5 font-semibold">
                  {verifyingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}