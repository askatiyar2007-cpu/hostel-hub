'use client';

import React from 'react';

/**
 * CampusHeroBackground:
 * - A refined, calm morning university campus atmosphere
 * - Layer 1: Soft pale daylight sky (#EFF8FF, #F5FBFF, #F8FCFD) with gentle morning daylight tone
 * - Layer 2: Soft volumetric cumulus clouds drifting slowly (45s–75s cycles, low contrast, soft blurred edges)
 * - Layer 3: Distant university campus architecture seen through morning haze (academic halls, clock towers, dorm wings)
 * - Layer 4: Distant rolling hills and soft horizon silhouettes
 * - Layer 5: Rolling morning campus lawns & manicured lawns (gentle sage/emerald, no saturated blobs)
 * - Layer 6: Tasteful, natural campus trees (slender trunks, organic canopy shapes, gentle breeze sway)
 * - Layer 7: Subtle morning sunlight flare and tiny floating atmospheric bokeh particles
 * - No intrusive shapes directly behind the main hero text
 * - Completely respects prefers-reduced-motion
 */
export default function CampusHeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden"
      style={{
        backgroundColor: '#F5FBFF',
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 15% 10%, rgba(254, 243, 199, 0.4) 0%, rgba(245, 251, 255, 0) 55%),
          radial-gradient(ellipse 65% 45% at 85% 15%, rgba(224, 242, 254, 0.45) 0%, rgba(245, 251, 255, 0) 58%),
          linear-gradient(180deg, #EFF8FF 0%, #F5FBFF 38%, #F8FCFD 72%, #FFFFFF 100%)
        `,
      }}
    >
      <svg
        viewBox="0 0 1920 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* Soft Blur Filters */}
          <filter id="cloudBlurLarge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="cloudBlurSmall" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="hazeAtmosphere" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="sunMorningAura" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="40" />
          </filter>

          {/* Cloud Gradients */}
          <linearGradient id="cloudGradTop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#F0F9FF" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="cloudGradFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.15" />
          </linearGradient>

          {/* Distant Hills in Morning Mist */}
          <linearGradient id="distantMistHills" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.02" />
          </linearGradient>

          {/* Distant Campus Silhouettes */}
          <linearGradient id="distantCampusHaze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.08" />
          </linearGradient>

          {/* Midground Campus Architecture */}
          <linearGradient id="bgHostelFacade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.65" />
          </linearGradient>

          {/* Campus Lawns Gradients */}
          <linearGradient id="lawnFarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86EFAC" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#4ADE80" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="lawnNearGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#6EE7B7" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
          </linearGradient>

          {/* Natural Tree Canopies */}
          <linearGradient id="naturalTree1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.55" />
          </linearGradient>

          <linearGradient id="naturalTree2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.5" />
          </linearGradient>

          {/* Seamless Bottom Fade */}
          <linearGradient id="bottomFadeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* ------------------------------------------------------------- */}
        {/* 1. MORNING SUNLIGHT FLARE                                     */}
        {/* ------------------------------------------------------------- */}
        <g className="animate-sun-glow">
          <circle cx="260" cy="110" r="300" fill="#FEF3C7" fillOpacity="0.3" filter="url(#sunMorningAura)" />
          <circle cx="260" cy="110" r="140" fill="#FFFBEB" fillOpacity="0.45" filter="url(#cloudBlurLarge)" />
          <circle cx="260" cy="110" r="50" fill="#FFFFFF" fillOpacity="0.75" filter="url(#cloudBlurSmall)" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 2. SLOW DRIFTING VOLUMETRIC CLOUDS (Upper background)         */}
        {/* ------------------------------------------------------------- */}
        <g className="animate-cloud-slow" opacity="0.85">
          <path
            d="M200 120 C240 75, 330 65, 380 90 C435 68, 500 70, 550 105 C605 92, 675 115, 700 160 C730 185, 735 225, 705 255 C685 275, 645 285, 595 285 C515 290, 395 290, 305 282 C250 278, 220 248, 228 212 C232 178, 220 148, 200 120 Z"
            fill="url(#cloudGradTop)"
            filter="url(#cloudBlurLarge)"
          />
          <path
            d="M1360 90 C1400 48, 1480 38, 1535 65 C1585 40, 1665 40, 1720 78 C1785 65, 1860 92, 1885 142 C1925 165, 1948 215, 1922 260 C1905 290, 1865 308, 1825 308 C1755 318, 1625 322, 1495 315 C1410 308, 1350 275, 1340 225 C1325 175, 1350 125, 1360 90 Z"
            fill="url(#cloudGradTop)"
            filter="url(#cloudBlurLarge)"
          />
        </g>

        <g className="animate-cloud-mid" opacity="0.6">
          <path
            d="M740 135 C780 98, 850 90, 900 115 C945 95, 1005 98, 1050 128 C1095 118, 1150 135, 1172 172 C1200 195, 1205 230, 1182 255 C1165 275, 1130 285, 1090 285 C1025 290, 910 290, 830 285 C780 280, 752 255, 758 222 C762 195, 755 170, 740 135 Z"
            fill="url(#cloudGradFar)"
            filter="url(#cloudBlurSmall)"
          />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 3. DISTANT ROLLING HILLS & MORNING MIST                       */}
        {/* ------------------------------------------------------------- */}
        <path
          d="M0 560 Q480 490 960 525 T1920 510 V780 H0 Z"
          fill="url(#distantMistHills)"
        />

        {/* ------------------------------------------------------------- */}
        {/* 4. DISTANT UNIVERSITY CAMPUS SILHOUETTES IN MORNING HAZE      */}
        {/* Sits far back, low contrast, atmospheric                      */}
        {/* ------------------------------------------------------------- */}
        <g fill="url(#distantCampusHaze)" filter="url(#hazeAtmosphere)" opacity="0.75">
          {/* Distant West Campus Library Spire */}
          <rect x="220" y="460" width="34" height="100" rx="2" />
          <polygon points="220,460 237,418 254,460" />
          <rect x="260" y="490" width="55" height="70" rx="2" />
          <rect x="325" y="475" width="44" height="85" rx="2" />

          {/* Distant academic hall in horizon center-right */}
          <rect x="1050" y="500" width="60" height="55" rx="2" />
          <rect x="1120" y="485" width="45" height="70" rx="2" />

          {/* Distant East Campus Tower & Faculty wings */}
          <rect x="1560" y="480" width="50" height="80" rx="2" />
          <rect x="1620" y="450" width="38" height="110" rx="3" />
          <polygon points="1620,450 1639,408 1658,450" />
          <rect x="1668" y="485" width="65" height="75" rx="2" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 5. MID-DISTANT RESIDENCE PAVILION (Far right perimeter only)  */}
        {/* Subtle, low contrast, doesn't interfere with foreground       */}
        {/* ------------------------------------------------------------- */}
        <g opacity="0.45">
          <rect x="1750" y="510" width="160" height="140" rx="4" fill="url(#bgHostelFacade)" stroke="#CBD5E1" strokeWidth="0.8" />
          <rect x="1860" y="510" width="25" height="140" fill="#0F766E" fillOpacity="0.4" />
          <g fill="#FEF3C7" fillOpacity="0.6">
            <rect x="1770" y="530" width="16" height="16" rx="2" />
            <rect x="1795" y="530" width="16" height="16" rx="2" />
            <rect x="1820" y="530" width="16" height="16" rx="2" />
            <rect x="1770" y="560" width="16" height="16" rx="2" />
            <rect x="1795" y="560" width="16" height="16" rx="2" />
            <rect x="1820" y="560" width="16" height="16" rx="2" />
          </g>
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 6. CAMPUS LAWNS & GENTLE ROLLING HORIZONS                     */}
        {/* Clean, calm green accents — no saturated blobs                */}
        {/* ------------------------------------------------------------- */}
        <g className="campus-lawns">
          {/* Back Lawn Horizon */}
          <path
            d="M0 640 Q480 595 960 620 T1920 625 V900 H0 Z"
            fill="url(#lawnFarGrad)"
          />

          {/* Near Lawn Horizon */}
          <path
            d="M0 700 Q440 660 920 680 T1920 675 V900 H0 Z"
            fill="url(#lawnNearGrad)"
          />

          {/* Campus pedestrian walkway */}
          <path
            d="M-20 750 Q440 705 940 730 T1940 720 L1940 752 Q1440 762 940 770 T-20 790 Z"
            fill="#F1F5F9"
            fillOpacity="0.6"
            stroke="#CBD5E1"
            strokeWidth="0.6"
            strokeOpacity="0.35"
          />

          {/* Slender Campus Birch / Shade Trees (Placed on outer flanks) */}
          {/* Left flank tree (far left, clear of hero text) */}
          <g className="animate-tree-sway" opacity="0.75">
            <path d="M120 675 Q122 630 120 595 L126 595 Q124 630 125 675 Z" fill="#645041" />
            <circle cx="123" cy="565" r="35" fill="url(#naturalTree1)" />
            <circle cx="102" cy="576" r="25" fill="url(#naturalTree2)" />
            <circle cx="145" cy="572" r="26" fill="url(#naturalTree1)" />
          </g>

          {/* Center-right distant tree along the lawn line */}
          <g className="animate-tree-sway-alt" opacity="0.6">
            <path d="M780 700 Q782 655 780 625 L785 625 Q784 655 785 700 Z" fill="#645041" />
            <circle cx="783" cy="595" r="30" fill="url(#naturalTree2)" />
            <circle cx="762" cy="605" r="22" fill="url(#naturalTree1)" />
            <circle cx="802" cy="602" r="23" fill="url(#naturalTree2)" />
          </g>

          {/* East perimeter campus tree */}
          <g className="animate-tree-sway" opacity="0.75">
            <path d="M1720 685 Q1722 640 1720 605 L1726 605 Q1724 640 1725 685 Z" fill="#645041" />
            <circle cx="1723" cy="575" r="38" fill="url(#naturalTree1)" />
            <circle cx="1698" cy="586" r="28" fill="url(#naturalTree2)" />
            <circle cx="1746" cy="582" r="29" fill="url(#naturalTree2)" />
          </g>
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 7. SUBTLE MORNING ATMOSPHERIC BOKEH PARTICLES                 */}
        {/* ------------------------------------------------------------- */}
        <g className="animate-particle-drift">
          <circle cx="340" cy="270" r="3.5" fill="#FEF3C7" opacity="0.45" filter="url(#cloudBlurSmall)" />
          <circle cx="580" cy="210" r="4" fill="#FFFFFF" opacity="0.5" filter="url(#cloudBlurSmall)" />
          <circle cx="1020" cy="260" r="3.5" fill="#BAE6FD" opacity="0.4" filter="url(#cloudBlurSmall)" />
          <circle cx="1420" cy="230" r="4.5" fill="#FEF3C7" opacity="0.4" filter="url(#cloudBlurSmall)" />
          <circle cx="1780" cy="290" r="3.5" fill="#FFFFFF" opacity="0.45" filter="url(#cloudBlurSmall)" />
        </g>

        {/* ------------------------------------------------------------- */}
        {/* 8. SEAMLESS BASE TRANSITION INTO SEARCH EXPERIENCE            */}
        {/* ------------------------------------------------------------- */}
        <rect x="0" y="660" width="1920" height="240" fill="url(#bottomFadeGrad)" />
      </svg>
    </div>
  );
}
