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

  if (loading || !hostel) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading hostel info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/owner/hostels" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl font-display text-foreground">{hostel.name}</h1>
            <p className="mt-1 flex items-center text-sm text-muted-foreground">
              <MapPin size={16} className="mr-1" />
              {hostel.address}, {hostel.city}
            </p>
            <div className="mt-2 flex w-fit items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="font-bold uppercase tracking-wider text-primary/80">HOSTEL ID:</span>
              <code className="font-mono">{hostel.id}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(hostel.id);
                  toast.success('Hostel ID copied');
                }}
                className="p-0.5 hover:text-primary/60"
                title="Copy ID to Clipboard"
              >
                <Copy size={12} className="ml-1 inline" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <Link href={`/owner/hostels/edit/${hostel.id}`} className="inline-flex items-center rounded-full border border-border bg-card px-6 py-2.5 font-semibold text-foreground shadow-sm transition-all hover:bg-muted">
            Edit Details
          </Link>
          <Link href={`/owner/rooms/new?hostelId=${hostel.id}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.02] hover:shadow-lg">
            <Plus size={20} />
            <span>Add Room</span>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatItem icon={<Home size={24} />} label="Total Rooms" value={stats.rooms} color="text-primary" bg="bg-primary/10" />
        <StatItem icon={<Users size={24} />} label="Active Students" value={stats.students} color="text-emerald-600" bg="bg-emerald-50" />
        <StatItem icon={<DollarSign size={24} />} label="Hostel Revenue" value={`₹${stats.revenue}`} color="text-amber-600" bg="bg-amber-50" />
        <StatItem icon={<AlertCircle size={24} />} label="Open Complaints" value={stats.complaints} color="text-rose-600" bg="bg-rose-50" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* About Section */}
        <div className="space-y-8 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-semibold font-display text-foreground">About the Hostel</h3>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{hostel.description}</p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div>
                <h4 className="mb-2 font-semibold text-foreground">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {hostel.amenities?.map((a: string) => (
                    <span key={a} className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 font-semibold text-foreground">Hostel Rules</h4>
                <p className="text-sm italic text-muted-foreground">{hostel.rules || 'No specific rules mentioned.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h3 className="mb-6 text-xl font-semibold font-display text-foreground">Contact Information</h3>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{hostel.email}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{hostel.contact_number}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Pincode</p>
                <p className="font-medium text-foreground">{hostel.pincode}</p>
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
    <div className="flex items-center space-x-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className={`${bg} ${color} rounded-xl p-3`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold font-display text-foreground">{value}</p>
      </div>
    </div>
  );
}