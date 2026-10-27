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
import { calculateHostelOccupancy } from '@/lib/utils/occupancy';

export default function PublicHostelPage() {
  const router = useRouter();
  const rawId = useParams()?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId ? String(rawId).trim().replace(/\/+$/, '') : '');
  const [loading, setLoading] = useState(true);
  const [hostel, setHostel] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [stats, setStats] = useState({
    rooms: 0,
    students: 0,
    availableBeds: 0,
    hasUnknownAvailability: false,
  });

  useEffect(() => {
    async function fetchHostel() {
      if (!id) return;

      try {
        // Query hostel by ID without status restriction so all registered hostels work
        const { data: hostelData, error: hostelError } = await supabase
          .from('hostels')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (hostelError || !hostelData) {
          console.warn('Hostel lookup returned no data:', hostelError);
          toast.error('Hostel not found');
          router.push('/');
          return;
        }

        setHostel(hostelData);

        // Fetch rooms
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .eq('hostel_id', id)
          .order('room_number', { ascending: true });

        if (roomsError) {
          console.error('Error fetching rooms:', roomsError);
        }

        // Compute authoritative room occupancy using get_room_actual_occupancy RPC.
        // If the RPC fails or returns an invalid/null result, do NOT silently present
        // a potentially stale fallback count as confirmed live availability.
        const roomsWithRealOccupancy = await Promise.all(
          (roomsData ?? []).map(async (room: any) => {
            const cap = Math.max(0, room.capacity ?? 1);
            let availabilityStatus: 'available' | 'full' | 'unknown' = 'unknown';
            let realOccupied: number | null = null;
            let freeBeds: number | null = null;

            try {
              const { data: rpcOccupied, error: rpcErr } = await supabase.rpc('get_room_actual_occupancy', {
                p_room_id: room.id,
              });

              const isValidRpcNumber = !rpcErr && rpcOccupied !== null && rpcOccupied !== undefined && !isNaN(Number(rpcOccupied));

              if (isValidRpcNumber) {
                realOccupied = Math.max(0, Math.min(cap, Number(rpcOccupied)));
                freeBeds = Math.max(0, cap - realOccupied);
                availabilityStatus = freeBeds <= 0 ? 'full' : 'available';
              } else {
                console.warn(`[get_room_actual_occupancy] RPC returned invalid/null result for room ${room.id}:`, rpcErr || rpcOccupied);
                availabilityStatus = 'unknown';
              }
            } catch (err) {
              console.error(`[get_room_actual_occupancy] Exception for room ${room.id}:`, err);
              availabilityStatus = 'unknown';
            }

            return {
              ...room,
              occupancy: realOccupied,
              occupied_beds: realOccupied,
              occupied_count: realOccupied,
              availableBeds: freeBeds,
              isFull: availabilityStatus === 'full',
              availabilityStatus,
            };
          })
        );

        setRooms(roomsWithRealOccupancy);

        const confirmedRooms = roomsWithRealOccupancy.filter((r) => r.availabilityStatus !== 'unknown');
        const hasUnknown = roomsWithRealOccupancy.some((r) => r.availabilityStatus === 'unknown');

        const hostelOcc = calculateHostelOccupancy(confirmedRooms);

        setStats({
          rooms: roomsWithRealOccupancy.length,
          students: hostelOcc.occupiedBeds,
          availableBeds: hostelOcc.availableBeds,
          hasUnknownAvailability: hasUnknown,
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

        {/* Rooms & Availability */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Rooms & Availability</h3>
                <p className="text-xs text-slate-500">Live room occupancy and bed status</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                stats.hasUnknownAvailability
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}>
                {stats.hasUnknownAvailability
                  ? stats.availableBeds > 0
                    ? `${stats.availableBeds}+ beds available (partial live check)`
                    : 'Availability check pending'
                  : `${stats.availableBeds} beds available`}
              </span>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Bed className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No rooms listed yet</p>
                <p className="text-xs text-slate-500 mt-1">Check back later or contact the hostel owner directly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rooms.map((room) => {
                  const isFull = room.availabilityStatus === 'full';
                  const isUnknown = room.availabilityStatus === 'unknown';
                  return (
                    <div
                      key={room.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isFull
                          ? 'border-slate-200 bg-slate-50/60 opacity-80'
                          : isUnknown
                          ? 'border-amber-200/80 bg-amber-50/20'
                          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">Room {room.room_number}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium bg-slate-100 text-slate-700">
                              {room.type || room.room_type || 'Standard'}
                            </span>
                          </div>
                          {room.floor !== null && room.floor !== undefined && (
                            <p className="text-xs text-slate-500 mt-0.5">Floor {room.floor}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            isFull
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isUnknown
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isFull
                            ? 'Full'
                            : isUnknown
                            ? 'Live check unavailable'
                            : `${room.availableBeds} beds left`}
                        </span>
                      </div>

                      {isUnknown && (
                        <p className="text-[11px] text-amber-700/90 mt-1 mb-2">
                          Live availability could not be verified. You can still submit a request; capacity will be checked automatically upon review.
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-500">Rent per student</p>
                          <p className="text-sm font-bold text-slate-900">
                            ₹{(Number(room.rent) || 0).toLocaleString('en-IN')}
                            <span className="text-xs font-normal text-slate-500"> / mo</span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={isFull}
                          className={
                            isFull
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-teal-600 hover:bg-teal-700 text-white'
                          }
                          onClick={() => router.push(`/student/room-request?hostel=${hostel.id}&room=${room.id}`)}
                        >
                          {isFull ? 'Occupied' : 'Select Room'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
