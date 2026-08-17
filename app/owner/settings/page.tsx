'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { User, Bell, Shield, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OwnerSettingsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || ''
  });
  const [loading, setLoading] = useState(false);

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
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and platform preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
            <User className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Profile Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input 
                type="text" 
                value={formData.full_name} 
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="input w-full" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" defaultValue={profile?.email} className="input w-full bg-gray-50" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
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
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
            <Bell className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">New Booking Alerts</p>
                <p className="text-sm text-gray-500">Get notified when a student books a room</p>
              </div>
              <input type="checkbox" defaultChecked className="toggle" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Complaint Notifications</p>
                <p className="text-sm text-gray-500">Get notified when a new complaint is filed</p>
              </div>
              <input type="checkbox" defaultChecked className="toggle" />
            </div>
          </div>
        </section>

        {/* Payment Settings */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
            <CreditCard className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Payment Methods</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Configure UPI, Bank details and QR codes to receive fees and deposits from students.</p>
          <Link href="/owner/settings/payment-methods" className="btn-secondary inline-block">
            Manage Payment Methods
          </Link>
        </section>

        {/* Security */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
            <Shield className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Security</h2>
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
          <div className="relative w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-600 h-5 w-5" /> Change Password
              </h4>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Current Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      router.push('/auth/forgot-password');
                    }}
                    className="text-xs text-blue-600 hover:underline font-medium bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot your current password?
                  </button>
                </div>
                <input 
                  type="password" 
                  required 
                  placeholder="Enter current password"
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  className="input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Min. 8 characters"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input 
                  type="password" 
                  required 
                  placeholder="Repeat new password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="input w-full"
                />
              </div>

              <div className="rounded-xl bg-gray-50 p-3 border border-gray-100 space-y-1 text-xs text-gray-500">
                <span className="font-bold text-gray-700 block uppercase text-[9px] tracking-wider font-display">Password Requirements</span>
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
