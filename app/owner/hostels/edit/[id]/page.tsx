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
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center space-x-4">
        <Link href="/owner/hostels" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">Edit Hostel</h1>
      </div>

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
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
            <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
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
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Hostel Rules
          </label>
          <textarea
            className="input h-24 w-full py-3"
            value={formData.rules}
            onChange={(e) =>
              setFormData({ ...formData, rules: e.target.value })
            }
          />
        </div>

        <button
          disabled={saving}
          type="submit"
          className="w-full rounded-full bg-primary p-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}