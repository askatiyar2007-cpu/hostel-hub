'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';

export default function AddHostelPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    city: '',
    area: '',
    state: '',
    pincode: '',
    address: '',
    contact_number: '',
    email: '',
    rules: '',
    amenities: '',
    starting_price: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id) {
      toast.error('User profile not found. Please log in again.');
      return;
    }
    setLoading(true);

    try {
      const payload = {
        owner_id: profile.user_id,
        name: formData.name,
        description: formData.description,
        city: formData.city,
        area: formData.area,
        state: formData.state,
        pincode: formData.pincode,
        address: formData.address,
        contact_number: formData.contact_number,
        email: formData.email,
        rules: formData.rules,
        amenities: formData.amenities.split(',').map(s => s.trim()).filter(s => s !== ''),
        starting_price: formData.starting_price ? parseFloat(formData.starting_price) : 0,
        rating: 0,
        total_reviews: 0,
        status: 'pending'
      };

      const { error } = await supabase.from('hostels').insert(payload);

      if (error) {
        throw error;
      }

      toast.success('Hostel added successfully!');
      router.push('/owner/hostels');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create hostel';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Add New Hostel
      </h1>

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
              placeholder="e.g. Blue Sky Residency"
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
              placeholder="hostel@example.com"
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
            placeholder="Tell us about your hostel..."
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
              placeholder="+91 9876543210"
              value={formData.contact_number}
              onChange={(e) =>
                setFormData({ ...formData, contact_number: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Starting Rent (per month)
            </label>
            <input
              required
              type="number"
              className="input w-full"
              placeholder="e.g. 5000"
              value={formData.starting_price}
              onChange={(e) =>
                setFormData({ ...formData, starting_price: e.target.value })
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
            placeholder="House No, Street, Landmark"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Area/Locality
            </label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Landmark Area"
              value={formData.area}
              onChange={(e) =>
                setFormData({ ...formData, area: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              City
            </label>
            <input
              required
              type="text"
              className="input w-full"
              placeholder="e.g. Kota"
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
              placeholder="e.g. Rajasthan"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Pincode
          </label>
          <input
            required
            type="text"
            className="input w-full"
            placeholder="324005"
            value={formData.pincode}
            onChange={(e) =>
              setFormData({ ...formData, pincode: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Amenities (Comma separated)
          </label>
          <input
            type="text"
            className="input w-full"
            placeholder="WiFi, AC, Food, Laundry"
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
            placeholder="Entry timings, Guest policy, etc."
            onChange={(e) =>
              setFormData({ ...formData, rules: e.target.value })
            }
          />
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg"
        >
          {loading ? 'Creating...' : 'Create Hostel Listing'}
        </button>
      </form>
    </div>
  );
}
