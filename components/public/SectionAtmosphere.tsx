'use client';

import React from 'react';

interface SectionAtmosphereProps {
  variant: 'search' | 'discovery' | 'features' | 'student' | 'billing' | 'journey' | 'pricing' | 'cta';
  children?: React.ReactNode;
}

/**
 * SectionAtmosphere:
 * - Provides tailored, layered atmospheric background for each homepage section
 * - Seamlessly continues the campus/sky environment across the whole experience
 * - Keeps visual intensity controlled so content cards remain clean and readable
 * - Includes slow, tasteful motion (20s-60s) respecting prefers-reduced-motion
 */
export default function SectionAtmosphere({ variant }: SectionAtmosphereProps) {
  if (variant === 'search') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(224, 242, 254, 0.45) 0%, transparent 65%),
            linear-gradient(180deg, #FAFCFB 0%, #F5FBF9 50%, #FAFCFB 100%)
          `,
        }}
      >
        {/* Subtle drifting clouds in search background */}
        <div className="absolute top-0 left-10 w-96 h-32 bg-white/40 rounded-full blur-2xl animate-cloud-slow" />
        <div className="absolute top-8 right-12 w-80 h-28 bg-sky-100/35 rounded-full blur-2xl animate-cloud-mid" />
      </div>
    );
  }

  if (variant === 'discovery') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 85% 20%, rgba(204, 251, 241, 0.35) 0%, transparent 60%),
            radial-gradient(ellipse 60% 45% at 15% 75%, rgba(224, 242, 254, 0.4) 0%, transparent 65%),
            linear-gradient(180deg, #FAFCFB 0%, #F4F9F8 50%, #FAFCFB 100%)
          `,
        }}
      >
        {/* Subtle ambient light bokeh */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-100/25 rounded-full blur-3xl animate-particle-drift" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-100/30 rounded-full blur-3xl animate-particle-drift" />
        {/* Soft distant architectural blueprint hint at very low opacity */}
        <svg className="absolute inset-x-0 bottom-0 w-full h-32 text-teal-900/[0.02]" preserveAspectRatio="none" viewBox="0 0 1200 120">
          <path d="M0,120 L0,80 L120,80 L120,60 L240,60 L240,120 L480,120 L480,50 L600,50 L600,120 L900,120 L900,70 L1020,70 L1020,120 Z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  if (variant === 'features') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 65% 50% at 20% 30%, rgba(240, 253, 250, 0.7) 0%, transparent 60%),
            radial-gradient(ellipse 70% 55% at 80% 70%, rgba(241, 248, 255, 0.65) 0%, transparent 65%),
            linear-gradient(180deg, #FFFFFF 0%, #F7FBFA 50%, #FFFFFF 100%)
          `,
        }}
      >
        <div className="absolute top-12 right-20 w-96 h-48 bg-teal-100/20 rounded-full blur-3xl animate-cloud-slow" />
      </div>
    );
  }

  if (variant === 'student') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 75% 55% at 25% 20%, rgba(204, 251, 241, 0.45) 0%, transparent 60%),
            radial-gradient(ellipse 65% 50% at 80% 80%, rgba(224, 242, 254, 0.45) 0%, transparent 60%),
            linear-gradient(180deg, #F2FAF9 0%, #E8F5F2 50%, #F2FAF9 100%)
          `,
        }}
      >
        <div className="absolute top-1/3 left-10 w-80 h-80 bg-emerald-200/20 rounded-full blur-3xl animate-particle-drift" />
      </div>
    );
  }

  if (variant === 'billing') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60% 45% at 75% 25%, rgba(224, 242, 254, 0.4) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 25% 75%, rgba(204, 251, 241, 0.35) 0%, transparent 60%),
            linear-gradient(180deg, #FAFCFB 0%, #F5FAFA 50%, #FAFCFB 100%)
          `,
        }}
      >
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-sky-100/35 rounded-full blur-3xl animate-cloud-mid" />
      </div>
    );
  }

  if (variant === 'journey') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 70% 45% at 50% 20%, rgba(240, 253, 250, 0.6) 0%, transparent 65%),
            linear-gradient(180deg, #FFFFFF 0%, #F6FAF9 50%, #FFFFFF 100%)
          `,
        }}
      >
        <div className="absolute top-10 left-1/3 w-96 h-40 bg-teal-100/25 rounded-full blur-3xl animate-cloud-slow" />
      </div>
    );
  }

  if (variant === 'pricing') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 15% 20%, rgba(224, 242, 254, 0.4) 0%, transparent 60%),
            radial-gradient(ellipse 65% 45% at 85% 70%, rgba(204, 251, 241, 0.35) 0%, transparent 60%),
            linear-gradient(180deg, #FAFCFB 0%, #F3F9F8 50%, #FAFCFB 100%)
          `,
        }}
      >
        <div className="absolute top-1/3 left-20 w-80 h-80 bg-teal-100/20 rounded-full blur-3xl animate-particle-drift" />
      </div>
    );
  }

  if (variant === 'cta') {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none -z-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 85% 20%, rgba(20, 184, 166, 0.25) 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 15% 80%, rgba(13, 148, 136, 0.3) 0%, transparent 65%),
            linear-gradient(165deg, #075E59 0%, #064E4A 45%, #043834 100%)
          `,
        }}
      >
        {/* Soft slow ambient light pulse in CTA */}
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-teal-400/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl animate-pulse-glow" />
      </div>
    );
  }

  return null;
}
