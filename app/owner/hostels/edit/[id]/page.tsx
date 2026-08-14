'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

  if (loading) return <div className="p-20 text-center">Loading hostel details...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/owner/hostels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Edit Hostel</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl border-2 border-gray-100 shadow-xl space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Hostel Name
            </label>
            <input
              required
              type="text"
              className="input w-full"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Contact Email
            </label>
            <input
              required
              type="email"
              className="input w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            required
            className="input w-full h-24 py-3"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Contact Number
            </label>
            <input
              required
              type="tel"
              className="input w-full"
              value={formData.contact_number}
              onChange={(e) =>
                setFormData({ ...formData, contact_number: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Pincode
            </label>
            <input
              required
              type="text"
              className="input w-full"
              value={formData.pincode}
              onChange={(e) =>
                setFormData({ ...formData, pincode: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Full Address
          </label>
          <input
            required
            type="text"
            className="input w-full"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              City
            </label>
            <input
              required
              type="text"
              className="input w-full"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              State
            </label>
            <input
              required
              type="text"
              className="input w-full"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Amenities (Comma separated)
          </label>
          <input
            type="text"
            className="input w-full"
            value={formData.amenities}
            onChange={(e) =>
              setFormData({ ...formData, amenities: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Hostel Rules
          </label>
          <textarea
            className="input w-full h-24 py-3"
            value={formData.rules}
            onChange={(e) =>
              setFormData({ ...formData, rules: e.target.value })
            }
          />
        </div>

        <button
          disabled={saving}
          type="submit"
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg"
        >
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
