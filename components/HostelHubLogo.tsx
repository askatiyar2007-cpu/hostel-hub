'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, Sparkles } from 'lucide-react';

interface HostelHubLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  href?: string;
  className?: string;
  showTagline?: boolean;
}

export function HostelHubLogo({
  size = 'md',
  variant = 'dark',
  href = '/',
  className = '',
  showTagline = true,
}: HostelHubLogoProps) {
  const isLight = variant === 'light';

  const iconSizes = {
    sm: { container: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4', badge: 'h-3 w-3 -bottom-0.5 -right-0.5', star: 'h-2 w-2' },
    md: { container: 'h-10 w-10 sm:h-11 sm:w-11 rounded-xl', icon: 'h-5 w-5 sm:h-5.5 sm:w-5.5', badge: 'h-3.5 w-3.5 sm:h-4 sm:w-4 -bottom-1 -right-1', star: 'h-2 w-2 sm:h-2.5 sm:w-2.5' },
    lg: { container: 'h-12 w-12 sm:h-13 sm:w-13 rounded-2xl', icon: 'h-6 w-6 sm:h-7 sm:w-7', badge: 'h-4 w-4 sm:h-4.5 sm:w-4.5 -bottom-1 -right-1', star: 'h-2.5 w-2.5 sm:h-3 sm:w-3' },
  };

  const textSizes = {
    sm: 'text-lg leading-tight',
    md: 'text-xl sm:text-2xl leading-tight',
    lg: 'text-2xl sm:text-3xl leading-tight',
  };

  const tagSizes = {
    sm: 'text-[8px]',
    md: 'text-[9px] sm:text-[10px]',
    lg: 'text-[10px] sm:text-[11px]',
  };

  const content = (
    <div className={`inline-flex items-center gap-3 group focus:outline-none select-none ${className}`}>
      {/* Visual Logo Tile */}
      <div
        className={`relative flex items-center justify-center shrink-0 bg-gradient-to-br from-[#064E4A] via-[#0F766E] to-[#043330] text-white shadow-md shadow-teal-950/20 ring-1 ring-teal-500/25 group-hover:scale-105 transition-transform duration-200 ${iconSizes[size].container}`}
      >
        <Building2 className={`${iconSizes[size].icon} text-white drop-shadow-xs`} />
        <div
          className={`absolute flex items-center justify-center rounded-full bg-emerald-400 text-[#042f2e] ring-2 ${
            isLight ? 'ring-[#064E4A]' : 'ring-white'
          } ${iconSizes[size].badge}`}
        >
          <Sparkles className={iconSizes[size].star} />
        </div>
      </div>

      {/* Wordmark & Tagline */}
      <div className="flex flex-col">
        <span
          className={`font-bold tracking-tight font-display ${textSizes[size]} ${
            isLight ? 'text-white' : 'text-slate-900'
          }`}
        >
          Hostel<span className={isLight ? 'text-teal-300' : 'text-[#0F766E]'}>Hub</span>
        </span>
        {showTagline && (
          <span
            className={`font-semibold tracking-wider uppercase leading-none mt-0.5 ${tagSizes[size]} ${
              isLight ? 'text-teal-200/80' : 'text-teal-800/80'
            }`}
          >
            Your Stay, Simplified
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-xl inline-block"
        aria-label="HostelHub Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}
