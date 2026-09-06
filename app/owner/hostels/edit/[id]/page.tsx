'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function EditHostelPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    pincode: '',
    address: '',
    contact_number: '',
    email: '',
    rules: '',
    amenities: ''
  });

  useEffect(() => {
    async function fetchHostel() {
      if (!id) return;
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast.error('Failed to fetch hostel details');
        router.push('/owner/hostels');
        return;
      }

      setFormData({
        name: data.name,
        description: data.description || '',
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        address: data.address,
        contact_number: data.contact_number || '',
        email: data.email || '',
        rules: data.rules || '',
        amenities: data.amenities ? data.amenities.join(', ') : ''
      });
      setLoading(false);
    }

    fetchHostel();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('hostels')
        .update({
          name: formData.name,
          description: formData.description,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          address: formData.address,
          contact_number: formData.contact_number,
          email: formData.email,
          rules: formData.rules,
          amenities: formData.amenities.split(',').map(s => s.trim()).filter(s => s !== '')
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Hostel updated successfully!');
      router.push('/owner/hostels');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading hostel details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/owner/hostels" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Hostel</h1>
        </div>
        <p className="text-gray-600 ml-10">Update hostel details and configuration.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Property Details */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hostel Name
              </label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white border-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Location */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Address
                </label>
                <Input
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <Input
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <Input
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <Input
                  required
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Description */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                About the Property
              </label>
              <textarea
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[120px]"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Amenities */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Amenities (comma separated)
              </label>
              <Input
                placeholder="AC, WiFi, Attached Washroom, Mess, Laundry"
                value={formData.amenities}
                onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                className="bg-white border-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. Rules */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rules</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hostel Rules & Regulations
              </label>
              <textarea
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[100px]"
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 6. Contact Information */}
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number
                </label>
                <Input
                  required
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  className="bg-white border-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/owner/hostels">
            <Button type="button" variant="outline" className="border-gray-300">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}