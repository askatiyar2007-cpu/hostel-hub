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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Your Hostels
          </h1>

          <p className="text-gray-500 mt-1">
            Manage and monitor all your properties.
          </p>
        </div>

        <Link
          href="/owner/hostels/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center space-x-2 hover:bg-blue-700 font-bold shadow-lg transition-all"
        >
          <Plus size={20} />
          <span>Add New Hostel</span>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">
          Loading your hostels...
        </div>
      ) : hostels.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-lg">
            You haven&apos;t added any hostels yet.
          </p>

          <Link
            href="/owner/hostels/new"
            className="text-blue-600 font-bold mt-2 inline-block hover:underline"
          >
            Add your first hostel →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hostels.map((hostel) => (
            <div
              key={hostel.id}
              className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all group"
            >
              <div className="h-40 bg-blue-50 flex items-center justify-center border-b border-gray-100 relative">
                <div className="text-blue-200 group-hover:scale-110 transition-transform">
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
                    className="p-2 bg-white/80 hover:bg-white text-blue-600 rounded-lg shadow-sm transition-all"
                  >
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(hostel.id)}
                    className="p-2 bg-white/80 hover:bg-white text-red-600 rounded-lg shadow-sm transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {hostel.name}
                </h3>

                <div className="space-y-2">
                  <p className="text-gray-500 text-sm flex items-center space-x-2">
                    <MapPin size={16} className="text-gray-400" />
                    <span>
                      {hostel.city}, {hostel.address}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {hostel.amenities?.slice(0, 3).map((a: string) => (
                    <span
                      key={a}
                      className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/owner/hostels/${hostel.id}`}
                  className="block text-center bg-gray-900 text-white py-3 rounded-xl hover:bg-gray-800 font-bold transition-colors"
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