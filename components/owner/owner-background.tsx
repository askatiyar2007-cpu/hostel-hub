'use client';

import React from 'react';

/**
 * OwnerBackground
 * 
 * Recreates the authentic visual language from Image 2:
 * - Pale sky-blue / white atmospheric background with daylight blue sky gradients
 * - Soft, billowy cumulus clouds drifting across the upper and mid horizon
 * - Elegant architectural property & hostel scenery spanning the background
 * - Layered depth: distant skyline, midground hostel buildings, modern residential facades,
 *   crisp window grids, balconies, and soft campus landscaping
 * - Stays strictly BEHIND content (pointer-events-none, fixed inset-0, z-0)
 */
export function OwnerBackground() {
  return (
    <div 
      aria-hidden="true" 
      className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0"
      style={{
        backgroundColor: '#F5F9FD',
        backgroundImage: `
          radial-gradient(circle at 85% 10%, rgba(186, 230, 253, 0.45) 0%, rgba(245, 249, 253, 0) 65%),
          radial-gradient(circle at 15% 15%, rgba(204, 251, 241, 0.35) 0%, rgba(245, 249, 253, 0) 55%),
          radial-gradient(ellipse 90% 50% at 50% -5%, rgba(255, 255, 255, 0.9) 0%, rgba(224, 242, 254, 0.4) 50%, rgba(245, 249, 253, 0) 100%),
          linear-gradient(180deg, #D9EDF9 0%, #E7F3FA 16%, #EEF6FC 36%, #F4F8FD 65%, #F8FAFD 88%, #FAFCFE 100%)
        `,
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMin slice"
        className="w-full h-full"
      >
        <defs>
          {/* Cloud Filters for Soft, Painterly Edges */}
          <filter id="cloudSoft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="cloudGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          {/* Cloud Gradients */}
          <linearGradient id="cloudBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#F0F9FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="cloudUnder" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.35" />
          </linearGradient>

          {/* Distant Skyline Gradients */}
          <linearGradient id="farSkyline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#7DD3FC" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.04" />
          </linearGradient>

          {/* Midground Hostel Complex Facade Gradient */}
          <linearGradient id="hostelFacade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.32" />
            <stop offset="35%" stopColor="#E0F2FE" stopOpacity="0.2" />
            <stop offset="85%" stopColor="#F0F9FF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.02" />
          </linearGradient>

          {/* Window Glass Tint Gradient */}
          <linearGradient id="windowGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
          </linearGradient>

          {/* Architectural Roof Highlight Accent */}
          <linearGradient id="roofAccentLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#0EA5E9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.45" />
          </linearGradient>

          {/* Lower atmospheric landscape fade */}
          <linearGradient id="lowerAtmosphere" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#0D9488" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#F8FAFD" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ========================================================================= */}
        {/* LAYER 1: ATMOSPHERIC CLOUDS (Subtle, airy cumulus clouds from Image 2)    */}
        {/* ========================================================================= */}
        <g className="clouds-group">
          {/* Cloud Bank Right (Upper atmosphere) */}
          <g opacity="0.85">
            {/* Ambient cloud glow */}
            <path
              d="M1360 80 C1385 45, 1435 35, 1475 55 C1515 35, 1575 35, 1615 65 C1665 55, 1720 75, 1740 115 C1775 130, 1800 170, 1780 205 C1770 230, 1740 245, 1710 245 C1660 255, 1560 260, 1460 255 C1390 250, 1345 225, 1335 185 C1325 145, 1345 105, 1360 80 Z"
              fill="#FFFFFF"
              filter="url(#cloudGlow)"
              opacity="0.6"
            />
            {/* Structured cloud body */}
            <path
              d="M1370 85 C1395 52, 1442 42, 1480 62 C1518 42, 1575 42, 1612 72 C1660 62, 1712 82, 1732 120 C1765 135, 1788 172, 1770 205 C1760 228, 1732 242, 1705 242 C1658 252, 1560 257, 1465 252 C1398 247, 1355 222, 1345 185 C1335 148, 1355 110, 1370 85 Z"
              fill="url(#cloudBody)"
              filter="url(#cloudSoft)"
            />
            {/* Bright highlight lobe */}
            <path
              d="M1420 95 C1450 70, 1500 65, 1535 85 C1568 70, 1615 75, 1645 100 C1680 108, 1705 132, 1705 162 C1705 188, 1680 212, 1645 218 C1590 222, 1510 222, 1440 218 C1400 212, 1380 188, 1385 162 C1390 132, 1405 110, 1420 95 Z"
              fill="#FFFFFF"
              opacity="0.85"
              filter="url(#cloudSoft)"
            />
          </g>

          {/* Cloud Bank Left-Center (Gentle drifting cumulus) */}
          <g opacity="0.8">
            <path
              d="M460 105 C485 78, 528 68, 565 82 C598 68, 645 70, 678 95 C712 88, 755 105, 770 135 C792 155, 798 185, 782 212 C768 232, 742 242, 712 242 C652 248, 562 248, 502 242 C458 238, 438 212, 442 182 C448 152, 452 125, 460 105 Z"
              fill="url(#cloudBody)"
              filter="url(#cloudSoft)"
            />
            <path
              d="M495 115 C520 95, 558 90, 588 105 C615 92, 650 96, 675 116 C700 125, 722 145, 722 170 C722 190, 700 210, 672 215 C625 220, 555 220, 510 215 C475 210, 460 190, 465 170 C470 145, 480 130, 495 115 Z"
              fill="#FFFFFF"
              opacity="0.8"
              filter="url(#cloudSoft)"
            />
          </g>

          {/* Cloud Bank Far Left (Delicate horizon wisps) */}
          <g opacity="0.65" filter="url(#cloudSoft)">
            <path
              d="M80 65 C105 45, 145 40, 180 55 C210 42, 255 46, 280 70 C310 65, 345 80, 360 105 C375 120, 380 145, 368 165 C355 180, 335 190, 305 190 C250 195, 170 195, 120 190 C80 185, 60 165, 65 140 C70 115, 75 85, 80 65 Z"
              fill="url(#cloudBody)"
            />
          </g>

          {/* Cloud Bank Center-Right Wisps */}
          <g opacity="0.55" filter="url(#cloudSoft)">
            <path
              d="M930 135 C960 120, 1010 115, 1050 130 C1090 120, 1140 125, 1170 145 C1205 155, 1230 180, 1225 205 C1220 225, 1195 238, 1160 240 C1100 245, 1010 245, 950 240 C905 235, 885 215, 890 190 C895 165, 910 145, 930 135 Z"
              fill="url(#cloudBody)"
            />
          </g>
        </g>

        {/* ========================================================================= */}
        {/* LAYER 2: DISTANT ARCHITECTURAL SKYLINE (Faint property towers & roofs)   */}
        {/* ========================================================================= */}
        <g className="distant-property-skyline" opacity="0.55" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.45">
          {/* Far Left Towers (x: 90 - 360) */}
          <path d="M100 440 V270 H150 V440" fill="url(#farSkyline)" />
          <path d="M150 440 V300 H195 V440" fill="url(#farSkyline)" />
          <line x1="125" y1="270" x2="125" y2="242" stroke="#0284C7" strokeWidth="1.2" strokeOpacity="0.6" />
          <path d="M210 440 V330 L245 300 L280 330 V440" fill="url(#farSkyline)" />
          <path d="M295 440 V340 H345 V440" fill="url(#farSkyline)" />

          {/* Distant Window Grids Far Left */}
          <g stroke="#0284C7" strokeWidth="0.5" strokeOpacity="0.4" fill="none">
            <line x1="112" y1="290" x2="138" y2="290" />
            <line x1="112" y1="310" x2="138" y2="310" />
            <line x1="112" y1="330" x2="138" y2="330" />
            <line x1="112" y1="350" x2="138" y2="350" />
            <line x1="112" y1="370" x2="138" y2="370" />
            <line x1="112" y1="390" x2="138" y2="390" />
            <line x1="112" y1="410" x2="138" y2="410" />
          </g>

          {/* Center-Left Distant Academic/Hostel Towers (x: 620 - 840) */}
          <path d="M635 460 V315 H685 V460" fill="url(#farSkyline)" />
          <path d="M685 460 V345 H735 V460" fill="url(#farSkyline)" />
          <path d="M735 460 V290 H780 V460" fill="url(#farSkyline)" />
          <line x1="757" y1="290" x2="757" y2="258" stroke="#0284C7" strokeWidth="1.2" strokeOpacity="0.65" />
          <rect x="745" y="298" width="24" height="6" rx="1" fill="#BAE6FD" stroke="none" opacity="0.4" />

          {/* Center-Right Distant High-Rise Complex (x: 1080 - 1300) */}
          <path d="M1090 450 V295 H1140 V450" fill="url(#farSkyline)" />
          <path d="M1140 450 V255 H1190 V450" fill="url(#farSkyline)" />
          <line x1="1165" y1="255" x2="1165" y2="225" stroke="#0284C7" strokeWidth="1.4" strokeOpacity="0.7" />
          <path d="M1190 450 V325 H1235 V450" fill="url(#farSkyline)" />
          <path d="M1245 450 V305 L1275 285 L1305 305 V450" fill="url(#farSkyline)" />

          {/* Far Right Distant City Skyline & Hostel Blocks (x: 1460 - 1900) */}
          <path d="M1475 440 V315 L1515 285 L1555 315 V440" fill="url(#farSkyline)" />
          <path d="M1570 440 V265 H1625 V440" fill="url(#farSkyline)" />
          <line x1="1597" y1="265" x2="1597" y2="232" stroke="#0284C7" strokeWidth="1.2" strokeOpacity="0.65" />
          <path d="M1635 440 V295 H1680 V440" fill="url(#farSkyline)" />
          <path d="M1690 440 V335 L1725 305 L1760 335 V440" fill="url(#farSkyline)" />
          <path d="M1775 440 V275 H1830 V440" fill="url(#farSkyline)" />
          <line x1="1802" y1="275" x2="1802" y2="245" stroke="#0284C7" strokeWidth="1.2" strokeOpacity="0.65" />
        </g>

        {/* ========================================================================= */}
        {/* LAYER 3: MIDGROUND HOSTEL COMPLEXES (Rich, crisp architectural details)   */}
        {/* ========================================================================= */}
        <g className="midground-hostel-architecture" opacity="0.85">
          {/* ----------------------------------------------------------------------- */}
          {/* COMPLEX 1: Left Wing Hostel Residence & Dormitory (x: 50 - 450)         */}
          {/* ----------------------------------------------------------------------- */}
          <g>
            {/* Main Gable Hostel Building */}
            <path
              d="M70 540 V335 L170 280 L270 335 V540 H70 Z"
              fill="url(#hostelFacade)"
              stroke="#0284C7"
              strokeWidth="1.4"
              strokeOpacity="0.6"
            />
            {/* Prominent Gable Roof Highlight */}
            <path d="M64 338 L170 280 L276 338" stroke="url(#roofAccentLine)" strokeWidth="3" strokeLinecap="round" />
            <line x1="170" y1="280" x2="170" y2="335" stroke="#0284C7" strokeWidth="1" strokeOpacity="0.4" />

            {/* Horizontal Balcony & Floor Dividing Cornices */}
            <line x1="85" y1="375" x2="255" y2="375" stroke="#0284C7" strokeWidth="1.1" strokeOpacity="0.45" />
            <line x1="85" y1="425" x2="255" y2="425" stroke="#0284C7" strokeWidth="1.1" strokeOpacity="0.45" />
            <line x1="85" y1="475" x2="255" y2="475" stroke="#0284C7" strokeWidth="1.1" strokeOpacity="0.45" />

            {/* Balcony Railings */}
            <g stroke="#0EA5E9" strokeWidth="0.8" strokeOpacity="0.4" fill="none">
              <line x1="90" y1="372" x2="140" y2="372" />
              <line x1="95" y1="372" x2="95" y2="375" />
              <line x1="110" y1="372" x2="110" y2="375" />
              <line x1="125" y1="372" x2="125" y2="375" />
              <line x1="140" y1="372" x2="140" y2="375" />

              <line x1="180" y1="372" x2="250" y2="372" />
              <line x1="190" y1="372" x2="190" y2="375" />
              <line x1="210" y1="372" x2="210" y2="375" />
              <line x1="230" y1="372" x2="230" y2="375" />
              <line x1="250" y1="372" x2="250" y2="375" />
            </g>

            {/* Window Matrix Floor 3 */}
            <g fill="url(#windowGlass)" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.55">
              <rect x="94" y="340" width="22" height="24" rx="2.5" />
              <rect x="128" y="340" width="22" height="24" rx="2.5" />
              <rect x="180" y="340" width="22" height="24" rx="2.5" />
              <rect x="214" y="340" width="22" height="24" rx="2.5" />
              {/* Window Panes inner cross */}
              <line x1="105" y1="340" x2="105" y2="364" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="139" y1="340" x2="139" y2="364" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="191" y1="340" x2="191" y2="364" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="225" y1="340" x2="225" y2="364" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />

              {/* Floor 2 */}
              <rect x="94" y="390" width="22" height="24" rx="2.5" />
              <rect x="128" y="390" width="22" height="24" rx="2.5" />
              <rect x="180" y="390" width="22" height="24" rx="2.5" />
              <rect x="214" y="390" width="22" height="24" rx="2.5" />
              <line x1="105" y1="390" x2="105" y2="414" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="139" y1="390" x2="139" y2="414" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="191" y1="390" x2="191" y2="414" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="225" y1="390" x2="225" y2="414" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />

              {/* Floor 1 */}
              <rect x="94" y="440" width="22" height="24" rx="2.5" />
              <rect x="128" y="440" width="22" height="24" rx="2.5" />
              <rect x="180" y="440" width="22" height="24" rx="2.5" />
              <rect x="214" y="440" width="22" height="24" rx="2.5" />
              <line x1="105" y1="440" x2="105" y2="464" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="139" y1="440" x2="139" y2="464" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="191" y1="440" x2="191" y2="464" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="225" y1="440" x2="225" y2="464" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
            </g>

            {/* Connected Dormitory Annex Wing */}
            <path
              d="M270 540 V360 H395 V540 H270 Z"
              fill="url(#hostelFacade)"
              stroke="#0284C7"
              strokeWidth="1.3"
              strokeOpacity="0.55"
            />
            <line x1="265" y1="360" x2="400" y2="360" stroke="url(#roofAccentLine)" strokeWidth="2.4" />
            {/* Annex Windows */}
            <g fill="url(#windowGlass)" stroke="#0284C7" strokeWidth="0.8" strokeOpacity="0.55">
              <rect x="290" y="380" width="22" height="24" rx="2.5" />
              <rect x="328" y="380" width="22" height="24" rx="2.5" />
              <rect x="362" y="380" width="22" height="24" rx="2.5" />

              <rect x="290" y="425" width="22" height="24" rx="2.5" />
              <rect x="328" y="425" width="22" height="24" rx="2.5" />
              <rect x="362" y="425" width="22" height="24" rx="2.5" />

              <rect x="290" y="470" width="22" height="24" rx="2.5" />
              <rect x="328" y="470" width="22" height="24" rx="2.5" />
              <rect x="362" y="470" width="22" height="24" rx="2.5" />
            </g>
          </g>

          {/* ----------------------------------------------------------------------- */}
          {/* COMPLEX 2: Central Campus Pavilion & Modern Architecture (x: 800 - 1040) */}
          {/* ----------------------------------------------------------------------- */}
          <g opacity="0.8">
            <path
              d="M820 560 V360 L925 305 L1030 360 V560 H820 Z"
              fill="url(#hostelFacade)"
              stroke="#0D9488"
              strokeWidth="1.3"
              strokeOpacity="0.55"
            />
            <path d="M814 362 L925 305 L1036 362" stroke="url(#roofAccentLine)" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="815" y1="360" x2="1035" y2="360" stroke="#0D9488" strokeWidth="1.5" strokeOpacity="0.6" />

            {/* Central Glass Atrium Grid */}
            <g stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.45" fill="none">
              <line x1="845" y1="385" x2="1005" y2="385" />
              <line x1="845" y1="415" x2="1005" y2="415" />
              <line x1="845" y1="445" x2="1005" y2="445" />
              <line x1="845" y1="475" x2="1005" y2="475" />
              <line x1="845" y1="505" x2="1005" y2="505" />
              <line x1="925" y1="310" x2="925" y2="540" stroke="#0D9488" strokeWidth="1.2" />
              <line x1="885" y1="360" x2="885" y2="540" />
              <line x1="965" y1="360" x2="965" y2="540" />
            </g>
          </g>

          {/* ----------------------------------------------------------------------- */}
          {/* COMPLEX 3: Right Wing Primary Hostel Complex (x: 1400 - 1880)           */}
          {/* Matches the prominent building perspective seen in Image 2              */}
          {/* ----------------------------------------------------------------------- */}
          <g>
            {/* Main Multi-story Residential Block */}
            <path
              d="M1410 560 V315 H1605 V560 H1410 Z"
              fill="url(#hostelFacade)"
              stroke="#0284C7"
              strokeWidth="1.4"
              strokeOpacity="0.6"
            />
            {/* Parapet Roofline Header */}
            <line x1="1402" y1="315" x2="1612" y2="315" stroke="url(#roofAccentLine)" strokeWidth="3" strokeLinecap="round" />
            <rect x="1435" y="302" width="45" height="13" rx="1.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.55" />
            <rect x="1540" y="302" width="35" height="13" rx="1.5" fill="#E0F2FE" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.55" />

            {/* Architectural Vertical Column Dividers */}
            <line x1="1475" y1="315" x2="1475" y2="540" stroke="#0284C7" strokeWidth="0.8" strokeOpacity="0.3" />
            <line x1="1540" y1="315" x2="1540" y2="540" stroke="#0284C7" strokeWidth="0.8" strokeOpacity="0.3" />

            {/* 4-Story Window Matrix */}
            <g fill="url(#windowGlass)" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.55">
              {/* Row 4 (Top) */}
              <rect x="1430" y="335" width="28" height="26" rx="2.5" />
              <rect x="1495" y="335" width="28" height="26" rx="2.5" />
              <rect x="1560" y="335" width="28" height="26" rx="2.5" />
              <line x1="1444" y1="335" x2="1444" y2="361" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1509" y1="335" x2="1509" y2="361" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1574" y1="335" x2="1574" y2="361" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />

              {/* Row 3 */}
              <rect x="1430" y="380" width="28" height="26" rx="2.5" />
              <rect x="1495" y="380" width="28" height="26" rx="2.5" />
              <rect x="1560" y="380" width="28" height="26" rx="2.5" />
              <line x1="1444" y1="380" x2="1444" y2="406" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1509" y1="380" x2="1509" y2="406" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1574" y1="380" x2="1574" y2="406" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />

              {/* Row 2 */}
              <rect x="1430" y="425" width="28" height="26" rx="2.5" />
              <rect x="1495" y="425" width="28" height="26" rx="2.5" />
              <rect x="1560" y="425" width="28" height="26" rx="2.5" />
              <line x1="1444" y1="425" x2="1444" y2="451" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1509" y1="425" x2="1509" y2="451" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1574" y1="425" x2="1574" y2="451" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />

              {/* Row 1 (Ground) */}
              <rect x="1430" y="470" width="28" height="26" rx="2.5" />
              <rect x="1495" y="470" width="28" height="26" rx="2.5" />
              <rect x="1560" y="470" width="28" height="26" rx="2.5" />
              <line x1="1444" y1="470" x2="1444" y2="496" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1509" y1="470" x2="1509" y2="496" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
              <line x1="1574" y1="470" x2="1574" y2="496" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.6" />
            </g>

            {/* Stepped Slanted Hostel Wing (Right Edge) */}
            <path
              d="M1605 560 V350 L1725 285 L1845 350 V560 H1605 Z"
              fill="url(#hostelFacade)"
              stroke="#0284C7"
              strokeWidth="1.4"
              strokeOpacity="0.6"
            />
            {/* Slanted Roof Ridge */}
            <path d="M1598 352 L1725 285 L1852 352" stroke="url(#roofAccentLine)" strokeWidth="3" strokeLinecap="round" />
            <line x1="1725" y1="285" x2="1725" y2="350" stroke="#0284C7" strokeWidth="1.1" strokeOpacity="0.4" />

            {/* Stepped Wing Window Matrix */}
            <g fill="url(#windowGlass)" stroke="#0284C7" strokeWidth="0.85" strokeOpacity="0.55">
              <rect x="1635" y="370" width="26" height="28" rx="2.5" />
              <rect x="1675" y="370" width="26" height="28" rx="2.5" />
              <rect x="1750" y="370" width="26" height="28" rx="2.5" />
              <rect x="1790" y="370" width="26" height="28" rx="2.5" />

              <rect x="1635" y="415" width="26" height="28" rx="2.5" />
              <rect x="1675" y="415" width="26" height="28" rx="2.5" />
              <rect x="1750" y="415" width="26" height="28" rx="2.5" />
              <rect x="1790" y="415" width="26" height="28" rx="2.5" />

              <rect x="1635" y="460" width="26" height="28" rx="2.5" />
              <rect x="1675" y="460" width="26" height="28" rx="2.5" />
              <rect x="1750" y="460" width="26" height="28" rx="2.5" />
              <rect x="1790" y="460" width="26" height="28" rx="2.5" />
            </g>
          </g>

          {/* ----------------------------------------------------------------------- */}
          {/* CAMPUS LANDSCAPING & TREE SILHOUETTES (Organic property greenery)       */}
          {/* ----------------------------------------------------------------------- */}
          <g className="campus-landscaping" opacity="0.4">
            {/* Greenery Left Base */}
            <path
              d="M45 540 C50 500, 85 495, 105 515 C125 490, 160 495, 175 540 Z"
              fill="#0D9488"
              fillOpacity="0.32"
            />
            <path
              d="M235 540 C245 510, 275 505, 295 522 C312 505, 340 510, 355 540 Z"
              fill="#0D9488"
              fillOpacity="0.28"
            />
            <path
              d="M380 540 C392 515, 415 510, 432 522 C445 510, 468 515, 480 540 Z"
              fill="#10B981"
              fillOpacity="0.25"
            />

            {/* Greenery Center Base */}
            <path
              d="M775 560 C788 528, 815 522, 832 540 C845 522, 872 528, 885 560 Z"
              fill="#0D9488"
              fillOpacity="0.28"
            />
            <path
              d="M975 560 C988 532, 1012 528, 1028 545 C1040 532, 1062 536, 1075 560 Z"
              fill="#0D9488"
              fillOpacity="0.28"
            />

            {/* Greenery Right Base */}
            <path
              d="M1365 560 C1378 528, 1405 522, 1422 542 C1438 520, 1468 528, 1480 560 Z"
              fill="#0D9488"
              fillOpacity="0.32"
            />
            <path
              d="M1815 560 C1828 525, 1855 518, 1872 535 C1888 518, 1915 525, 1925 560 Z"
              fill="#10B981"
              fillOpacity="0.28"
            />

            {/* Ground Rolling Landscape Contour */}
            <path
              d="M0 550 Q480 515 960 535 T1920 540 V1080 H0 Z"
              fill="#F8FAFD"
              fillOpacity="0.5"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
