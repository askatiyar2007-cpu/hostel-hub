'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  MapPin, 
  Users, 
  Home, 
  DollarSign, 
  AlertCircle,
  Plus,
  Copy
} from 'lucide-react';
import Link from 'next/link';

import { Hostel } from '@/types/database';

export default function HostelDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [stats, setStats] = useState({
    rooms: 0,
    students: 0,
    revenue: 0,
    complaints: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      // Fetch hostel basic info
      const { data: hostelData, error: hostelError } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', id)
        .single();

      if (hostelError) {
        toast.error('Failed to fetch hostel details');
        router.push('/owner/hostels');
        return;
      }
      setHostel(hostelData as Hostel);

      // Fetch Stats
      const { count: roomsCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('hostel_id', id);

      const { count: studentsCount } = await supabase
        .from('room_allocations')
        .select('*', { count: 'exact', head: true })
        .eq('hostel_id', id)
        .eq('active', true);

      const { data: revData } = await supabase
        .from('bills')
        .select('amount')
        .eq('status', 'paid')
        .eq('hostel_id', id);

      const { count: complaintsCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('hostel_id', id)
        .eq('status', 'open');

      const totalRev = revData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

      setStats({
        rooms: roomsCount || 0,
        students: studentsCount || 0,
        revenue: totalRev,
        complaints: complaintsCount || 0
      });

      setLoading(false);
    }

    fetchData();
  }, [id, router]);

  if (loading || !hostel) return <div className="p-20 text-center">Loading hostel info...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/owner/hostels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{hostel.name}</h1>
            <p className="text-gray-500 flex items-center mt-1 text-sm">
              <MapPin size={16} className="mr-1" />
              {hostel.address}, {hostel.city}
            </p>
            <div className="flex items-center gap-2 mt-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold w-fit border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
              <span className="text-blue-500 uppercase tracking-wider font-bold">HOSTEL ID:</span>
              <code className="font-mono">{hostel.id}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(hostel.id);
                  toast.success('Hostel ID copied');
                }}
                className="hover:text-blue-900 dark:hover:text-blue-100 p-0.5"
                title="Copy ID to Clipboard"
              >
                <Copy size={12} className="ml-1 inline" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <Link href={`/owner/hostels/edit/${hostel.id}`} className="btn-secondary px-6">
            Edit Details
          </Link>
          <Link href={`/owner/rooms/new?hostelId=${hostel.id}`} className="btn-primary flex items-center space-x-2">
            <Plus size={20} />
            <span>Add Room</span>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatItem icon={<Home size={24} />} label="Total Rooms" value={stats.rooms} color="text-blue-600" bg="bg-blue-50" />
        <StatItem icon={<Users size={24} />} label="Active Students" value={stats.students} color="text-emerald-600" bg="bg-emerald-50" />
        <StatItem icon={<DollarSign size={24} />} label="Hostel Revenue" value={`₹${stats.revenue}`} color="text-amber-600" bg="bg-amber-50" />
        <StatItem icon={<AlertCircle size={24} />} label="Open Complaints" value={stats.complaints} color="text-rose-600" bg="bg-rose-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* About Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold mb-4">About the Hostel</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{hostel.description}</p>
            
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-gray-900 mb-2">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {hostel.amenities?.map((a: string) => (
                    <span key={a} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-2">Hostel Rules</h4>
                <p className="text-gray-600 text-sm italic">{hostel.rules || 'No specific rules mentioned.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Email</p>
                <p className="font-medium">{hostel.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Phone</p>
                <p className="font-medium">{hostel.contact_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Pincode</p>
                <p className="font-medium">{hostel.pincode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

function StatItem({ icon, label, value, color, bg }: StatItemProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center space-x-4">
      <div className={`${bg} ${color} p-3 rounded-xl`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
