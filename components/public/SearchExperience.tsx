'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, IndianRupee, BedDouble } from 'lucide-react';

export default function SearchExperience() {
  const router = useRouter();
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [roomType, setRoomType] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (location.trim()) {
      router.push(`/find-hostel?search=${encodeURIComponent(location.trim())}`);
    } else {
      router.push('/find-hostel');
    }
  };

  return (
    <div className="relative -mt-6 sm:-mt-10 z-30 max-w-5xl mx-auto px-4 sm:px-6">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl shadow-teal-950/8 border border-slate-200/80">
        <div className="mb-4 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
              Find your ideal student accommodation
            </h2>
            <p className="text-xs text-slate-500">
              Verified hostel rooms near university campuses and coaching centers.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] bg-teal-50 px-3 py-1 rounded-full self-start border border-teal-200/60">
            Direct Owner Pricing • ₹0 Brokerage
          </span>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Location Field */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 hover:border-teal-500/50 focus-within:border-[#0F766E] focus-within:bg-white transition-all shadow-2xs">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Location / Area
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#0F766E] shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Kota, Bangalore, Jaipur..."
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Budget Field */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 hover:border-teal-500/50 focus-within:border-[#0F766E] focus-within:bg-white transition-all shadow-2xs">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Monthly Budget
            </label>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-[#0F766E] shrink-0" />
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">Any Budget</option>
                <option value="under_4000">Under ₹4,000 / mo</option>
                <option value="4000_7000">₹4,000 - ₹7,000 / mo</option>
                <option value="7000_plus">₹7,000+ / mo</option>
              </select>
            </div>
          </div>

          {/* Room Type Field */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 hover:border-teal-500/50 focus-within:border-[#0F766E] focus-within:bg-white transition-all shadow-2xs">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Room Configuration
            </label>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-[#0F766E] shrink-0" />
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">Any Room Type</option>
                <option value="single">Single Private Room</option>
                <option value="double">Double Sharing</option>
                <option value="triple">Triple / Multi Sharing</option>
              </select>
            </div>
          </div>

          {/* Submit Search Button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full h-[54px] rounded-2xl bg-[#0F766E] hover:bg-teal-800 text-white font-semibold text-sm shadow-md shadow-teal-900/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:ring-offset-2"
            >
              <Search className="h-4 w-4" />
              <span>Search Hostels</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
