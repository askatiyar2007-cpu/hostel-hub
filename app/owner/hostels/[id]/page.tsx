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
  CheckCircle2,
  Download,
  Share2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hostel } from '@/types/database';
import { QRCodeCanvas } from 'qrcode.react';

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

  const handleCopyId = () => {
    if (hostel?.id) {
      navigator.clipboard.writeText(hostel.id);
      toast.success('Hostel ID copied to clipboard');
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById('hostel-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `hostel-${hostel?.name?.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR code downloaded');
    }
  };

  const handleShareQR = async () => {
    if (hostel?.id) {
      const publicUrl = `${window.location.origin}/hostels/${hostel.id}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: hostel.name,
            text: `View ${hostel.name} on HostelHub`,
            url: publicUrl
          });
          toast.success('Link shared successfully');
        } catch (err) {
          console.error('Share failed:', err);
        }
      } else {
        navigator.clipboard.writeText(publicUrl);
        toast.success('Public link copied to clipboard');
      }
    }
  };

  const getPublicHostelUrl = () => {
    if (hostel?.id) {
      return `${window.location.origin}/hostels/${hostel.id}`;
    }
    return '';
  };

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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/owner/hostels" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Hostels</span>
        </Link>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">{hostel.name}</h1>
            <div className="flex items-center gap-2 text-slate-600 mt-2">
              <MapPin size={16} className="text-teal-600" />
              <span className="text-sm">{hostel.city}, {hostel.state}</span>
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" asChild className="border-slate-200 text-slate-700 hover:bg-slate-50">
              <Link href={`/owner/hostels/edit/${hostel.id}`}>Edit Details</Link>
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" asChild>
              <Link href={`/owner/rooms/new?hostelId=${hostel.id}`}>
                <Plus size={16} className="mr-2" /> Add Room
              </Link>
            </Button>
          </div>
        </div>

        {/* Hero Image */}
        {hostel.cover_image_url && (
          <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-6 border border-sky-200/80 shadow-sm">
            <img
              src={hostel.cover_image_url}
              alt={hostel.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Property Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Rooms', value: stats.rooms, icon: Home, color: 'text-blue-600' },
                { label: 'Active Students', value: stats.students, icon: Users, color: 'text-indigo-600' },
                { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600' },
                { label: 'Pending Complaints', value: stats.complaints, icon: AlertCircle, color: 'text-rose-600' },
              ].map((stat, i) => (
                <Card key={i} className="border border-sky-100/90 bg-white shadow-xs">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <stat.icon className={`w-6 h-6 mb-2 opacity-30 ${stat.color}`} />
                    <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                    <p className="text-xl font-bold mt-1 text-slate-900">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* About Property */}
            <Card className="border border-sky-100/90 bg-white shadow-xs">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">About Property</h3>
                <p className="text-slate-600 leading-relaxed">{hostel.description}</p>
              </CardContent>
            </Card>

            {/* Amenities */}
            <Card className="border border-sky-100/90 bg-white shadow-xs">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Amenities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {hostel.amenities?.map((a) => (
                    <div key={a} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                      <span className="text-sm text-slate-700">{a}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Contact */}
            <Card className="border border-sky-100/90 bg-white shadow-xs">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Contact</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail size={18} className="text-teal-600" />
                    <span className="text-sm">{hostel.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone size={18} className="text-teal-600" />
                    <span className="text-sm">{hostel.contact_number}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Hostel ID & QR */}
          <div className="space-y-6">
            {/* Hostel ID Card */}
            <Card className="border border-sky-100/90 bg-white shadow-xs">
              <CardContent className="p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Hostel ID</h3>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-3">
                  <code className="text-xs font-mono text-slate-700 break-all">{hostel.id}</code>
                </div>
                <Button
                  onClick={handleCopyId}
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={14} className="mr-2" />
                  Copy ID
                </Button>
              </CardContent>
            </Card>

            {/* QR Code Card */}
            <Card className="border border-sky-100/90 bg-white shadow-xs">
              <CardContent className="p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">QR Code</h3>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <QRCodeCanvas
                      id="hostel-qr-canvas"
                      value={getPublicHostelUrl()}
                      size={180}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center">
                    Scan to view this hostel on HostelHub
                  </p>
                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={handleDownloadQR}
                      variant="outline"
                      size="sm"
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Download size={14} className="mr-2" />
                      Download
                    </Button>
                    <Button
                      onClick={handleShareQR}
                      variant="outline"
                      size="sm"
                      className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Share2 size={14} className="mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}