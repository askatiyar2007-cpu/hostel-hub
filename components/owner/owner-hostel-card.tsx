'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  ArrowRight, 
  MoreVertical, 
  Trash2, 
  Edit2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/owner/status-badge';

export interface OwnerHostelCardData {
  id: string;
  name: string;
  city: string;
  area?: string;
  state?: string;
  description?: string;
  cover_image_url?: string;
  status?: string;
  totalRooms: number;
  occupiedBeds: number;
  totalBeds?: number;
  availableBeds?: number;
  occupancy?: number;
  starting_price?: number | string;
}

interface OwnerHostelCardProps {
  hostel: OwnerHostelCardData;
  variant?: 'dashboard' | 'hostels-page';
  onDelete?: (id: string) => void;
}

export function OwnerHostelCard({ hostel, variant = 'dashboard', onDelete }: OwnerHostelCardProps) {
  const totalBeds = hostel.totalBeds ?? (hostel.occupiedBeds + (hostel.availableBeds ?? 0));
  const availableBeds = hostel.availableBeds ?? Math.max(0, totalBeds - hostel.occupiedBeds);
  const occupancyRate = hostel.occupancy ?? (totalBeds > 0 ? Math.round((hostel.occupiedBeds / totalBeds) * 100) : 0);

  const locationText = [hostel.city, hostel.area || hostel.state].filter(Boolean).join(', ');
  const hostelInitials = hostel.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'HH';

  return (
    <div className="group relative z-10 flex flex-col overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-[0_8px_30px_-4px_rgba(14,42,71,0.12),0_4px_12px_-2px_rgba(14,42,71,0.08)] hover:shadow-[0_16px_40px_-6px_rgba(14,42,71,0.16),0_6px_16px_-3px_rgba(14,42,71,0.1)] hover:border-sky-300 transition-all duration-200">
      {/* ========================================================================= */}
      {/* 1. MEDIA / IMAGE REGION                                                   */}
      {/* ========================================================================= */}
      <div className="relative h-36 sm:h-38 w-full overflow-hidden shrink-0 border-b border-sky-100/90 bg-slate-900 select-none">
        {hostel.cover_image_url ? (
          <Link
            href={`/owner/hostels/${hostel.id}`}
            className="block w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <img
              src={hostel.cover_image_url}
              alt={hostel.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
        ) : (
          <Link
            href={`/owner/hostels/${hostel.id}`}
            className="relative block w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 group/img bg-gradient-to-br from-slate-900 via-[#0d2a38] to-slate-800"
          >
            {/* Subtle architectural grid pattern */}
            <div 
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            />
            {/* Ambient decorative glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Elegant Monogram & Property Type Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center text-white transition-transform group-hover/img:scale-110">
                <span className="font-bold text-base tracking-wider font-display text-teal-300">
                  {hostelInitials}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-slate-300 text-[11px] font-medium tracking-wide">
                <Building2 className="h-3 w-3 text-teal-400" />
                <span>Hostel Property</span>
              </div>
            </div>
          </Link>
        )}

        {/* Status Badge in the top-right corner of the media region */}
        {hostel.status && hostel.status.toLowerCase() !== 'pending' && hostel.status.toLowerCase() !== 'approval pending' && (
          <div className="absolute top-3 right-3 z-20 drop-shadow-xs">
            <StatusBadge status={hostel.status} />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. BODY CONTENT                                                           */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {/* Title & Location Header */}
        <div className="mb-2">
          <Link
            href={`/owner/hostels/${hostel.id}`}
            className="block text-slate-900 hover:text-teal-700 transition-colors cursor-pointer"
          >
            <h3 className="font-bold text-lg font-display tracking-tight line-clamp-1">
              {hostel.name}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            <span className="truncate">{locationText || 'Location not specified'}</span>
          </div>
        </div>

        {/* Short Description */}
        {hostel.description ? (
          <p className="text-xs text-slate-500 line-clamp-1 mb-3.5 leading-relaxed">
            {hostel.description}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic mb-3.5">
            Active property management
          </p>
        )}

        {/* Room & Bed Statistics Row */}
        <div className="flex items-center justify-between mb-3.5 border-y border-slate-100 py-2.5">
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Rooms</span>
            <span className="text-sm font-bold text-slate-900">{hostel.totalRooms}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex flex-col min-w-0 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Residents</span>
            <span className="text-sm font-bold text-purple-700">{hostel.occupiedBeds}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex flex-col min-w-0 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Available</span>
            <span className="text-sm font-bold text-teal-700">{availableBeds}</span>
          </div>
        </div>

        {/* Occupancy Progress */}
        <div className="space-y-1.5 mb-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Occupancy Rate</span>
            <span className="font-bold text-teal-700">{occupancyRate}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
            />
          </div>
        </div>

        {/* Spacer pushes actions to card bottom */}
        <div className="flex-1" />

        {/* Card Footer: Starting Price / Rent & Action Buttons */}
        <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {hostel.starting_price ? 'Starting Price' : 'Beds Occupied'}
            </span>
            {hostel.starting_price ? (
              <p className="text-xs text-slate-600">
                <span className="text-slate-400 text-[11px] mr-1">from</span>
                <strong className="text-slate-900 font-bold text-sm">₹{Number(hostel.starting_price).toLocaleString('en-IN')}</strong>
                <span className="text-slate-500 font-normal ml-1">/ mo</span>
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                <strong className="text-slate-900 font-bold">{hostel.occupiedBeds}</strong>
                <span className="text-slate-400">/{totalBeds} beds</span>
              </p>
            )}
          </div>

          {variant === 'dashboard' ? (
            <Link href={`/owner/hostels/${hostel.id}`} className="block w-full">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-9 text-teal-700 hover:text-teal-800 hover:bg-teal-50/90 active:scale-95 font-semibold text-xs px-3 rounded-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500 transition-all flex items-center justify-center gap-1.5 group/btn border border-teal-200/50"
              >
                <span>View Details</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/owner/hostels/${hostel.id}`} className="flex-1">
                <Button 
                  size="sm" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-2xs h-9 px-3 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <span>View Hostel</span>
                  <ArrowRight size={13} />
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95 rounded-xl shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500" 
                    aria-label="More actions"
                  >
                    <MoreVertical size={15} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white border-slate-200 rounded-xl shadow-lg p-1 min-w-[140px]">
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    <Link href={`/owner/hostels/edit/${hostel.id}`} className="flex items-center gap-2">
                      <Edit2 size={13} className="text-slate-500" />
                      <span>Edit Hostel</span>
                    </Link>
                  </DropdownMenuItem>
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={() => onDelete(hostel.id)}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 size={13} className="text-rose-600" />
                      <span>Delete Hostel</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
