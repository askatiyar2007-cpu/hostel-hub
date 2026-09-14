'use client';

import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AuthCard:
 * - The ONLY major card surface on the login / signup page
 * - Sophisticated deep teal / blue-green gradient: #063F3D -> #064E4A -> #075E59
 * - Subtle tonal variation and very subtle internal lighting
 * - Thin low-opacity border (border-white/10 to border-teal-500/20)
 * - Soft, deep shadow for premium physical elevation without neon glow
 * - Compact width: 440px - 480px, fitting comfortably on 1365x768, 1440x900, 1920x1080
 */
export function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div className="relative w-full max-w-[450px] sm:max-w-[465px]">
      {/* Soft atmospheric ambient shadow */}
      <div
        className="absolute -inset-1 rounded-[30px] bg-teal-950/30 blur-lg pointer-events-none"
        aria-hidden="true"
      />

      {/* Primary Card Surface */}
      <div
        className={`relative rounded-[24px] sm:rounded-[26px] border border-teal-400/20 text-white backdrop-blur-md overflow-hidden transition-none ${className}`}
        style={{
          background: 'linear-gradient(168deg, #075E59 0%, #064E4A 45%, #063F3D 100%)',
          boxShadow:
            '0 24px 50px -12px rgba(3, 35, 33, 0.6), 0 8px 24px -6px rgba(3, 35, 33, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Very subtle internal top highlight for depth */}
        <div
          className="absolute inset-x-0 top-0 h-28 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20, 184, 166, 0.15) 0%, transparent 80%)',
          }}
          aria-hidden="true"
        />

        {/* Card inner padding designed for comfortable fit */}
        <div className="relative z-10 p-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
