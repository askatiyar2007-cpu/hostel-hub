'use client';

import React from 'react';

/**
 * AuthBackground:
 * - Calm, premium university campus atmosphere on a peaceful, bright morning
 * - Predominantly pale cool-blue/white daylight palette (#F4FAFD, #EEF8FC, #F8FCFD)
 * - NOT a cartoon illustration, NOT a jungle, NOT heavily green
 * - 5 subtle atmospheric layers:
 *   1. Soft sky base with subtle cool blue tonal gradient
 *   2. Large soft white clouds drifting slowly in distant sky (feGaussianBlur)
 *   3. Distant campus architecture (8-15% visual intensity, low contrast silhouettes)
 *   4. Distant campus greenery & lawns (muted pale sage/teal at ~10-12% opacity)
 *   5. Soft morning haze & gentle atmospheric particles
 * - Leaves upper-left quiet for marketing typography
 * - Respects prefers-reduced-motion
 */
export function AuthBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      style={{
        backgroundColor: '#F4FAFD',
        backgroundImage: `
          radial-gradient(ellipse 75% 55% at 12% 10%, rgba(255, 252, 242, 0.7) 0%, rgba(244, 250, 253, 0) 65%),
          radial-gradient(ellipse 70% 50% at 88% 14%, rgba(228, 244, 253, 0.6) 0%, rgba(244, 250, 253, 0) 60%),
          linear-gradient(180deg, #EDF6FA 0%, #F3F9FC 35%, #F8FCFD 70%, #FFFFFF 100%)
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
          {/* Atmospheric Blurs */}
          <filter id="distantHazeBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="softCloudBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="wispyCloudBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="morningAuraBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="45" />
          </filter>

          {/* Cloud Gradients */}
          <linearGradient id="cloudGradMain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#F0F7FA" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E4F1F7" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="cloudGradSubtle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#EBF4F9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#DDEEF6" stopOpacity="0" />
          </linearGradient>

          {/* Distant Campus Horizon (8–14% visual intensity in cool slate/mist) */}
          <linearGradient id="distantSkylineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748B" stopOpacity="0.14" />
            <stop offset="65%" stopColor="#94A3B8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.02" />
          </linearGradient>

          {/* Distant Student Residence Wings (8–13% visual intensity) */}
          <linearGradient id="distantResBuilding" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.12" />
            <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.02" />
          </linearGradient>

          {/* Very Muted Lawn Contours (pale sage/teal at 9–14% opacity) */}
          <linearGradient id="distantLawnGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94B9AA" stopOpacity="0.14" />
            <stop offset="60%" stopColor="#7DA695" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#679180" stopOpacity="0.03" />
          </linearGradient>

          <linearGradient id="distantLawnGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A8C8BC" stopOpacity="0.15" />
            <stop offset="70%" stopColor="#8BAFA1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#719A8B" stopOpacity="0.02" />
          </linearGradient>

          {/* Delicate Distant Trees */}
          <linearGradient id="distantTreeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#648A7A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#436657" stopOpacity="0.12" />
          </linearGradient>

          {/* Subtle Campus Promenade */}
          <linearGradient id="distantPathGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.25" />
          </linearGradient>

          {/* Bottom Ambient Daylight Fog */}
          <linearGradient id="bottomDaylightFog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8FCFD" stopOpacity="0" />
            <stop offset="45%" stopColor="#F8FCFD" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* ============================================================
            LAYER 1: Soft Morning Sunlight Aura (Upper-Left)
            ============================================================ */}
        <g className="animate-sun-glow">
          <circle cx="240" cy="120" r="260" fill="#FEF9E7" fillOpacity="0.25" filter="url(#morningAuraBlur)" />
          <circle cx="240" cy="120" r="140" fill="#FFFDF5" fillOpacity="0.35" filter="url(#softCloudBlur)" />
        </g>

        {/* ============================================================
            LAYER 2: Large Soft Morning Clouds (Upper distant sky)
            ============================================================ */}
        <g className="animate-cloud-slow" opacity="0.9">
          {/* Broad soft cloud form across upper-center */}
          <path
            d="M320 120 C380 75, 480 65, 540 95 C590 70, 670 75, 720 110 C780 98, 850 115, 880 155 C920 180, 930 220, 900 250 C870 270, 830 280, 780 280 C680 285, 540 285, 440 280 C370 275, 330 245, 335 210 C340 175, 325 145, 320 120 Z"
            fill="url(#cloudGradMain)"
            filter="url(#softCloudBlur)"
          />
          {/* Distant eastern soft cloud */}
          <path
            d="M1320 90 C1380 50, 1470 40, 1530 70 C1590 45, 1680 50, 1730 90 C1790 75, 1870 100, 1890 145 C1930 175, 1940 220, 1910 255 C1890 280, 1840 295, 1790 295 C1700 300, 1580 300, 1460 295 C1380 290, 1330 260, 1320 215 C1310 170, 1315 125, 1320 90 Z"
            fill="url(#cloudGradMain)"
            filter="url(#softCloudBlur)"
          />
        </g>

        <g className="animate-cloud-mid" opacity="0.75">
          {/* Wispy mid-altitude cloud */}
          <path
            d="M780 160 C820 125, 890 120, 940 140 C980 125, 1050 128, 1090 152 C1135 142, 1195 158, 1220 190 C1250 210, 1255 240, 1230 262 C1215 278, 1180 286, 1140 286 C1060 290, 940 290, 860 286 C810 282, 780 260, 785 230 C790 200, 780 180, 780 160 Z"
            fill="url(#cloudGradSubtle)"
            filter="url(#wispyCloudBlur)"
          />
        </g>

        {/* ============================================================
            LAYER 3: Distant University & Hostel Architecture
            (8–14% visual intensity — noticed as campus atmosphere, NOT a drawing)
            ============================================================ */}
        <g className="distant-campus-architecture" filter="url(#distantHazeBlur)">
          {/* Rolling Far Horizon Foothills */}
          <path
            d="M0 645 Q440 595 960 620 T1920 605 V880 H0 Z"
            fill="url(#distantSkylineGrad)"
          />

          {/* Distant Campus Skyline Silhouettes (spires, towers, dorm blocks) */}
          <g fill="url(#distantSkylineGrad)">
            {/* University Bell Tower / Campanile */}
            <rect x="250" y="525" width="28" height="115" rx="2" />
            <polygon points="250,525 264,485 278,525" />
            <rect x="259" y="542" width="10" height="16" rx="4" fill="#FFFFFF" fillOpacity="0.25" />

            {/* Distant Academic Hall */}
            <rect x="290" y="555" width="60" height="85" rx="2" />
            <polygon points="288,555 320,535 352,555" />

            {/* Distant Student Residence Block 1 */}
            <rect x="360" y="542" width="70" height="98" rx="2" />
            <rect x="365" y="562" width="60" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.25" />
            <rect x="365" y="580" width="60" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.25" />
            <rect x="365" y="598" width="60" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.25" />

            {/* Far Center-East Campus Skyline */}
            <rect x="1440" y="550" width="55" height="90" rx="2" />
            <polygon points="1440,550 1467,525 1495,550" />
            <rect x="1510" y="530" width="34" height="110" rx="2" />
            <polygon points="1510,530 1527,495 1544,530" />
            <rect x="1560" y="555" width="75" height="85" rx="2" />
            <rect x="1650" y="565" width="65" height="75" rx="2" />
          </g>

          {/* Mid-Distant Modern Student Residences (Clean, understated horizontal lines) */}
          <g fill="url(#distantResBuilding)">
            {/* West Modern Residence Wing */}
            <rect x="90" y="605" width="210" height="145" rx="3" />
            {/* Rooftop pergola silhouette */}
            <rect x="105" y="597" width="180" height="8" rx="1" />
            {/* Subtle Balcony Bands */}
            <rect x="110" y="635" width="170" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            <rect x="110" y="670" width="170" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            <rect x="110" y="705" width="170" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            {/* Faint morning window accents */}
            <g fill="#FEF9E7" fillOpacity="0.25">
              <rect x="125" y="618" width="16" height="12" rx="1" />
              <rect x="155" y="618" width="16" height="12" rx="1" />
              <rect x="185" y="618" width="16" height="12" rx="1" />
              <rect x="215" y="618" width="16" height="12" rx="1" />
              <rect x="245" y="618" width="16" height="12" rx="1" />

              <rect x="125" y="650" width="16" height="12" rx="1" />
              <rect x="155" y="650" width="16" height="12" rx="1" />
              <rect x="185" y="650" width="16" height="12" rx="1" />
              <rect x="215" y="650" width="16" height="12" rx="1" />
              <rect x="245" y="650" width="16" height="12" rx="1" />

              <rect x="125" y="685" width="16" height="12" rx="1" />
              <rect x="155" y="685" width="16" height="12" rx="1" />
              <rect x="185" y="685" width="16" height="12" rx="1" />
              <rect x="215" y="685" width="16" height="12" rx="1" />
              <rect x="245" y="685" width="16" height="12" rx="1" />
            </g>

            {/* East Modern Residence Wing */}
            <rect x="1600" y="590" width="240" height="160" rx="3" />
            <rect x="1620" y="625" width="200" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            <rect x="1620" y="660" width="200" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            <rect x="1620" y="695" width="200" height="3" rx="1" fill="#FFFFFF" fillOpacity="0.3" />
            <g fill="#FEF9E7" fillOpacity="0.25">
              <rect x="1635" y="605" width="16" height="12" rx="1" />
              <rect x="1665" y="605" width="16" height="12" rx="1" />
              <rect x="1695" y="605" width="16" height="12" rx="1" />
              <rect x="1725" y="605" width="16" height="12" rx="1" />
              <rect x="1755" y="605" width="16" height="12" rx="1" />

              <rect x="1635" y="640" width="16" height="12" rx="1" />
              <rect x="1665" y="640" width="16" height="12" rx="1" />
              <rect x="1695" y="640" width="16" height="12" rx="1" />
              <rect x="1725" y="640" width="16" height="12" rx="1" />
              <rect x="1755" y="640" width="16" height="12" rx="1" />
            </g>
          </g>
        </g>

        {/* ============================================================
            LAYER 4: Distant Greenery, Lawns & Sparse Trees (Muted Sage)
            ============================================================ */}
        <g className="distant-campus-landscape">
          {/* Gentle Upper Rolling Lawn */}
          <path
            d="M0 720 Q480 675 960 700 T1920 705 V1080 H0 Z"
            fill="url(#distantLawnGrad1)"
          />

          {/* Gentle Lower Lawn Swell */}
          <path
            d="M0 765 Q420 730 900 750 T1920 745 V1080 H0 Z"
            fill="url(#distantLawnGrad2)"
          />

          {/* Subtle Campus Promenade Walkway */}
          <path
            d="M-40 820 Q440 770 940 790 T1960 780 L1960 825 Q1440 830 940 840 T-40 860 Z"
            fill="url(#distantPathGrad)"
          />

          {/* Sparse, distant shade trees (Organic shapes, very low opacity, gentle sway) */}
          {/* Tree 1: West quad */}
          <g className="animate-tree-sway" opacity="0.8">
            <path d="M324 745 Q326 705 324 675 L331 675 Q329 705 330 745 Z" fill="#475569" fillOpacity="0.16" />
            <path
              d="M328 650 C305 650 295 628 310 610 C300 592 322 570 345 582 C362 570 388 588 384 610 C400 628 388 650 362 650 Z"
              fill="url(#distantTreeGrad)"
            />
          </g>

          {/* Tree 2: Center lawn */}
          <g className="animate-tree-sway-alt" opacity="0.75">
            <path d="M640 765 Q642 725 640 695 L646 695 Q645 725 645 765 Z" fill="#475569" fillOpacity="0.14" />
            <path
              d="M644 670 C625 670 616 652 628 638 C620 622 638 605 656 615 C670 605 690 618 687 636 C700 650 690 670 670 670 Z"
              fill="url(#distantTreeGrad)"
            />
          </g>

          {/* Tree 3: East residence garden */}
          <g className="animate-tree-sway" opacity="0.8">
            <path d="M1540 755 Q1542 718 1540 685 L1547 685 Q1545 718 1546 755 Z" fill="#475569" fillOpacity="0.16" />
            <path
              d="M1544 660 C1520 660 1510 638 1525 620 C1515 600 1538 580 1560 592 C1578 580 1604 598 1600 620 C1616 638 1605 660 1580 660 Z"
              fill="url(#distantTreeGrad)"
            />
          </g>
        </g>

        {/* ============================================================
            LAYER 5: Faint Atmospheric Morning Dust / Bokeh (Very subtle)
            ============================================================ */}
        <g className="animate-particle-drift" opacity="0.45">
          <circle cx="280" cy="340" r="3" fill="#FEF9E7" filter="url(#wispyCloudBlur)" />
          <circle cx="560" cy="260" r="3.5" fill="#FFFFFF" filter="url(#wispyCloudBlur)" />
          <circle cx="940" cy="320" r="2.5" fill="#BAE6FD" filter="url(#wispyCloudBlur)" />
          <circle cx="1380" cy="270" r="3.5" fill="#FEF9E7" filter="url(#wispyCloudBlur)" />
          <circle cx="1690" cy="310" r="3" fill="#FFFFFF" filter="url(#wispyCloudBlur)" />
        </g>

        {/* Soft bottom atmospheric daylight mist transition */}
        <rect x="0" y="760" width="1920" height="320" fill="url(#bottomDaylightFog)" />
      </svg>
    </div>
  );
}
