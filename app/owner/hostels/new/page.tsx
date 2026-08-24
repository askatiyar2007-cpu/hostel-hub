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
    amenities: ''
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">
        Add New Hostel
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Description
          </label>
          <textarea
            required
            className="input h-24 w-full py-3"
            placeholder="Tell us about your hostel..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Hostel Rules
          </label>
          <textarea
            className="input h-24 w-full py-3"
            placeholder="Entry timings, Guest policy, etc."
            onChange={(e) =>
              setFormData({ ...formData, rules: e.target.value })
            }
          />
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-full bg-primary p-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create Hostel Listing'}
        </button>
      </form>
    </div>
  );
}