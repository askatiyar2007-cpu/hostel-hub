'use client';

import React from 'react';

interface HostelCardVisualProps {
  name: string;
  city?: string;
  variant?: number;
}

/**
 * HostelCardVisual:
 * - Tasteful daylight architectural student residence placeholder for hostels without photo uploads
 * - 3 distinctly styled architectural accommodations:
 *   - Variant 0: Modernist Campus Residence (White render, Teal louvers, floor-to-ceiling glass)
 *   - Variant 1: Boutique Garden Student Villa (Warm cedar wood slats, stone porch, flower planters)
 *   - Variant 2: Urban Student Loft (Contemporary loft facade, modern steel canopy, rooftop terrace pergola)
 */
export default function HostelCardVisual({ name: _name, city: _city, variant = 0 }: HostelCardVisualProps) {
  const v = variant % 3;

  if (v === 1) {
    // VARIANT 1: Boutique Garden Student Villa (Warm timber & terracotta accents)
    return (
      <div className="relative w-full h-full bg-gradient-to-b from-[#FEF9EE] via-[#FFFDF5] to-[#F0FAF4] overflow-hidden flex items-end justify-center select-none">
        <div className="absolute top-2 right-4 w-28 h-28 rounded-full bg-amber-100/60 blur-xl pointer-events-none" />

        <svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none">
          <defs>
            <linearGradient id="v1Wall" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFDF8" />
              <stop offset="100%" stopColor="#F5EFE6" />
            </linearGradient>
            <linearGradient id="v1Wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
            <linearGradient id="v1Roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B45309" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
          </defs>

          {/* Distant garden greenery */}
          <path d="M0 215 Q100 170 200 185 T400 175 V240 H0 Z" fill="#BBF7D0" fillOpacity="0.4" />

          {/* Pitched Roof Accent */}
          <polygon points="55,50 200,18 345,50" fill="url(#v1Roof)" />
          <line x1="50" y1="50" x2="350" y2="50" stroke="#78350F" strokeWidth="2.5" />

          {/* Main Villa Body */}
          <rect x="65" y="50" width="270" height="165" rx="4" fill="url(#v1Wall)" stroke="#E7DFD5" strokeWidth="1.2" />

          {/* Cedar Slat Bay Section */}
          <rect x="80" y="50" width="60" height="165" fill="url(#v1Wood)" />
          <g stroke="#FDE68A" strokeWidth="0.8" opacity="0.35">
            {[65, 85, 105, 125, 145, 165, 185].map((y) => (
              <line key={y} x1="85" y1={y} x2="135" y2={y} />
            ))}
          </g>

          {/* Upper Windows with flower boxes */}
          <rect x="160" y="70" width="40" height="34" rx="3" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
          <line x1="180" y1="70" x2="180" y2="104" stroke="#92400E" strokeWidth="0.8" />
          <rect x="156" y="104" width="48" height="6" rx="1" fill="#78350F" />
          <circle cx="164" cy="102" r="3" fill="#EF4444" />
          <circle cx="172" cy="101" r="3" fill="#F59E0B" />
          <circle cx="180" cy="102" r="3" fill="#EF4444" />
          <circle cx="188" cy="101" r="3" fill="#10B981" />
          <circle cx="196" cy="102" r="3" fill="#F59E0B" />

          <rect x="225" y="70" width="40" height="34" rx="3" fill="#E0F2FE" stroke="#92400E" strokeWidth="1" />
          <line x1="245" y1="70" x2="245" y2="104" stroke="#92400E" strokeWidth="0.8" />
          <rect x="221" y="104" width="48" height="6" rx="1" fill="#78350F" />
          <circle cx="229" cy="102" r="3" fill="#10B981" />
          <circle cx="237" cy="101" r="3" fill="#EF4444" />
          <circle cx="245" cy="102" r="3" fill="#F59E0B" />
          <circle cx="253" cy="101" r="3" fill="#EF4444" />
          <circle cx="261" cy="102" r="3" fill="#10B981" />

          {/* Welcoming Porch & Arch Entrance */}
          <rect x="175" y="135" width="85" height="80" rx="3" fill="#FFFDF8" stroke="#D97706" strokeWidth="1.2" />
          <path d="M195 215 V165 Q217 145 240 165 V215 Z" fill="#0F766E" />
          <circle cx="233" cy="190" r="2" fill="#FEF3C7" />

          {/* Garden Landscaping & Stone Path */}
          <rect x="0" y="215" width="400" height="25" fill="#15803D" fillOpacity="0.85" />
          <polygon points="200,215 235,215 250,240 185,240" fill="#E7DFD5" stroke="#D1C7B7" strokeWidth="0.8" />

          {/* Garden Shrubs & Fruit Tree */}
          <circle cx="45" cy="195" r="20" fill="#16A34A" />
          <circle cx="35" cy="180" r="16" fill="#22C55E" />
          <circle cx="365" cy="190" r="24" fill="#15803D" />
          <circle cx="355" cy="175" r="18" fill="#4ADE80" />
        </svg>
      </div>
    );
  }

  if (v === 2) {
    // VARIANT 2: Urban Student Loft (Contemporary Loft with brick accents & steel pergola)
    return (
      <div className="relative w-full h-full bg-gradient-to-b from-[#F0F9FF] via-[#F8FAFC] to-[#EFFDF8] overflow-hidden flex items-end justify-center select-none">
        <div className="absolute top-2 right-4 w-28 h-28 rounded-full bg-sky-100/60 blur-xl pointer-events-none" />

        <svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none">
          <defs>
            <linearGradient id="v2Wall" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id="v2Brick" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BE123C" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
            <linearGradient id="v2Teal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#042F2E" />
            </linearGradient>
          </defs>

          {/* Distant buildings */}
          <path d="M20 215 L20 150 L50 150 L50 130 L75 130 L75 215 Z" fill="#BAE6FD" fillOpacity="0.3" />
          <path d="M325 215 L325 140 L350 140 L350 120 L380 120 L380 215 Z" fill="#BAE6FD" fillOpacity="0.3" />

          {/* Rooftop Pergola */}
          <rect x="80" y="24" width="130" height="4" fill="#334155" rx="1" />
          <line x1="95" y1="24" x2="95" y2="40" stroke="#334155" strokeWidth="1.5" />
          <line x1="135" y1="24" x2="135" y2="40" stroke="#334155" strokeWidth="1.5" />
          <line x1="175" y1="24" x2="175" y2="40" stroke="#334155" strokeWidth="1.5" />

          {/* Main Loft Building Body */}
          <rect x="65" y="40" width="270" height="175" rx="6" fill="url(#v2Wall)" stroke="#CBD5E1" strokeWidth="1.2" />

          {/* Exposed Brick Feature Wing */}
          <rect x="220" y="40" width="95" height="175" rx="2" fill="url(#v2Brick)" />
          {/* Subtle Brick Lines */}
          <g stroke="#FDA4AF" strokeWidth="0.6" opacity="0.3">
            {[55, 70, 85, 100, 115, 130, 145, 160, 175, 190].map((y) => (
              <line key={y} x1="225" y1={y} x2="310" y2={y} />
            ))}
          </g>

          {/* Large Multi-Pane Loft Windows */}
          {/* Floor 3 */}
          <rect x="85" y="58" width="55" height="38" rx="2" fill="#FEF3C7" stroke="#0F766E" strokeWidth="1" />
          <line x1="112" y1="58" x2="112" y2="96" stroke="#0F766E" strokeWidth="0.8" />
          <line x1="85" y1="77" x2="140" y2="77" stroke="#0F766E" strokeWidth="0.8" />

          <rect x="155" y="58" width="48" height="38" rx="2" fill="#E0F2FE" stroke="#0F766E" strokeWidth="1" />
          <line x1="179" y1="58" x2="179" y2="96" stroke="#0F766E" strokeWidth="0.8" />

          <rect x="240" y="58" width="55" height="38" rx="2" fill="#FEF3C7" stroke="#FFFFFF" strokeWidth="1" />
          <line x1="267" y1="58" x2="267" y2="96" stroke="#FFFFFF" strokeWidth="0.8" />

          {/* Floor 2 */}
          <rect x="85" y="112" width="55" height="38" rx="2" fill="#E0F2FE" stroke="#0F766E" strokeWidth="1" />
          <line x1="112" y1="112" x2="112" y2="150" stroke="#0F766E" strokeWidth="0.8" />
          <line x1="85" y1="131" x2="140" y2="131" stroke="#0F766E" strokeWidth="0.8" />

          <rect x="155" y="112" width="48" height="38" rx="2" fill="#FEF3C7" stroke="#0F766E" strokeWidth="1" />
          <line x1="179" y1="112" x2="179" y2="150" stroke="#0F766E" strokeWidth="0.8" />

          <rect x="240" y="112" width="55" height="38" rx="2" fill="#E0F2FE" stroke="#FFFFFF" strokeWidth="1" />
          <line x1="267" y1="112" x2="267" y2="150" stroke="#FFFFFF" strokeWidth="0.8" />

          {/* Ground Floor Glass Loft Entrance */}
          <rect x="110" y="165" width="80" height="50" rx="2" fill="#E0F2FE" stroke="#0F766E" strokeWidth="1.2" />
          <line x1="150" y1="165" x2="150" y2="215" stroke="#0F766E" strokeWidth="1.2" />
          <rect x="100" y="162" width="100" height="4" rx="1" fill="url(#v2Teal)" />

          {/* Paved Front & Street Landscaping */}
          <rect x="0" y="215" width="400" height="25" fill="#047857" />
          <line x1="0" y1="215" x2="400" y2="215" stroke="#0F766E" strokeWidth="2" />
          <polygon points="125,215 175,215 190,240 110,240" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.8" />

          <circle cx="45" cy="185" r="22" fill="#10B981" />
          <circle cx="360" cy="185" r="22" fill="#10B981" />
        </svg>
      </div>
    );
  }

  // VARIANT 0: Modernist Campus Residence (HostelHub Signature Teal & Crisp White)
  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#E0F2FE] via-[#EBF8FE] to-[#F0FDF4] overflow-hidden flex items-end justify-center select-none">
      <div className="absolute top-2 right-4 w-28 h-28 rounded-full bg-amber-100/50 blur-xl pointer-events-none" />

      <svg viewBox="0 0 400 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none">
        <defs>
          <linearGradient id="v0Wall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>
          <linearGradient id="v0Teal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#042F2E" />
          </linearGradient>
        </defs>

        {/* Distant campus skyline */}
        <path d="M10 215 L10 145 L45 145 L45 120 L75 120 L75 215 Z" fill="#BAE6FD" fillOpacity="0.35" />
        <path d="M325 215 L325 140 L355 140 L355 110 L390 110 L390 215 Z" fill="#BAE6FD" fillOpacity="0.35" />

        {/* Main Residence Facade */}
        <rect x="65" y="35" width="270" height="180" rx="8" fill="url(#v0Wall)" stroke="#CBD5E1" strokeWidth="1.2" />

        {/* Teal Architectural Accent Panel */}
        <rect x="80" y="35" width="55" height="180" rx="4" fill="url(#v0Teal)" />
        <g stroke="#2DD4BF" strokeWidth="1" opacity="0.4">
          {[55, 75, 95, 115, 135, 155, 175].map((y) => (
            <line key={y} x1="86" y1={y} x2="129" y2={y} />
          ))}
        </g>

        {/* Roofline Header Band */}
        <rect x="65" y="35" width="270" height="8" rx="2" fill="#0F766E" />

        {/* Floor 3 */}
        <rect x="150" y="55" width="36" height="30" rx="3" fill="#FEF3C7" stroke="#0F766E" strokeWidth="0.8" />
        <line x1="168" y1="55" x2="168" y2="85" stroke="#0F766E" strokeWidth="0.6" opacity="0.6" />

        <rect x="205" y="55" width="36" height="30" rx="3" fill="#E0F2FE" stroke="#0F766E" strokeWidth="0.8" />
        <line x1="223" y1="55" x2="223" y2="85" stroke="#0F766E" strokeWidth="0.6" opacity="0.6" />

        <rect x="260" y="55" width="36" height="30" rx="3" fill="#FEF3C7" stroke="#0F766E" strokeWidth="0.8" />
        <line x1="278" y1="55" x2="278" y2="85" stroke="#0F766E" strokeWidth="0.6" opacity="0.6" />

        {/* Floor 2 with Balcony */}
        <rect x="150" y="105" width="36" height="32" rx="3" fill="#E0F2FE" stroke="#0F766E" strokeWidth="0.8" />
        <rect x="205" y="105" width="36" height="32" rx="3" fill="#FEF3C7" stroke="#0F766E" strokeWidth="0.8" />
        <rect x="260" y="105" width="36" height="32" rx="3" fill="#E0F2FE" stroke="#0F766E" strokeWidth="0.8" />

        <rect x="145" y="128" width="160" height="12" rx="2" fill="#E0F2FE" stroke="#0F766E" strokeWidth="0.8" fillOpacity="0.7" />
        <line x1="145" y1="128" x2="305" y2="128" stroke="#0F766E" strokeWidth="2" />
        <line x1="185" y1="128" x2="185" y2="140" stroke="#0F766E" strokeWidth="0.8" />
        <line x1="225" y1="128" x2="225" y2="140" stroke="#0F766E" strokeWidth="0.8" />
        <line x1="265" y1="128" x2="265" y2="140" stroke="#0F766E" strokeWidth="0.8" />

        {/* Ground Floor Entrance */}
        <rect x="180" y="155" width="80" height="60" rx="3" fill="#FEF3C7" fillOpacity="0.3" stroke="#0F766E" strokeWidth="1.2" />
        <rect x="195" y="165" width="50" height="50" rx="2" fill="#FFFFFF" fillOpacity="0.8" />
        <line x1="220" y1="165" x2="220" y2="215" stroke="#0F766E" strokeWidth="1" />
        <polygon points="170,155 270,155 262,162 178,162" fill="#0F766E" />

        {/* Campus Trees & Lawn */}
        <rect x="0" y="215" width="400" height="25" fill="#10B981" fillOpacity="0.85" />
        <polygon points="190,215 250,215 265,240 175,240" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.8" />

        <circle cx="44" cy="165" r="22" fill="#10B981" />
        <circle cx="52" cy="150" r="16" fill="#34D399" />
        <circle cx="360" cy="165" r="22" fill="#10B981" />
        <circle cx="352" cy="150" r="16" fill="#34D399" />
      </svg>
    </div>
  );
}
