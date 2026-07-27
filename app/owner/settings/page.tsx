'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { User, Bell, Shield, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function OwnerSettingsPage() {
  const { profile } = useAuth();

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
          <button className="btn-secondary">Change Password</button>
        </section>
      </div>
    </div>
  );
}
