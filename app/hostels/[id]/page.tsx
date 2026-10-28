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
  ArrowRight,
  Bed,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
          router.push('/find-hostel');
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
        router.push('/find-hostel');
      } finally {
        setLoading(false);
      }
    }

    fetchHostel();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFCFB] dark:bg-[#07131d]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading hostel details…</p>
        </div>
      </div>
    );
  }

  if (!hostel) {
    return null;
  }

  const hasContact = Boolean(hostel.contact_number || hostel.email);
  const hasAmenities = Array.isArray(hostel.amenities) && hostel.amenities.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFCFB] dark:bg-[#07131d] text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Navigation Breadcrumb */}
        <Link
          href="/find-hostel"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition-colors mb-5 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Browse Hostels</span>
        </Link>

        {/* Cover Image */}
        {hostel.cover_image_url && (
          <div className="relative w-full h-56 sm:h-72 md:h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs mb-6">
            <img
              src={hostel.cover_image_url}
              alt={hostel.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Hostel Header Info */}
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {hostel.name}
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <span>
              {hostel.city}{hostel.state ? `, ${hostel.state}` : ''}{hostel.address ? ` · ${hostel.address}` : ''}
            </span>
          </div>
          {hostel.description && (
            <p className="pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {hostel.description}
            </p>
          )}
        </div>

        {/* Key Statistics Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-3.5 sm:p-4 text-center shadow-2xs">
            <Home className="w-5 h-5 mx-auto mb-1.5 text-teal-600 dark:text-teal-400" />
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.rooms}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rooms</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-3.5 sm:p-4 text-center shadow-2xs">
            <Users className="w-5 h-5 mx-auto mb-1.5 text-teal-600 dark:text-teal-400" />
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.students}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Residents</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-3.5 sm:p-4 text-center shadow-2xs">
            <Bed className="w-5 h-5 mx-auto mb-1.5 text-teal-600 dark:text-teal-400" />
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats.availableBeds}{stats.hasUnknownAvailability ? '+' : ''}
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available Beds</p>
          </div>
        </div>

        {/* Rooms & Availability Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Rooms & Availability</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live room occupancy and bed vacancy</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              stats.hasUnknownAvailability
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                : stats.availableBeds === 0
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900/50'
            }`}>
              {stats.hasUnknownAvailability
                ? stats.availableBeds > 0
                  ? `${stats.availableBeds}+ beds available (partial live check)`
                  : 'Live check pending'
                : stats.availableBeds === 0
                ? 'Hostel currently full'
                : `${stats.availableBeds} ${stats.availableBeds === 1 ? 'bed' : 'beds'} available`}
            </span>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0e222e]">
              <Bed className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No rooms listed yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Check back later or contact the owner for availability.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {rooms.map((room) => {
                const isFull = room.availabilityStatus === 'full';
                const isUnknown = room.availabilityStatus === 'unknown';
                return (
                  <div
                    key={room.id}
                    className={`rounded-2xl border bg-white dark:bg-[#0e222e] p-4 sm:p-5 flex flex-col justify-between transition-all ${
                      isFull
                        ? 'border-slate-200 dark:border-slate-800/80 opacity-70'
                        : isUnknown
                        ? 'border-amber-200/80 dark:border-amber-900/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700/80 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                              Room {room.room_number}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md capitalize font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {room.type || room.room_type || 'Standard'}
                            </span>
                          </div>
                          {room.floor !== null && room.floor !== undefined && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Floor {room.floor}</p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                            isFull
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                              : isUnknown
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                          }`}
                        >
                          {isFull
                            ? 'Full'
                            : isUnknown
                            ? 'Unverified'
                            : `${room.availableBeds} ${room.availableBeds === 1 ? 'bed' : 'beds'} left`}
                        </span>
                      </div>

                      {isUnknown && (
                        <div className="flex items-start gap-1.5 mb-3 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl px-2.5 py-2 border border-amber-200/60 dark:border-amber-900/40">
                          <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <span>Live availability unverified. You can still apply; capacity is confirmed upon review.</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400 dark:text-slate-500">Rent</p>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                          ₹{(Number(room.rent) || 0).toLocaleString('en-IN')}
                          <span className="text-xs font-normal text-slate-400 dark:text-slate-500"> /mo</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={isFull}
                        className={
                          isFull
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700 shadow-none'
                            : 'bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-none rounded-xl px-4'
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
        </div>

        {/* Amenities & Contact Sections (Integrated 2-column grid) */}
        {(hasAmenities || hasContact) && (
          <div className={`grid gap-3.5 mb-6 ${hasAmenities && hasContact ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {hasAmenities && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hostel.amenities.map((amenity: string) => (
                    <span
                      key={amenity}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5"
                    >
                      <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasContact && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e222e] p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Contact Details
                </h3>
                <div className="space-y-2.5">
                  {hostel.contact_number && (
                    <a
                      href={`tel:${hostel.contact_number}`}
                      className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                    >
                      <Phone size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                      <span>{hostel.contact_number}</span>
                    </a>
                  )}
                  {hostel.email && (
                    <a
                      href={`mailto:${hostel.email}`}
                      className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors truncate"
                    >
                      <Mail size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate">{hostel.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Refined Request a Room CTA */}
        <div className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Interested in this property?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Submit a booking request to hold your bed and connect with the owner.
            </p>
          </div>
          <Button
            className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl h-9 px-4.5 shadow-none transition-colors"
            onClick={() => router.push(`/student/room-request?hostel=${hostel.id}`)}
          >
            Request a Room
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
