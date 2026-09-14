'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  MapPin,
  Users,
  Home,
  Phone,
  Mail,
  ArrowLeft,
  Bed,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PublicHostelPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [hostel, setHostel] = useState<any>(null);
  const [stats, setStats] = useState({
    rooms: 0,
    students: 0,
    availableBeds: 0
  });

  useEffect(() => {
    async function fetchHostel() {
      if (!id) return;

      try {
        const { data: hostelData, error: hostelError } = await supabase
          .from('hostels')
          .select('*')
          .eq('id', id)
          .eq('status', 'active')
          .single();

        if (hostelError || !hostelData) {
          toast.error('Hostel not found or not available');
          router.push('/');
          return;
        }

        setHostel(hostelData);

        // Fetch stats
        const { count: roomsCount } = await supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true })
          .eq('hostel_id', id);

        const { count: studentsCount } = await supabase
          .from('room_allocations')
          .select('*', { count: 'exact', head: true })
          .eq('hostel_id', id)
          .eq('active', true);

        const { data: roomsData } = await supabase
          .from('rooms')
          .select('capacity')
          .eq('hostel_id', id);

        const totalBeds = roomsData?.reduce((sum: number, r: any) => sum + (r.capacity || 0), 0) || 0;
        const availableBeds = Math.max(0, totalBeds - (studentsCount || 0));

        setStats({
          rooms: roomsCount || 0,
          students: studentsCount || 0,
          availableBeds
        });
      } catch (error) {
        console.error('Error fetching hostel:', error);
        toast.error('Failed to load hostel details');
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    fetchHostel();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm text-slate-600">Loading hostel...</p>
        </div>
      </div>
    );
  }

  if (!hostel) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">HostelHub</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Hero Image */}
        {hostel.cover_image_url && (
          <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <img
              src={hostel.cover_image_url}
              alt={hostel.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Hostel Info */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{hostel.name}</h2>
            <div className="flex items-center gap-2 text-slate-600 mb-4">
              <MapPin size={16} className="text-teal-600" />
              <span className="text-sm">{hostel.city}, {hostel.state}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">{hostel.description}</p>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <Home className="w-6 h-6 mx-auto mb-2 text-teal-600" />
              <p className="text-2xl font-bold text-slate-900">{stats.rooms}</p>
              <p className="text-xs text-slate-500">Rooms</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-teal-600" />
              <p className="text-2xl font-bold text-slate-900">{stats.students}</p>
              <p className="text-xs text-slate-500">Students</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <Bed className="w-6 h-6 mx-auto mb-2 text-teal-600" />
              <p className="text-2xl font-bold text-slate-900">{stats.availableBeds}</p>
              <p className="text-xs text-slate-500">Available</p>
            </CardContent>
          </Card>
        </div>

        {/* Amenities */}
        {hostel.amenities && hostel.amenities.length > 0 && (
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {hostel.amenities.map((amenity: string) => (
                  <div key={amenity} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
                    <CheckCircle2 size={16} className="text-teal-600" />
                    <span className="text-sm text-slate-700">{amenity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-600">
                <Phone size={18} className="text-teal-600" />
                <span className="text-sm">{hostel.contact_number}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Mail size={18} className="text-teal-600" />
                <span className="text-sm">{hostel.email}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 text-center">
            <p className="text-slate-600 mb-4">Interested in this hostel?</p>
            <Button 
              className="bg-teal-600 hover:bg-teal-700 text-white w-full md:w-auto"
              onClick={() => router.push('/student/room-request')}
            >
              Request a Room
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
