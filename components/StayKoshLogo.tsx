'use client';

import React from 'react';
import Link from 'next/link';

export interface StayKoshLogoProps {
  size?: 'sm' | 'md' | 'lg' | number;
  showWordmark?: boolean;
  theme?: 'dark' | 'light' | 'auto';
  badgeText?: string;
  href?: string;
  className?: string;
}

export const StayKoshLogo: React.FC<StayKoshLogoProps> = ({
  size = 'md',
  showWordmark = true,
  theme = 'light',
  badgeText,
  href,
  className = '',
}) => {
  const isPermanentDark = theme === 'dark';
  const isPermanentLight = theme === 'light';
  const stayColor = isPermanentDark ? '#FFFFFF' : isPermanentLight ? '#0F172A' : undefined;
  const koshColor = isPermanentDark ? '#34D399' : isPermanentLight ? '#0D6E5B' : undefined;

  // Resolve responsive icon dimensions & typography scale matching HostelHub's design system
  let numericSize: number;
  let iconClass = '';
  let textClass = '';
  let gapClass = 'gap-2.5';
  let badgeClass = 'text-[10px] px-1.5 py-0.5';

  if (size === 'sm') {
    numericSize = 32;
    iconClass = 'w-8 h-8';
    textClass = 'text-lg leading-tight';
    gapClass = 'gap-2';
    badgeClass = 'text-[9px] px-1.5 py-0.5';
  } else if (size === 'lg') {
    numericSize = 48;
    iconClass = 'w-12 h-12 sm:w-[52px] sm:h-[52px]';
    textClass = 'text-2xl sm:text-3xl leading-tight';
    gapClass = 'gap-3 sm:gap-3.5';
    badgeClass = 'text-xs px-2 py-0.5';
  } else if (size === 'md') {
    numericSize = 40;
    iconClass = 'w-10 h-10 sm:w-11 sm:h-11';
    textClass = 'text-xl sm:text-2xl leading-tight';
    gapClass = 'gap-2.5 sm:gap-3';
    badgeClass = 'text-[10px] px-1.5 py-0.5';
  } else {
    // Custom numeric size
    numericSize = typeof size === 'number' ? size : 36;
    if (numericSize >= 46) {
      iconClass = 'w-12 h-12 sm:w-[52px] sm:h-[52px]';
      textClass = 'text-2xl sm:text-3xl leading-tight';
      gapClass = 'gap-3 sm:gap-3.5';
      badgeClass = 'text-xs px-2 py-0.5';
    } else if (numericSize >= 36) {
      iconClass = 'w-10 h-10 sm:w-11 sm:h-11';
      textClass = 'text-xl sm:text-2xl leading-tight';
      gapClass = 'gap-2.5 sm:gap-3';
      badgeClass = 'text-[10px] px-1.5 py-0.5';
    } else {
      iconClass = 'w-8 h-8';
      textClass = 'text-lg leading-tight';
      gapClass = 'gap-2';
      badgeClass = 'text-[9px] px-1.5 py-0.5';
    }
  }

  const logoMark = (
    <div className={`inline-flex items-center ${gapClass} select-none ${className}`}>
      {/* Flat 2D "Roof-S + Twin Coins" Vector Mark */}
      <svg
        width={numericSize}
        height={numericSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconClass}`}
        aria-hidden="true"
      >
        {/* Flat Deep Emerald Squircle Background */}
        <rect x="0" y="0" width="100" height="100" rx="24" fill="#0D6E5B" />

        {/* Architectural Roof Peak ("Stay") */}
        <path
          d="M 19 42 L 50 17 L 81 42"
          stroke="#FFFFFF"
          strokeWidth="7.5"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* Upper Right Roof-to-S Loop */}
        <path
          d="M 65 30 C 68 37 66 45 60 49"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Continuous Central 'S' Vault Curve ("Kosh") */}
        <path
          d="M 35 30 C 31 42 36 51 50 56 C 64 61 68 70 64 79 C 60 87 40 87 36 79 C 33 73 35 66 40 62"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Twin Mint Kosh Coins (Top & Bottom Chambers) */}
        <circle cx="50" cy="39" r="6.5" fill="#34D399" />
        <circle cx="50" cy="72" r="6.5" fill="#34D399" />
      </svg>

      {/* Horizontal Wordmark & Optional Role Badge */}
      {showWordmark && (
        <div className="flex items-center gap-2">
          <span
            className={`font-bold tracking-tight font-display ${textClass} ${
              isPermanentDark
                ? 'text-white'
                : isPermanentLight
                ? 'text-slate-900'
                : 'text-slate-900 dark:text-white'
            }`}
            style={{
              color: stayColor,
            }}
          >
            Stay
            <span
              className={
                isPermanentDark
                  ? 'text-[#34D399]'
                  : isPermanentLight
                  ? 'text-[#0D6E5B]'
                  : 'text-[#0D6E5B] dark:text-[#34D399]'
              }
              style={{
                color: koshColor,
              }}
            >
              Kosh
            </span>
          </span>
          {badgeText && (
            <span
              className={`inline-flex items-center rounded font-extrabold tracking-wider leading-none uppercase ${badgeClass} ${
                isPermanentDark
                  ? 'text-[#34D399]'
                  : isPermanentLight
                  ? 'text-[#0D6E5B]'
                  : 'text-[#0D6E5B] dark:text-[#34D399]'
              }`}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                color: koshColor,
              }}
            >
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-xl"
        aria-label={badgeText ? `StayKosh ${badgeText}` : 'StayKosh Home'}
      >
        {logoMark}
      </Link>
    );
  }

  return logoMark;
};

export default StayKoshLogo;
