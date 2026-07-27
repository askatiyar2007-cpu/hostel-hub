'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { Hostel, Room } from '@/types/database';
import { MapPin, Star, Zap, Phone, Mail, Share2, Heart } from 'lucide-react';

export default function HostelDetailPage() {
  const { id } = useParams();
  const [hostel, setHostel] = useState<Hostel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHostelDetails = useCallback(async () => {
    try {
      const { data: hostelData, error: hostelError } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', id)
        .single();

      if (hostelError) throw hostelError;
      setHostel(hostelData);

      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('hostel_id', id)
        .eq('status', 'available');

      if (roomsError) throw roomsError;
      setRooms(roomsData || []);
    } catch (error) {
      console.error('Error fetching hostel details:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchHostelDetails();
  }, [id, fetchHostelDetails]);

  if (loading) return <div className="p-20 text-center">Loading...</div>;
  if (!hostel) return <div className="p-20 text-center text-red-500 font-bold text-2xl">Hostel Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Image */}
      <div className="relative h-[400px] bg-gray-900">
        {hostel.cover_image_url ? (
          <Image src={hostel.cover_image_url} alt={hostel.name} fill className="object-cover opacity-60" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-500 text-4xl">HostelHub Premium</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl font-bold text-white font-display mb-4">{hostel.name}</h1>
              <div className="flex items-center text-white/90 space-x-6">
                <span className="flex items-center"><MapPin size={20} className="mr-2" /> {hostel.city}, {hostel.state}</span>
                <span className="flex items-center"><Star size={20} className="mr-2 fill-amber-400 text-amber-400" /> {hostel.rating.toFixed(1)} ({hostel.total_reviews} reviews)</span>
              </div>
            </div>
            <div className="flex space-x-4">
              <button className="p-3 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"><Heart size={24} /></button>
              <button className="p-3 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"><Share2 size={24} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-12">
          {/* Description */}
          <section>
            <h2 className="text-2xl font-bold mb-4">About this Hostel</h2>
            <p className="text-gray-600 leading-relaxed text-lg">{hostel.description}</p>
          </section>

          {/* Amenities */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Amenities Offered</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {hostel.amenities.map((amenity, idx) => (
                <div key={idx} className="flex items-center space-x-3 text-gray-700 bg-white p-4 rounded-xl border border-gray-100">
                  <Zap size={20} className="text-blue-600" />
                  <span className="font-medium">{amenity}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Rooms */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Available Room Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rooms.map((room) => (
                <div key={room.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold capitalize">{room.room_type} Sharing</h3>
                    <span className="text-2xl font-bold text-blue-600">₹{room.rent}</span>
                  </div>
                  <ul className="space-y-2 mb-6 text-gray-500 text-sm">
                    <li>• Fully Furnished</li>
                    <li>• Attached Bathroom</li>
                    <li>• Daily Cleaning</li>
                  </ul>
                  <button className="btn-primary w-full py-3">Book This Room</button>
                </div>
              ))}
            </div>
          </section>

          {/* Rules */}
          <section className="bg-white p-8 rounded-2xl border border-gray-100">
            <h2 className="text-2xl font-bold mb-4">Hostel Rules</h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{hostel.rules}</p>
          </section>
        </div>

        {/* Right Column - Contact & Booking */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl sticky top-8">
            <h3 className="text-xl font-bold mb-6">Contact & Inquiries</h3>
            <div className="space-y-4">
              <a href={`tel:${hostel.contact_number}`} className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="p-3 bg-blue-600 text-white rounded-lg mr-4"><Phone size={20} /></div>
                <div>
                  <p className="text-xs text-gray-500">Call Now</p>
                  <p className="font-bold">{hostel.contact_number}</p>
                </div>
              </a>
              <a href={`mailto:${hostel.email}`} className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="p-3 bg-blue-600 text-white rounded-lg mr-4"><Mail size={20} /></div>
                <div>
                  <p className="text-xs text-gray-500">Email Us</p>
                  <p className="font-bold">{hostel.email}</p>
                </div>
              </a>
            </div>
            <hr className="my-8" />
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2">Want a visit?</h4>
              <p className="text-sm text-blue-800 mb-4">Schedule a free tour of the hostel with the owner today.</p>
              <button className="btn-primary w-full py-3">Schedule Visit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
