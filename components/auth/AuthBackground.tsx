'use client';

import React from 'react';

/**
 * AuthBackground:
 * - Peaceful, calm morning university campus environment (20–30% visual intensity)
 * - Soft morning sky with gentle sunlight
 * - Subtle cumulus clouds drifting slowly (45s-75s)
 * - Distant, refined campus & hostel buildings (soft silhouettes, not cartoonish or overpowering)
 * - Gentle rolling green lawns & delicate campus shade trees
 * - Atmospheric morning mist & subtle bokeh particles
 * - NO giant leaves, NO neon glow, NO cartoon jungle elements
 * - 100% accessible contrast for floating text and anchored dark-teal authentication card
 */
export function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      style={{
        backgroundColor: '#F3F9FC',
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 12% 10%, rgba(254, 243, 199, 0.45) 0%, rgba(243, 249, 252, 0) 55%),
          radial-gradient(ellipse 65% 45% at 88% 18%, rgba(224, 242, 254, 0.5) 0%, rgba(243, 249, 252, 0) 60%),
          linear-gradient(180deg, #E6F3FA 0%, #EEF7FC 28%, #F5FAFD 55%, #FAFCFD 80%, #FFFFFF 100%)
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
          {/* Depth of field / atmospheric filters */}
          <filter id="bgCloudBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="bgSoftBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="bgSunAura" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="30" />
          </filter>

          {/* Cloud Gradients */}
          <linearGradient id="cloudBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#F0F9FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.3" />
          </linearGradient>

          {/* Distant Campus Silhouettes (pale atmospheric blue/teal) */}
          <linearGradient id="distantSkylineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.05" />
          </linearGradient>

          {/* Midground Campus & Hostel Buildings */}
          <linearGradient id="hostelBuildingGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id="hostelBuildingGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F1F5F9" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.45" />
          </linearGradient>

          {/* Subtle Teal Accent for Architecture */}
          <linearGradient id="subtleTealFacade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F766E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#064E4A" stopOpacity="0.25" />
          </linearGradient>

          {/* Warm Morning Windows */}
          <linearGradient id="morningWindow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.3" />
          </linearGradient>

          {/* Rolling Campus Lawns (soft, gentle sage green) */}
          <linearGradient id="lawnGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#34D399" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.12" />
          </linearGradient>

          <linearGradient id="lawnGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.18" />
          </linearGradient>

          {/* Soft Tree Canopies */}
          <linearGradient id="treeGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.45" />
          </linearGradient>

          <linearGradient id="treeGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* 1. Gentle Sunlight Aura (Top-Left) */}
        <g className="animate-sun-glow">
          <circle cx="220" cy="120" r="220" fill="#FEF3C7" fillOpacity="0.25" filter="url(#bgSunAura)" />
          <circle cx="220" cy="120" r="110" fill="#FFFBEB" fillOpacity="0.35" filter="url(#bgSoftBlur)" />
          <circle cx="220" cy="120" r="45" fill="#FFFFFF" fillOpacity="0.75" filter="url(#bgCloudBlur)" />
        </g>

        {/* 2. Soft Drifting Morning Clouds */}
        <g className="animate-cloud-slow" opacity="0.85">
          {/* Left Upper Cloud Bank */}
          <path
            d="M260 140 C290 100, 350 90, 395 110 C430 92, 480 94, 520 120 C560 112, 610 128, 630 162 C655 182, 660 215, 640 240 C625 260, 595 270, 560 270 C495 275, 390 275, 320 270 C275 264, 250 240, 255 208 C260 178, 255 155, 260 140 Z"
            fill="url(#cloudBody)"
            filter="url(#bgCloudBlur)"
          />
          {/* Far Right Upper Cloud */}
          <path
            d="M1380 110 C1415 75, 1475 68, 1520 90 C1562 72, 1625 72, 1670 102 C1720 92, 1780 114, 1800 152 C1838 170, 1860 210, 1838 245 C1824 270, 1792 284, 1760 284 C1700 292, 1595 298, 1490 292 C1415 288, 1370 260, 1360 220 C1350 180, 1365 140, 1380 110 Z"
            fill="url(#cloudBody)"
            filter="url(#bgCloudBlur)"
          />
        </g>

        <g className="animate-cloud-mid" opacity="0.65">
          {/* Center Mid-altitude Soft Cloud */}
          <path
            d="M740 160 C770 130, 820 125, 858 142 C892 128, 940 130, 975 152 C1010 144, 1055 158, 1072 188 C1095 205, 1100 232, 1080 252 C1068 268, 1040 276, 1010 276 C955 280, 860 280, 800 276 C760 272, 738 252, 742 225 C745 200, 738 178, 740 160 Z"
            fill="url(#cloudBody)"
            filter="url(#bgCloudBlur)"
          />
        </g>

        {/* 3. Distant University Campus Skyline & Rolling Hills */}
        <g className="distant-campus" opacity="0.65">
          {/* Rolling Hills Silhouette */}
          <path
            d="M0 640 Q400 580 960 605 T1920 600 V860 H0 Z"
            fill="url(#distantSkylineGrad)"
          />

          {/* Distant Campus Towers & Buildings (Center/West) */}
          <g fill="#93C5FD" fillOpacity="0.22">
            <rect x="220" y="520" width="45" height="120" rx="3" />
            <polygon points="220,520 242,475 265,520" />
            <rect x="280" y="550" width="70" height="90" rx="2" />
            <rect x="365" y="530" width="55" height="110" rx="2" />
            <rect x="435" y="560" width="60" height="80" rx="2" />

            {/* Distant East Skyline */}
            <rect x="1480" y="535" width="65" height="105" rx="2" />
            <rect x="1560" y="515" width="50" height="125" rx="3" />
            <polygon points="1560,515 1585,470 1610,515" />
            <rect x="1625" y="545" width="80" height="95" rx="2" />
            <rect x="1720" y="560" width="70" height="80" rx="2" />
          </g>
        </g>

        {/* 4. Midground Modern Student Residence Buildings (Light, architectural, subtle) */}
        <g className="campus-hostels" opacity="0.75">
          {/* Left Wing Hostel Residence (behind marketing text, soft and elegant) */}
          <g>
            <rect x="80" y="580" width="220" height="160" rx="6" fill="url(#hostelBuildingGrad1)" stroke="#94A3B8" strokeWidth="1" strokeOpacity="0.4" />
            <rect x="100" y="580" width="30" height="160" fill="url(#subtleTealFacade)" />
            {/* Subtle Windows */}
            <g fill="url(#morningWindow)" opacity="0.7">
              <rect x="145" y="605" width="22" height="24" rx="2" />
              <rect x="180" y="605" width="22" height="24" rx="2" />
              <rect x="215" y="605" width="22" height="24" rx="2" />
              <rect x="250" y="605" width="22" height="24" rx="2" />

              <rect x="145" y="645" width="22" height="24" rx="2" />
              <rect x="180" y="645" width="22" height="24" rx="2" />
              <rect x="215" y="645" width="22" height="24" rx="2" />
              <rect x="250" y="645" width="22" height="24" rx="2" />

              <rect x="145" y="685" width="22" height="24" rx="2" />
              <rect x="180" y="685" width="22" height="24" rx="2" />
              <rect x="215" y="685" width="22" height="24" rx="2" />
              <rect x="250" y="685" width="22" height="24" rx="2" />
            </g>
          </g>

          {/* East Wing Hostel (Right side, framing) */}
          <g>
            <rect x="1580" y="565" width="260" height="180" rx="6" fill="url(#hostelBuildingGrad2)" stroke="#94A3B8" strokeWidth="1" strokeOpacity="0.4" />
            <rect x="1760" y="565" width="35" height="180" fill="url(#subtleTealFacade)" />
            <g fill="url(#morningWindow)" opacity="0.7">
              <rect x="1610" y="595" width="22" height="24" rx="2" />
              <rect x="1645" y="595" width="22" height="24" rx="2" />
              <rect x="1680" y="595" width="22" height="24" rx="2" />
              <rect x="1715" y="595" width="22" height="24" rx="2" />

              <rect x="1610" y="635" width="22" height="24" rx="2" />
              <rect x="1645" y="635" width="22" height="24" rx="2" />
              <rect x="1680" y="635" width="22" height="24" rx="2" />
              <rect x="1715" y="635" width="22" height="24" rx="2" />

              <rect x="1610" y="675" width="22" height="24" rx="2" />
              <rect x="1645" y="675" width="22" height="24" rx="2" />
              <rect x="1680" y="675" width="22" height="24" rx="2" />
              <rect x="1715" y="675" width="22" height="24" rx="2" />
            </g>
          </g>
        </g>

        {/* 5. Rolling Campus Grounds, Paths & Subtle Trees */}
        <g className="campus-lawns">
          {/* Upper Lawn Swell */}
          <path
            d="M0 720 Q480 670 960 695 T1920 700 V1080 H0 Z"
            fill="url(#lawnGrad1)"
          />

          {/* Lower Lawn Swell */}
          <path
            d="M0 765 Q420 725 900 745 T1920 740 V1080 H0 Z"
            fill="url(#lawnGrad2)"
          />

          {/* Subtle Campus Winding Path */}
          <path
            d="M-20 815 Q440 770 940 790 T1940 780 L1940 820 Q1440 825 940 835 T-20 855 Z"
            fill="#F8FAFC"
            fillOpacity="0.6"
            stroke="#CBD5E1"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* Delicate, organic Campus Trees (swaying gently, NO cartoon bubbles) */}
          {/* Tree 1: Left */}
          <g className="animate-tree-sway" opacity="0.7">
            <path d="M338 745 Q340 705 338 675 L346 675 Q344 705 345 745 Z" fill="#5A4738" />
            <circle cx="342" cy="645" r="38" fill="url(#treeGrad1)" />
            <circle cx="318" cy="655" r="28" fill="url(#treeGrad2)" />
            <circle cx="365" cy="652" r="30" fill="url(#treeGrad1)" />
          </g>

          {/* Tree 2: Center-Left */}
          <g className="animate-tree-sway-alt" opacity="0.65">
            <path d="M680 770 Q682 725 680 690 L687 690 Q685 725 686 770 Z" fill="#5A4738" />
            <circle cx="684" cy="660" r="35" fill="url(#treeGrad2)" />
            <circle cx="660" cy="670" r="26" fill="url(#treeGrad1)" />
            <circle cx="705" cy="668" r="27" fill="url(#treeGrad2)" />
          </g>

          {/* Tree 3: East */}
          <g className="animate-tree-sway" opacity="0.7">
            <path d="M1520 755 Q1522 715 1520 680 L1528 680 Q1526 715 1527 755 Z" fill="#5A4738" />
            <circle cx="1524" cy="648" r="40" fill="url(#treeGrad1)" />
            <circle cx="1498" cy="660" r="30" fill="url(#treeGrad2)" />
            <circle cx="1550" cy="655" r="32" fill="url(#treeGrad2)" />
          </g>
        </g>

        {/* 6. Subtle Ambient Morning Dust / Bokeh Particles (very calm, low opacity) */}
        <g className="animate-particle-drift">
          <circle cx="280" cy="360" r="3.5" fill="#FEF3C7" opacity="0.35" filter="url(#bgCloudBlur)" />
          <circle cx="520" cy="280" r="4" fill="#FFFFFF" opacity="0.4" filter="url(#bgCloudBlur)" />
          <circle cx="920" cy="340" r="3" fill="#BAE6FD" opacity="0.3" filter="url(#bgCloudBlur)" />
          <circle cx="1320" cy="290" r="4" fill="#FEF3C7" opacity="0.3" filter="url(#bgCloudBlur)" />
          <circle cx="1680" cy="330" r="3.5" fill="#FFFFFF" opacity="0.35" filter="url(#bgCloudBlur)" />
        </g>

        {/* 7. Soft bottom atmospheric haze gradient */}
        <rect x="0" y="780" width="1920" height="300" fill="url(#bottomHaze)" opacity="0.6" />
        <defs>
          <linearGradient id="bottomHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
