'use client';

import React from 'react';

/**
 * AuthBackground:
 * - Refined, luminous modern architectural background designed for maximum typography contrast
 * - High-contrast daylight palette (#F8FAFC, #F1F5F9, #FFFFFF)
 * - Clear left hemisphere for crisp marketing readability (zero clashing dark silhouettes behind text)
 * - Subtle radiant teal ambient glow on the right hemisphere to elevate the authentication card
 * - Clean geometric architectural grid and distant horizon silhouettes safely anchored at the base
 */
export function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      style={{
        backgroundColor: '#F8FAFC',
        backgroundImage: `
          radial-gradient(ellipse 65% 55% at 78% 42%, rgba(15, 118, 110, 0.08) 0%, rgba(20, 184, 166, 0.03) 50%, transparent 75%),
          radial-gradient(circle at 20% 25%, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.7) 65%, rgba(241, 245, 249, 0.3) 100%),
          linear-gradient(180deg, #F8FAFC 0%, #F3F7FA 40%, #EDF3F7 100%)
        `,
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* Subtle architectural grid pattern */}
          <pattern id="authArchGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#0F766E" strokeWidth="0.6" strokeOpacity="0.04" />
          </pattern>

          {/* Distant skyline gradient */}
          <linearGradient id="horizonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.07" />
            <stop offset="60%" stopColor="#64748B" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.01" />
          </linearGradient>

          {/* Clean bottom daylight fade */}
          <linearGradient id="authBottomFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0" />
            <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.98" />
          </linearGradient>

          {/* Soft blur for bokeh particles */}
          <filter id="authBokehBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* 1. Fine Architectural Grid Overlay */}
        <rect width="100%" height="100%" fill="url(#authArchGrid)" />

        {/* 2. Elevated Ambient Accent Rings (Positioned around the right-hand authentication focus area) */}
        <g stroke="#0F766E" fill="none">
          <circle cx="1520" cy="420" r="320" strokeWidth="1" strokeDasharray="6 8" strokeOpacity="0.08" />
          <circle cx="1520" cy="420" r="220" strokeWidth="1.2" strokeDasharray="4 6" strokeOpacity="0.12" />
          <circle cx="1520" cy="420" r="140" strokeWidth="1" strokeDasharray="2 4" strokeOpacity="0.09" />
          
          {/* Subtle top-right accent */}
          <circle cx="1820" cy="120" r="180" strokeWidth="0.8" strokeDasharray="5 7" strokeOpacity="0.06" />
        </g>

        {/* 3. Distant Architectural Horizon (Safely at base, y: 780-1080, well below text and card) */}
        <g fill="url(#horizonGrad)">
          {/* Distant campus hills contour */}
          <path d="M0 860 Q480 820 960 840 T1920 830 V1080 H0 Z" />

          {/* Distant academic & residence silhouettes */}
          {/* Left-center distant silhouette */}
          <rect x="340" y="790" width="80" height="90" rx="3" />
          <polygon points="340,790 380,755 420,790" />
          <rect x="440" y="770" width="30" height="110" rx="2" />
          <polygon points="440,770 455,735 470,770" />
          <rect x="490" y="800" width="70" height="80" rx="2" />

          {/* Right distant modern residence blocks */}
          <rect x="1380" y="780" width="100" height="100" rx="3" />
          <rect x="1500" y="760" width="75" height="120" rx="2" />
          <polygon points="1500,760 1537,735 1575,760" />
          <rect x="1600" y="790" width="120" height="90" rx="3" />
          <rect x="1740" y="775" width="85" height="105" rx="2" />
        </g>

        {/* 4. Ambient Drifting Dust / Luminous Bokeh Flecks */}
        <g className="animate-particle-drift" opacity="0.65">
          <circle cx="340" cy="220" r="4" fill="#0F766E" opacity="0.15" filter="url(#authBokehBlur)" />
          <circle cx="780" cy="180" r="5" fill="#14B8A6" opacity="0.12" filter="url(#authBokehBlur)" />
          <circle cx="1280" cy="260" r="6" fill="#0F766E" opacity="0.18" filter="url(#authBokehBlur)" />
          <circle cx="1660" cy="190" r="4" fill="#14B8A6" opacity="0.15" filter="url(#authBokehBlur)" />
          <circle cx="1480" cy="680" r="5" fill="#0F766E" opacity="0.12" filter="url(#authBokehBlur)" />
        </g>

        {/* 5. Soft Bottom Daylight Ground Mist */}
        <rect x="0" y="820" width="1920" height="260" fill="url(#authBottomFade)" />
      </svg>
    </div>
  );
}
