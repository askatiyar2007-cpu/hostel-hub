'use client';

import React from 'react';
import { ShieldCheck, Wifi, Sparkles } from 'lucide-react';

/**
 * HeroArchitecturalVisual:
 * - Premium daylight architectural student residence showcase
 * - Modernist student residence with limestone facade, warm cedar timber louvers, HostelHub teal trim
 * - Warm sunlit windows, private study desks with amber lamps, glass balustrade balconies
 * - Welcoming ground-floor study cafe & foyer, bicycle parking, manicured campus lawn
 * - Fully responsive Airbnb/Booking-style contextual badges
 */
export default function HeroArchitecturalVisual() {
  return (
    <div className="relative w-full max-w-lg lg:max-w-none mx-auto select-none">
      {/* Soft daylight ambient glow behind card */}
      <div className="absolute -inset-3 bg-gradient-to-tr from-teal-500/10 via-sky-400/15 to-amber-200/20 rounded-3xl blur-2xl -z-10" />

      {/* Main Showcase Container */}
      <div
        className="relative w-full rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-200/80 overflow-hidden flex flex-col justify-between"
        style={{
          background: 'linear-gradient(165deg, #FFFFFF 0%, #F8FAFC 55%, #F0FDF4 100%)',
          boxShadow: '0 20px 45px -10px rgba(15, 118, 110, 0.12), 0 8px 20px -6px rgba(15, 23, 42, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.9)',
        }}
      >
        {/* Subtle architectural grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0F766E 1px, transparent 0)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Soft morning sun gradient flare in top-right */}
        <div
          className="absolute -top-10 -right-10 w-44 h-44 bg-amber-100/60 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Badges Row */}
        <div className="relative z-20 flex items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-200/80 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
            <span>Audited &amp; Verified Stay</span>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-teal-50/95 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-teal-900 border border-teal-200/70 shadow-2xs">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Campus Edition</span>
          </div>
        </div>

        {/* Scalable Daylight Architectural Elevation Illustration (SVG) */}
        <div className="relative z-10 w-full aspect-[16/10] sm:aspect-[16/11] flex items-end justify-center">
          <svg
            viewBox="0 0 640 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-contain"
          >
            <defs>
              <linearGradient id="visSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#F0F9FF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="visFacadeWhite" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>

              <linearGradient id="visFacadeTeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F766E" />
                <stop offset="100%" stopColor="#042F2E" />
              </linearGradient>

              <linearGradient id="visWinWarm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="100%" stopColor="#FDE68A" />
              </linearGradient>

              <linearGradient id="visWinSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E0F2FE" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>

              <linearGradient id="visBalustradeGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.4" />
              </linearGradient>

              <linearGradient id="visLawnGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Backdrop sky panel */}
            <rect x="20" y="20" width="600" height="340" rx="16" fill="url(#visSkyGrad)" />

            {/* Distant campus silhouette wings */}
            <path d="M40 330 L40 230 L85 230 L85 190 L125 190 L125 330 Z" fill="#BAE6FD" fillOpacity="0.35" />
            <path d="M515 330 L515 210 L560 210 L560 175 L600 175 L600 330 Z" fill="#BAE6FD" fillOpacity="0.35" />

            {/* Main Residence Building Facade */}
            <rect
              x="110"
              y="55"
              width="420"
              height="280"
              rx="12"
              fill="url(#visFacadeWhite)"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Architectural Accent Tower (Teal Louvers) */}
            <rect x="135" y="55" width="80" height="280" rx="4" fill="url(#visFacadeTeal)" />
            <g stroke="#2DD4BF" strokeWidth="1.2" opacity="0.4">
              {[85, 110, 135, 160, 185, 210, 235, 260, 285, 310].map((y) => (
                <line key={y} x1="145" y1={y} x2="205" y2={y} />
              ))}
            </g>

            {/* Top Roofline Trim */}
            <rect x="110" y="55" width="420" height="10" rx="4" fill="#0F766E" />
            <line x1="110" y1="65" x2="530" y2="65" stroke="#14B8A6" strokeWidth="2" />

            {/* LEVEL 3 — Upper Student Bedrooms */}
            <rect x="240" y="85" width="58" height="46" rx="4" fill="url(#visWinWarm)" stroke="#0F766E" strokeWidth="1" />
            <line x1="269" y1="85" x2="269" y2="131" stroke="#0F766E" strokeWidth="0.8" opacity="0.6" />
            <polygon points="262,112 268,112 270,118 260,118" fill="#D97706" />

            <rect x="330" y="85" width="58" height="46" rx="4" fill="url(#visWinSky)" stroke="#0F766E" strokeWidth="1" />
            <line x1="359" y1="85" x2="359" y2="131" stroke="#0F766E" strokeWidth="0.8" opacity="0.6" />

            <rect x="420" y="85" width="58" height="46" rx="4" fill="url(#visWinWarm)" stroke="#0F766E" strokeWidth="1" />
            <line x1="449" y1="85" x2="449" y2="131" stroke="#0F766E" strokeWidth="0.8" opacity="0.6" />

            {/* LEVEL 2 — Balcony Level */}
            <rect x="240" y="155" width="58" height="52" rx="4" fill="url(#visWinSky)" stroke="#0F766E" strokeWidth="1" />
            <rect x="330" y="155" width="58" height="52" rx="4" fill="url(#visWinWarm)" stroke="#0F766E" strokeWidth="1" />
            <rect x="420" y="155" width="58" height="52" rx="4" fill="url(#visWinSky)" stroke="#0F766E" strokeWidth="1" />

            {/* Glass Railing Balcony */}
            <rect x="230" y="192" width="260" height="20" rx="3" fill="url(#visBalustradeGlass)" stroke="#0284C7" strokeWidth="1" />
            <line x1="230" y1="192" x2="490" y2="192" stroke="#0F766E" strokeWidth="2.5" />
            <line x1="275" y1="192" x2="275" y2="212" stroke="#0F766E" strokeWidth="1" />
            <line x1="360" y1="192" x2="360" y2="212" stroke="#0F766E" strokeWidth="1" />
            <line x1="445" y1="192" x2="445" y2="212" stroke="#0F766E" strokeWidth="1" />

            {/* Planter */}
            <rect x="242" y="186" width="22" height="6" rx="1" fill="#78350F" />
            <circle cx="247" cy="184" r="3" fill="#10B981" />
            <circle cx="253" cy="183" r="3.5" fill="#34D399" />
            <circle cx="259" cy="184" r="3" fill="#10B981" />

            {/* LEVEL 1 — Glass Lobby & Cafe */}
            <rect
              x="285"
              y="245"
              width="180"
              height="90"
              rx="4"
              fill="url(#visWinWarm)"
              fillOpacity="0.3"
              stroke="#0F766E"
              strokeWidth="1.5"
            />
            <rect x="310" y="260" width="130" height="75" rx="3" fill="#FFFBEB" fillOpacity="0.65" />
            <circle cx="340" cy="275" r="5" fill="#FEF08A" />
            <circle cx="410" cy="275" r="5" fill="#FEF08A" />

            {/* Canopy */}
            <polygon points="265,245 485,245 470,256 280,256" fill="#0F766E" />
            <line x1="275" y1="256" x2="275" y2="335" stroke="#0F766E" strokeWidth="2" />
            <line x1="475" y1="256" x2="475" y2="335" stroke="#0F766E" strokeWidth="2" />

            {/* Double glass doors */}
            <rect x="350" y="270" width="50" height="65" rx="2" fill="url(#visWinSky)" stroke="#0F766E" strokeWidth="1.2" />
            <line x1="375" y1="270" x2="375" y2="335" stroke="#0F766E" strokeWidth="1.2" />

            {/* Bicycle */}
            <circle cx="250" cy="326" r="8" stroke="#475569" strokeWidth="1.5" fill="none" />
            <circle cx="268" cy="326" r="8" stroke="#475569" strokeWidth="1.5" fill="none" />
            <line x1="250" y1="326" x2="260" y2="320" stroke="#0F766E" strokeWidth="1.5" />
            <line x1="260" y1="320" x2="268" y2="326" stroke="#0F766E" strokeWidth="1.5" />
            <line x1="260" y1="320" x2="258" y2="312" stroke="#475569" strokeWidth="1.5" />

            {/* Campus trees */}
            <path d="M78 335 Q80 290 78 250 L84 250 Q82 290 84 335 Z" fill="#5A4738" />
            <circle cx="81" cy="235" r="32" fill="#10B981" fillOpacity="0.9" />
            <circle cx="92" cy="218" r="26" fill="#34D399" fillOpacity="0.9" />

            <path d="M565 335 Q567 290 565 250 L571 250 Q569 290 570 335 Z" fill="#5A4738" />
            <circle cx="568" cy="235" r="34" fill="#10B981" fillOpacity="0.9" />
            <circle cx="555" cy="218" r="28" fill="#34D399" fillOpacity="0.9" />

            {/* Lawn & Pathway */}
            <rect x="20" y="335" width="600" height="25" fill="url(#visLawnGrad)" rx="4" />
            <polygon points="340,335 410,335 425,360 325,360" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
          </svg>
        </div>

        {/* Bottom Floating Info Chips (Responsive flex) */}
        <div className="relative z-20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3">
          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200/90 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">From</span>
            <span className="text-sm font-extrabold text-[#0F766E] font-display">
              ₹3,999<span className="text-xs font-normal text-slate-500">/mo</span>
            </span>
          </div>

          <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200/90 flex items-center gap-1.5 shadow-2xs">
            <Wifi className="h-3.5 w-3.5 text-[#0F766E]" />
            <span className="text-[11px] sm:text-xs font-semibold text-slate-800">Mesh Wi-Fi &amp; Power Backup</span>
          </div>
        </div>
      </div>
    </div>
  );
}
