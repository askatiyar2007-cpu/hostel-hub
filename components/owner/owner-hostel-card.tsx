'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  Bed, 
  Users, 
  DoorOpen, 
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

  return (
    <div className="group relative z-10 flex flex-col overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-[0_8px_30px_-4px_rgba(14,42,71,0.12),0_4px_12px_-2px_rgba(14,42,71,0.08)] hover:shadow-[0_16px_40px_-6px_rgba(14,42,71,0.16),0_6px_16px_-3px_rgba(14,42,71,0.1)] hover:border-sky-300 transition-all duration-200">
      {/* ========================================================================= */}
      {/* 1. MEDIA / IMAGE REGION (Strictly Bounded, Never Bleeds Outside)          */}
      {/* ========================================================================= */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden shrink-0 border-b border-sky-100/90 bg-slate-50 select-none">
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
            className="relative block w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 group/img"
          >
            {/* Restrained Architectural SVG Illustration strictly bounded inside this container */}
            <svg
              viewBox="0 0 400 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMax slice"
              className="w-full h-full absolute inset-0 pointer-events-none"
            >
              <defs>
                <linearGradient id={`hostelSky-${hostel.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dbeafe" />
                  <stop offset="55%" stopColor="#eff6ff" />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>
                <linearGradient id={`hostelFacade-${hostel.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#e2e8f0" />
                </linearGradient>
              </defs>

              {/* Soft daylight sky */}
              <rect width="400" height="180" fill={`url(#hostelSky-${hostel.id})`} />

              {/* Soft drifting clouds */}
              <path d="M40 50 Q55 35 75 42 Q90 30 115 40 Q135 32 145 50 Z" fill="#ffffff" fillOpacity="0.75" />
              <path d="M260 40 Q275 28 295 35 Q315 25 335 34 Q350 28 360 42 Z" fill="#ffffff" fillOpacity="0.7" />

              {/* Distant background skyline silhouettes */}
              <path d="M80 180 V95 H125 V180 Z" fill="#cbd5e1" fillOpacity="0.4" />
              <path d="M280 180 V105 H325 V180 Z" fill="#cbd5e1" fillOpacity="0.4" />

              {/* Central Architectural Hostel Facade */}
              <path d="M120 180 V70 H280 V180 Z" fill={`url(#hostelFacade-${hostel.id})`} stroke="#cbd5e1" strokeWidth="1" />
              {/* Roof overhang & cornice */}
              <rect x="114" y="66" width="172" height="7" rx="2" fill="#0f766e" />
              
              {/* Entrance Canopy */}
              <rect x="180" y="148" width="40" height="32" rx="2" fill="#0f766e" fillOpacity="0.15" stroke="#0f766e" strokeWidth="0.8" />
              <rect x="192" y="156" width="16" height="24" rx="1" fill="#0f766e" />

              {/* Window Grid */}
              <g fill="#0284c7" fillOpacity="0.18" stroke="#38bdf8" strokeWidth="0.6">
                {/* Upper Floor */}
                <rect x="136" y="84" width="20" height="16" rx="2" />
                <rect x="168" y="84" width="20" height="16" rx="2" />
                <rect x="212" y="84" width="20" height="16" rx="2" />
                <rect x="244" y="84" width="20" height="16" rx="2" />

                {/* Middle Floor */}
                <rect x="136" y="112" width="20" height="16" rx="2" />
                <rect x="168" y="112" width="20" height="16" rx="2" />
                <rect x="212" y="112" width="20" height="16" rx="2" />
                <rect x="244" y="112" width="20" height="16" rx="2" />
              </g>

              {/* Left & Right Hostel Wing Silhouettes */}
              <path d="M60 180 V115 H120 V180 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="56" y="112" width="68" height="5" rx="1.5" fill="#0284c7" />
              <g fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="0.5">
                <rect x="74" y="126" width="16" height="14" rx="2" />
                <rect x="96" y="126" width="16" height="14" rx="2" />
              </g>

              <path d="M280 180 V115 H340 V180 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
              <rect x="276" y="112" width="68" height="5" rx="1.5" fill="#0284c7" />
              <g fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="0.5">
                <rect x="288" y="126" width="16" height="14" rx="2" />
                <rect x="310" y="126" width="16" height="14" rx="2" />
              </g>

              {/* Landscaping shrub silhouettes */}
              <circle cx="50" cy="180" r="16" fill="#10b981" fillOpacity="0.22" />
              <circle cx="350" cy="180" r="16" fill="#10b981" fillOpacity="0.22" />
            </svg>

            {/* Restrained Center Badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs border border-sky-200/80 shadow-xs text-slate-700 transition-transform group-hover/img:scale-105">
                <Building2 className="h-4 w-4 text-teal-600" />
                <span className="text-xs font-semibold tracking-wide">Hostel Property</span>
              </div>
            </div>
          </Link>
        )}

        {/* Status Badge in the top-right corner of the media region (never collides with text) */}
        {hostel.status && hostel.status.toLowerCase() !== 'pending' && hostel.status.toLowerCase() !== 'approval pending' && (
          <div className="absolute top-3 right-3 z-20 drop-shadow-xs">
            <StatusBadge status={hostel.status} />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. INFORMATION REGION (Solid White, 100% Isolated, Zero Overlap)           */}
      {/* ========================================================================= */}
      <div className="relative z-10 flex flex-col flex-1 p-5 sm:p-6 bg-white">
        {/* Hostel Name & Location */}
        <div className="mb-3 min-w-0">
          <Link
            href={`/owner/hostels/${hostel.id}`}
            className="group/title block cursor-pointer focus-visible:outline-none focus-visible:underline"
          >
            <h3 
              className="text-lg font-bold text-slate-900 leading-snug truncate group-hover/title:text-teal-700 transition-colors" 
              title={hostel.name}
            >
              {hostel.name}
            </h3>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            <span className="truncate">{locationText || 'Location not specified'}</span>
          </div>
        </div>

        {/* Description */}
        {hostel.description ? (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3.5 leading-relaxed min-w-0">
            {hostel.description}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic mb-3.5 min-w-0">
            No description provided.
          </p>
        )}

        {/* Room & Bed Statistics Row */}
        <div className="grid grid-cols-3 gap-3 mb-3.5 p-3 rounded-xl bg-slate-50/80 border border-sky-100/70 text-xs">
          {/* Total Rooms */}
          <div className="flex flex-col items-center gap-1.5 min-w-0 text-center">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <DoorOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Rooms</p>
              <p className="text-sm font-bold text-slate-900 leading-tight">{hostel.totalRooms}</p>
            </div>
          </div>

          {/* Residents / Occupied Beds */}
          <div className="flex flex-col items-center gap-1.5 min-w-0 text-center">
            <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Residents</p>
              <p className="text-sm font-bold text-purple-700 leading-tight">{hostel.occupiedBeds}</p>
            </div>
          </div>

          {/* Available Beds */}
          <div className="flex flex-col items-center gap-1.5 min-w-0 text-center">
            <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <Bed className="h-4 w-4" />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Available</p>
              <p className="text-sm font-bold text-teal-700 leading-tight">{availableBeds}</p>
            </div>
          </div>
        </div>

        {/* Occupancy Progress */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Occupancy Rate</span>
            <span className="font-bold text-teal-700">{occupancyRate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, occupancyRate))}%` }}
            />
          </div>
        </div>

        {/* Spacer pushes actions to card bottom */}
        <div className="flex-1" />

        {/* Card Footer: Starting Price / Rent & Action Buttons */}
        <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 text-xs min-w-0 gap-3">
          <div className="min-w-0 flex-1">
            {hostel.starting_price ? (
              <p className="text-xs text-slate-500 truncate">
                From <strong className="text-slate-900 font-bold text-sm">₹{Number(hostel.starting_price).toLocaleString()}</strong> <span className="text-slate-400 font-normal">/ month</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-medium truncate">
                <strong className="text-slate-900">{hostel.occupiedBeds}</strong>/{totalBeds} beds occupied
              </p>
            )}
          </div>

          {variant === 'dashboard' ? (
            <Link href={`/owner/hostels/${hostel.id}`} className="shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8.5 text-teal-700 hover:text-teal-800 hover:bg-teal-50/90 active:scale-95 font-semibold text-xs px-3 rounded-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500 transition-all group/btn"
              >
                View Details 
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/owner/hostels/${hostel.id}`}>
                <Button 
                  size="sm" 
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-2xs h-8.5 px-3 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
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
                    className="h-8.5 w-8.5 border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 rounded-xl shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500" 
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
