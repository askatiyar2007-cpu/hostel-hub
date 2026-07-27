'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import { Plus, Trash2, Edit2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface HostelData {
  id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  contact_number: string;
  email: string;
  rating: number;
  total_reviews: number;
}

export default function HostelsPage() {
  const { profile } = useAuth();
  const [hostels, setHostels] = useState<HostelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHostels();
  }, [profile]);

  const fetchHostels = async () => {
    try {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('owner_id', profile.id);

      if (error) throw error;
      setHostels(data || []);
    } catch (error) {
      toast.error('Failed to fetch hostels');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteHostel = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hostel?')) return;

    try {
      const { error } = await supabase
        .from('hostels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHostels(hostels.filter(h => h.id !== id));
      toast.success('Hostel deleted successfully');
    } catch (error) {
      toast.error('Failed to delete hostel');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Hostels</h1>
          <p className="text-muted-foreground mt-1">Manage your hostel properties</p>
        </div>
        <Link
          href="/owner/hostels/new"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Add Hostel</span>
        </Link>
      </div>

      {/* Hostels Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card skeleton h-64" />
          ))}
        </div>
      ) : hostels.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold">No hostels yet</h3>
          <p className="text-muted-foreground mt-2">Create your first hostel to get started</p>
          <Link href="/owner/hostels/new" className="btn-primary mt-4 inline-block">
            Create Hostel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hostels.map((hostel) => (
            <div key={hostel.id} className="card group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold line-clamp-1">{hostel.name}</h3>
                  <div className="flex items-center text-muted-foreground text-sm mt-1">
                    <MapPin size={16} />
                    <span className="ml-1">{hostel.city}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {hostel.description}
              </p>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <span className="font-semibold">{hostel.rating.toFixed(1)} ⭐</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reviews</span>
                  <span className="font-semibold">{hostel.total_reviews}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 flex items-center space-x-2">
                <Link
                  href={`/owner/hostels/${hostel.id}/edit`}
                  className="btn-secondary flex-1 flex items-center justify-center space-x-2"
                >
                  <Edit2 size={16} />
                  <span>Edit</span>
                </Link>
                <button
                  onClick={() => deleteHostel(hostel.id)}
                  className="btn-secondary text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Building2({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
