'use client';

import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AuthCard:
 * - The ONLY major card surface on the authentication page
 * - Restored previous dark premium style:
 *   TOP: #07534C -> #064A44 -> #063F3A -> BOTTOM: #043B37
 * - Deep dark teal / blue-green tonal gradient (NOT bright green, NOT neon)
 * - Subtle 1px border, soft shadow, moderate radius
 * - Comfortable desktop width (440px - 480px)
 * - Remains physically anchored on tab switch
 * - Entrance animation on page load only
 */
export function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div className="relative w-full max-w-[460px] sm:max-w-[480px] animate-auth-card-enter">
      {/* Soft atmospheric ambient shadow */}
      <div
        className="absolute -inset-1 rounded-[28px] bg-[#011C1A]/40 blur-xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Primary Dark Premium Card Surface */}
      <div
        className={`relative rounded-[22px] sm:rounded-[24px] border border-teal-500/20 text-white backdrop-blur-md overflow-hidden transition-none ${className}`}
        style={{
          background: 'linear-gradient(175deg, #07534C 0%, #064A44 35%, #063F3A 70%, #043B37 100%)',
          boxShadow:
            '0 24px 50px -12px rgba(1, 24, 22, 0.65), 0 8px 20px -6px rgba(1, 24, 22, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Subtle internal top ambient highlight for depth */}
        <div
          className="absolute inset-x-0 top-0 h-28 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(20, 184, 166, 0.1) 0%, transparent 80%)',
          }}
          aria-hidden="true"
        />

        {/* Card inner content container with comfortable breathing room */}
        <div className="relative z-10 p-6 sm:px-8 sm:py-7">{children}</div>
      </div>
    </div>
  );
}
