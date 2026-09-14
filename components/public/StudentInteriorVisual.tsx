'use client';

import React from 'react';
import { Home, Sparkles } from 'lucide-react';

/**
 * StudentInteriorVisual:
 * - Bright, warm morning daylight student room sanctuary
 * - Replaces the pitch-black box with a warm, sunlit student bedroom & study space
 * - Features morning sunlight streaming through the window, oak desk with laptop & study notes,
 *   cozy bed with teal bedding, bookshelf with textbooks, and potted plant
 * - Cohesive with the morning campus environment
 */
export default function StudentInteriorVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[4/3] sm:aspect-[16/12] select-none">
      {/* Soft warm daylight ambient glow */}
      <div className="absolute -inset-3 bg-gradient-to-tr from-teal-500/10 via-amber-200/25 to-sky-200/20 rounded-3xl blur-2xl -z-10" />

      {/* Main Container */}
      <div
        className="relative h-full w-full rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-200/90 overflow-hidden flex flex-col justify-end"
        style={{
          background: 'linear-gradient(165deg, #FFFFFF 0%, #F8FAFB 60%, #F0FAF8 100%)',
          boxShadow: '0 20px 45px -10px rgba(15, 118, 110, 0.1), 0 8px 20px -6px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0F766E 1px, transparent 0)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Scalable Interior Architectural SVG */}
        <div className="relative z-10 w-full h-[88%] flex items-end justify-center">
          <svg
            viewBox="0 0 540 380"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full object-contain"
          >
            <defs>
              {/* Sunlight Beam Gradient */}
              <linearGradient id="interiorSunBeam" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.7" />
                <stop offset="60%" stopColor="#FEF3C7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0.0" />
              </linearGradient>

              {/* Lamp Light Cone */}
              <linearGradient id="lampWarmCone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>

              {/* Wood desk gradient */}
              <linearGradient id="oakDesk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>

              {/* Teal Duvet gradient */}
              <linearGradient id="tealQuilt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0F766E" />
                <stop offset="100%" stopColor="#064E4A" />
              </linearGradient>

              {/* Window Outside Sky */}
              <linearGradient id="windowOutsideSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#BAE6FD" />
                <stop offset="100%" stopColor="#E0F2FE" />
              </linearGradient>
            </defs>

            {/* Room Wall & Floor */}
            <rect x="20" y="20" width="500" height="270" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.2" />
            <polygon points="20,290 520,290 540,360 0,360" fill="#F1F5F9" />
            <line x1="20" y1="290" x2="520" y2="290" stroke="#CBD5E1" strokeWidth="2" />

            {/* Large Window to Campus Garden */}
            <rect x="290" y="45" width="190" height="180" rx="8" fill="url(#windowOutsideSky)" stroke="#CBD5E1" strokeWidth="2" />
            {/* Campus tree & greenery outside window */}
            <circle cx="430" cy="135" r="45" fill="#34D399" opacity="0.85" />
            <circle cx="350" cy="125" r="35" fill="#10B981" opacity="0.85" />
            <circle cx="395" cy="85" r="20" fill="#FEF3C7" opacity="0.8" />
            {/* Window Frames */}
            <line x1="385" y1="45" x2="385" y2="225" stroke="#94A3B8" strokeWidth="2" />
            <line x1="290" y1="135" x2="480" y2="135" stroke="#94A3B8" strokeWidth="2" />

            {/* Sunlight Streaming into Room */}
            <polygon points="290,45 480,45 530,340 320,340" fill="url(#interiorSunBeam)" />

            {/* Bookshelf on Wall */}
            <rect x="50" y="55" width="140" height="8" rx="2" fill="#92400E" />
            <rect x="60" y="32" width="10" height="23" fill="#0F766E" rx="1" />
            <rect x="73" y="28" width="12" height="27" fill="#F59E0B" rx="1" />
            <rect x="88" y="35" width="8" height="20" fill="#0284C7" rx="1" />
            <rect x="100" y="30" width="14" height="25" fill="#10B981" rx="1" />
            {/* Potted plant on shelf */}
            <rect x="145" y="43" width="16" height="12" rx="2" fill="#EA580C" />
            <circle cx="153" cy="38" r="7" fill="#10B981" />

            {/* Cozy Student Bed on Left */}
            <rect x="35" y="200" width="180" height="90" rx="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
            {/* Pillows */}
            <rect x="45" y="185" width="50" height="25" rx="5" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <rect x="100" y="185" width="50" height="25" rx="5" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            {/* Teal Duvet Quilt */}
            <rect x="40" y="210" width="170" height="80" rx="6" fill="url(#tealQuilt)" />
            {/* Folded throw blanket */}
            <rect x="140" y="215" width="65" height="75" rx="4" fill="#F59E0B" opacity="0.9" />

            {/* Ergonomic Study Desk (Right Side) */}
            <rect x="250" y="210" width="230" height="16" rx="3" fill="url(#oakDesk)" />
            {/* Desk Legs */}
            <rect x="260" y="226" width="8" height="80" fill="#64748B" rx="1" />
            <rect x="460" y="226" width="8" height="80" fill="#64748B" rx="1" />

            {/* Laptop Open on Desk */}
            <polygon points="325,188 375,188 385,210 315,210" fill="#CBD5E1" />
            <rect x="325" y="160" width="50" height="28" rx="2" fill="#1E293B" stroke="#94A3B8" strokeWidth="1" />
            <rect x="329" y="163" width="42" height="22" fill="#38BDF8" opacity="0.75" />

            {/* Study Lamp & Warm Light Cone */}
            <path d="M430 210 L430 155 Q430 145 420 145 L410 145" stroke="#D97706" strokeWidth="3" fill="none" />
            <polygon points="400,140 420,140 425,152 395,152" fill="#D97706" />
            <polygon points="395,152 425,152 460,230 360,230" fill="url(#lampWarmCone)" />

            {/* Coffee Mug & Notes */}
            <rect x="280" y="198" width="14" height="12" rx="2" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
            <path d="M294 201 Q298 204 294 207" stroke="#CBD5E1" strokeWidth="1.2" fill="none" />
            <rect x="395" y="202" width="22" height="8" rx="1" fill="#FEF08A" />

            {/* Floor Rug */}
            <ellipse cx="230" cy="320" rx="120" ry="25" fill="#0F766E" opacity="0.15" />
          </svg>
        </div>

        {/* Floating Feature Pill */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 px-3.5 py-2 rounded-2xl shadow-xs flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-50 text-[#0F766E]">
            <Home className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-900 tracking-wide">Personal Study Sanctuary</p>
            <p className="text-[10px] text-slate-500">Quiet Hours • High-Speed Mesh Wi-Fi</p>
          </div>
        </div>

        {/* Floating Badge 2 */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xs border border-slate-200 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-slate-800">Peace of Mind for Parents</span>
        </div>
      </div>
    </div>
  );
}
