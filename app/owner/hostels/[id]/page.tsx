'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  MapPin,
  Users,
  Home,
  DollarSign,
  AlertCircle,
  Plus,
  Copy,
  Phone,
  Mail,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

    <div className="min-h-screen bg-card p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/owner/hostels" className="p-2 bg-card shadow-sm border border-border rounded-lg text-slate-600 hover:text-foreground transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">{hostel.name}</h1>
              <div className="flex items-center gap-2 text-foreground">
                <MapPin size={16} />
                <span className="text-sm">{hostel.city}, {hostel.state}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/owner/hostels/edit/${hostel.id}`}>Edit Details</Link>
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
              <Link href={`/owner/rooms/new?hostelId=${hostel.id}`}>
                <Plus size={16} className="mr-2" /> Add Room
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Rooms', value: stats.rooms, icon: Home, color: 'text-blue-600' },
            { label: 'Active Students', value: stats.students, icon: Users, color: 'text-indigo-600' },
            { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600' },
            { label: 'Pending Complaints', value: stats.complaints, icon: AlertCircle, color: 'text-rose-600' },
          ].map((stat, i) => (
            <Card key={i} className="border-border shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 opacity-20 ${stat.color}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">About Property</h3>
                <p className="text-foreground leading-relaxed">{hostel.description}</p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Amenities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {hostel.amenities?.map((a) => (
                    <div key={a} className="flex items-center gap-2 p-2 bg-card rounded border border-border">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-sm text-foreground">{a}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Contact</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Mail size={18} />
                    <span className="text-sm">{hostel.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone size={18} />
                    <span className="text-sm">{hostel.contact_number}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border bg-primary-900 text-foreground">
              <CardContent className="p-6">
                <h3 className="text-sm font-medium opacity-70 mb-2">Hostel Unique ID</h3>
                <div className="flex items-center justify-between">
                  <code className="text-lg font-mono">{hostel.id.slice(0, 12)}...</code>
                  <button onClick={() => { navigator.clipboard.writeText(hostel.id); toast.success('Copied'); }} className="p-2 hover:bg-primary-800 rounded-full transition-colors">
                    <Copy size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}