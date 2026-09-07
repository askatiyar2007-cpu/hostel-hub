'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SidebarBackground
 * 
 * Recreates the dark navy / teal architectural skyline atmosphere from Image 2.
 * Sits at the bottom of the sidebar behind navigation and logout (z-index: 0).
 * Features subtle hostel / building silhouettes, modern geometric skylines,
 * and low-opacity cyan/teal line-art with an organic upward fade.
 */
export function SidebarBackground({ isCollapsed = false }: { isCollapsed?: boolean }) {
  return (
    <div 
      aria-hidden="true" 
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-80 overflow-hidden select-none z-0 transition-opacity duration-300",
        isCollapsed ? "opacity-35" : "opacity-80"
      )}
    >
      <svg
        viewBox="0 0 256 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax slice"
        className="w-full h-full"
      >
        <defs>
          {/* Vertical mask to fade the top of the cityscape seamlessly into the dark sidebar base */}
          <linearGradient id="sidebarCityFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>

          {/* Glowing bottom horizon atmospheric gradient */}
          <linearGradient id="sidebarHorizonGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.16" />
          </linearGradient>

          {/* Building Fill Gradients */}
          <linearGradient id="bldgFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e3a47" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#061c24" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="bldgMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f4c5c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#08232c" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="bldgNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#115e59" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#041f24" stopOpacity="0.95" />
          </linearGradient>

          <mask id="sidebarMask">
            <rect width="256" height="320" fill="url(#sidebarCityFade)" />
          </mask>
        </defs>

        <g mask="url(#sidebarMask)">
          {/* Subtle atmospheric ambient glow at bottom */}
          <rect x="0" y="80" width="256" height="240" fill="url(#sidebarHorizonGlow)" />

          {/* =================================================== */}
          {/* BACKGROUND LAYER: Far distant buildings & towers   */}
          {/* =================================================== */}
          <g opacity="0.35" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.35">
            {/* Distant Spire / Tower (Left-center) */}
            <path d="M68 90 L68 120 L76 130 L76 320 H60 L60 130 L68 120 Z" fill="url(#bldgFar)" />
            <line x1="68" y1="70" x2="68" y2="90" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />

            {/* Distant High-Rise (Right) */}
            <path d="M180 115 H216 V320 H180 Z" fill="url(#bldgFar)" />
            {/* Distant Window Grid */}
            <g stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.4" fill="none">
              <line x1="186" y1="130" x2="210" y2="130" />
              <line x1="186" y1="145" x2="210" y2="145" />
              <line x1="186" y1="160" x2="210" y2="160" />
              <line x1="186" y1="175" x2="210" y2="175" />
              <line x1="186" y1="190" x2="210" y2="190" />
              <line x1="186" y1="205" x2="210" y2="205" />
            </g>

            {/* Distant Stepped Tower (Center) */}
            <path d="M110 135 H145 V320 H110 Z" fill="url(#bldgFar)" />
            <line x1="118" y1="135" x2="118" y2="122" stroke="#38bdf8" strokeWidth="0.8" />
            <line x1="137" y1="135" x2="137" y2="122" stroke="#38bdf8" strokeWidth="0.8" />
          </g>

          {/* =================================================== */}
          {/* MIDGROUND LAYER: Hostel complexes & angled roofs    */}
          {/* =================================================== */}
          <g opacity="0.6">
            {/* Mid Building Left-Center: Stepped Roofs */}
            <path
              d="M36 140 H74 V155 H90 V320 H36 Z"
              fill="url(#bldgMid)"
              stroke="#14b8a6"
              strokeWidth="0.9"
              strokeOpacity="0.5"
            />
            {/* Rooftop Parapet Lines */}
            <line x1="36" y1="140" x2="74" y2="140" stroke="#2dd4bf" strokeWidth="1.2" strokeOpacity="0.7" />
            <line x1="74" y1="155" x2="90" y2="155" stroke="#2dd4bf" strokeWidth="1.2" strokeOpacity="0.7" />
            {/* Windows */}
            <g fill="#2dd4bf" fillOpacity="0.15" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.5">
              <rect x="44" y="152" width="8" height="9" rx="1.5" />
              <rect x="58" y="152" width="8" height="9" rx="1.5" />
              <rect x="44" y="168" width="8" height="9" rx="1.5" />
              <rect x="58" y="168" width="8" height="9" rx="1.5" />
              <rect x="44" y="184" width="8" height="9" rx="1.5" />
              <rect x="58" y="184" width="8" height="9" rx="1.5" />
              <rect x="76" y="168" width="8" height="9" rx="1.5" />
              <rect x="76" y="184" width="8" height="9" rx="1.5" />
            </g>

            {/* Mid Building Center-Right: Angled Modern Hostel Block */}
            <path
              d="M130 150 L172 132 V320 H130 Z"
              fill="url(#bldgMid)"
              stroke="#0d9488"
              strokeWidth="1"
              strokeOpacity="0.55"
            />
            {/* Angled Roof highlight */}
            <line x1="130" y1="150" x2="172" y2="132" stroke="#2dd4bf" strokeWidth="1.4" strokeOpacity="0.7" />
            {/* Vertical Mullion Ribs */}
            <line x1="144" y1="144" x2="144" y2="280" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.3" />
            <line x1="158" y1="138" x2="158" y2="280" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.3" />
            {/* Horizontal Floor Lines */}
            <line x1="130" y1="170" x2="172" y2="155" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.4" />
            <line x1="130" y1="190" x2="172" y2="175" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.4" />
            <line x1="130" y1="210" x2="172" y2="195" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.4" />
          </g>

          {/* =================================================== */}
          {/* FOREGROUND LAYER: Primary architectural silhouettes */}
          {/* =================================================== */}
          <g opacity="0.85">
            {/* Main Foreground Building (Left edge & corner) */}
            <path
              d="M-10 180 L28 162 V320 H-10 Z"
              fill="url(#bldgNear)"
              stroke="#14b8a6"
              strokeWidth="1.2"
              strokeOpacity="0.7"
            />
            {/* Roof edge glow */}
            <line x1="-10" y1="180" x2="28" y2="162" stroke="#5eead4" strokeWidth="1.5" strokeOpacity="0.8" />
            {/* Left Building Windows */}
            <g fill="#5eead4" fillOpacity="0.22" stroke="#2dd4bf" strokeWidth="0.6" strokeOpacity="0.6">
              <rect x="2" y="185" width="8" height="11" rx="1.5" />
              <rect x="15" y="178" width="8" height="11" rx="1.5" />
              <rect x="2" y="204" width="8" height="11" rx="1.5" />
              <rect x="15" y="197" width="8" height="11" rx="1.5" />
              <rect x="2" y="223" width="8" height="11" rx="1.5" />
              <rect x="15" y="216" width="8" height="11" rx="1.5" />
            </g>

            {/* Foreground Main Hostel Center Complex */}
            <path
              d="M86 175 H138 V320 H86 Z"
              fill="url(#bldgNear)"
              stroke="#14b8a6"
              strokeWidth="1.2"
              strokeOpacity="0.7"
            />
            {/* Roof cornice highlight */}
            <line x1="84" y1="175" x2="140" y2="175" stroke="#5eead4" strokeWidth="1.8" strokeOpacity="0.85" />
            <rect x="94" y="167" width="16" height="8" rx="1" fill="#0f4c5c" stroke="#2dd4bf" strokeWidth="0.8" strokeOpacity="0.6" />
            <line x1="126" y1="175" x2="126" y2="162" stroke="#2dd4bf" strokeWidth="1" strokeOpacity="0.6" />

            {/* Glowing Window Matrix for Central Building */}
            <g fill="#2dd4bf" fillOpacity="0.25" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.65">
              <rect x="93" y="188" width="9" height="11" rx="1.5" />
              <rect x="106" y="188" width="9" height="11" rx="1.5" />
              <rect x="119" y="188" width="9" height="11" rx="1.5" />

              <rect x="93" y="207" width="9" height="11" rx="1.5" />
              <rect x="106" y="207" width="9" height="11" rx="1.5" />
              <rect x="119" y="207" width="9" height="11" rx="1.5" />

              <rect x="93" y="226" width="9" height="11" rx="1.5" />
              <rect x="106" y="226" width="9" height="11" rx="1.5" />
              <rect x="119" y="226" width="9" height="11" rx="1.5" />

              <rect x="93" y="245" width="9" height="11" rx="1.5" />
              <rect x="106" y="245" width="9" height="11" rx="1.5" />
              <rect x="119" y="245" width="9" height="11" rx="1.5" />
            </g>

            {/* Foreground Right Building with Slanted Modern Architecture */}
            <path
              d="M190 195 L228 178 L265 195 V320 H190 Z"
              fill="url(#bldgNear)"
              stroke="#14b8a6"
              strokeWidth="1.1"
              strokeOpacity="0.65"
            />
            {/* Ridge highlight */}
            <line x1="190" y1="195" x2="228" y2="178" stroke="#5eead4" strokeWidth="1.4" strokeOpacity="0.75" />
            <line x1="228" y1="178" x2="265" y2="195" stroke="#5eead4" strokeWidth="1.4" strokeOpacity="0.75" />
            {/* Windows */}
            <g fill="#2dd4bf" fillOpacity="0.2" stroke="#14b8a6" strokeWidth="0.6" strokeOpacity="0.5">
              <rect x="200" y="204" width="9" height="10" rx="1.5" />
              <rect x="215" y="198" width="9" height="10" rx="1.5" />
              <rect x="232" y="198" width="9" height="10" rx="1.5" />
              <rect x="247" y="204" width="9" height="10" rx="1.5" />

              <rect x="200" y="222" width="9" height="10" rx="1.5" />
              <rect x="215" y="216" width="9" height="10" rx="1.5" />
              <rect x="232" y="216" width="9" height="10" rx="1.5" />
              <rect x="247" y="222" width="9" height="10" rx="1.5" />

              <rect x="200" y="240" width="9" height="10" rx="1.5" />
              <rect x="215" y="234" width="9" height="10" rx="1.5" />
              <rect x="232" y="234" width="9" height="10" rx="1.5" />
              <rect x="247" y="240" width="9" height="10" rx="1.5" />
            </g>

            {/* Subtle tree & landscaping silhouettes at the base */}
            <path
              d="M20 320 C22 305 32 302 38 310 C44 300 56 302 60 320 Z"
              fill="#0d9488"
              fillOpacity="0.3"
            />
            <path
              d="M142 320 C146 308 156 305 162 312 C168 304 180 306 184 320 Z"
              fill="#0d9488"
              fillOpacity="0.3"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
