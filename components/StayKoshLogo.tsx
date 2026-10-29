'use client';

import React from 'react';
import Link from 'next/link';

export interface StayKoshLogoProps {
  size?: number;
  showWordmark?: boolean;
  theme?: 'dark' | 'light';
  badgeText?: string;
  href?: string;
  className?: string;
}

export const StayKoshLogo: React.FC<StayKoshLogoProps> = ({
  size = 36,
  showWordmark = true,
  theme = 'light',
  badgeText,
  href,
  className = '',
}) => {
  const isPermanentDark = theme === 'dark';
  const stayColor = isPermanentDark ? '#FFFFFF' : '#0F172A';
  const koshColor = isPermanentDark ? '#34D399' : '#0D6E5B';

  const logoMark = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Flat 2D "Roof-S + Twin Coins" Vector Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
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
            className={`font-extrabold tracking-tight font-display leading-none ${
              isPermanentDark
                ? 'text-white'
                : 'text-slate-900 dark:text-white'
            }`}
            style={{
              fontSize: Math.max(16, Math.round(size * 0.55)),
              color: isPermanentDark ? stayColor : undefined,
            }}
          >
            Stay
            <span
              className={
                isPermanentDark
                  ? 'text-[#34D399]'
                  : 'text-[#0D6E5B] dark:text-[#34D399]'
              }
              style={{
                color: isPermanentDark ? koshColor : undefined,
              }}
            >
              Kosh
            </span>
          </span>
          {badgeText && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold tracking-wider leading-none uppercase ${
                isPermanentDark
                  ? 'text-[#34D399]'
                  : 'text-[#0D6E5B] dark:text-[#34D399]'
              }`}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                color: isPermanentDark ? '#34D399' : undefined,
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
