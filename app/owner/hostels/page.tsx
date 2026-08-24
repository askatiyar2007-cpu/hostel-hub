'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, MapPin, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth/context';
import { Hostel } from '@/types/database';

export default function HostelsListPage() {
  const { profile } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHostels = useCallback(async () => {
    if (!profile?.user_id) return;

    const { data } = await supabase
      .from('hostels')
      .select('*')
      .eq('owner_id', profile.user_id);

    setHostels((data as Hostel[]) || []);
    setLoading(false);
  }, [profile?.user_id]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hostel? This will also delete all rooms and assignments associated with it.')) return;

    try {
      const { error } = await supabase
        .from('hostels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Hostel deleted successfully');
      fetchHostels();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">
            Your Hostels
          </h1>

          <p className="mt-1 text-muted-foreground">
            Manage and monitor all your properties.
          </p>
        </div>

        <Link
          href="/owner/hostels/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
        >
          <Plus size={20} />
          <span>Add New Hostel</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Loading your hostels...</p>
          </div>
        </div>
      ) : hostels.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/40 py-20 text-center">
          <p className="text-lg text-muted-foreground">
            You haven&apos;t added any hostels yet.
          </p>

          <Link
            href="/owner/hostels/new"
            className="mt-2 inline-block font-semibold text-primary hover:underline"
          >
            Add your first hostel &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hostels.map((hostel) => (
            <div
              key={hostel.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md"
            >
              <div className="relative flex h-40 items-center justify-center border-b border-border bg-primary/5">
                <div className="text-primary/30 transition-transform group-hover:scale-110">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                    <path d="M10 6h4" />
                    <path d="M10 10h4" />
                  </svg>
                </div>

                <div className="absolute top-4 right-4 flex space-x-2">
                  <Link
                    href={`/owner/hostels/edit/${hostel.id}`}
                    className="rounded-lg bg-card/90 p-2 text-primary shadow-sm transition-all hover:bg-card"
                  >
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(hostel.id)}
                    className="rounded-lg bg-card/90 p-2 text-destructive shadow-sm transition-all hover:bg-card"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <h3 className="text-xl font-semibold font-display text-foreground">
                  {hostel.name}
                </h3>

                <div className="space-y-2">
                  <p className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <MapPin size={16} className="text-muted-foreground" />
                    <span>
                      {hostel.city}, {hostel.address}
                    </span>
                  </p>
                </div>

                {(hostel.rating > 0 || hostel.total_reviews > 0) && (
                  <p className="text-xs font-medium text-muted-foreground">
                    &#9733; {hostel.rating.toFixed(1)} &middot; {hostel.total_reviews} review{hostel.total_reviews === 1 ? '' : 's'}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {hostel.amenities?.slice(0, 3).map((a: string) => (
                    <span
                      key={a}
                      className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/owner/hostels/${hostel.id}`}
                  className="block rounded-xl bg-foreground py-3 text-center font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  Manage Hostel
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}