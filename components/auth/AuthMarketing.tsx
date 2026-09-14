'use client';

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Users2,
  Headphones,
} from 'lucide-react';
import { HostelHubLogo } from '@/components/HostelHubLogo';

const features = [
  {
    icon: ShieldCheck,
    title: 'Safe & Secure',
    desc: 'Bank-grade encrypted data & verified check-ins',
  },
  {
    icon: CheckCircle2,
    title: 'Verified Hostels & Rooms',
    desc: 'Physical audit certified rooms & amenities',
  },
  {
    icon: Users2,
    title: 'Student & Owner Friendly',
    desc: 'Tailored dashboards for residents & management',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    desc: 'Immediate ticket resolution & assistance',
  },
];

export function AuthMarketing() {
  return (
    <div className="flex flex-col justify-center h-full max-w-xl py-2 select-none">
      {/* 1. Authentic HostelHub Brand Logo sitting directly on the background */}
      <div className="mb-6">
        <HostelHubLogo size="lg" variant="dark" href="/" />
      </div>

      {/* 2. Premium Headline & Supporting Text sitting directly on the background (NO card) */}
      <div className="space-y-3 mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-[1.14] font-display">
          Find Your Perfect{' '}
          <span className="text-[#064E4A] block sm:inline">Stay at HostelHub</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg font-medium">
          Manage your stay, pay your bills, and stay connected — all in one place.
        </p>
      </div>

      {/* 3. Lightweight, elegant feature items directly on background (NOT 4 giant cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-4.5 mb-8">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-start gap-3 p-1.5 transition-transform duration-200"
            >
              {/* Elegant icon in subtle circular background */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/85 text-[#064E4A] shadow-xs border border-teal-900/10 backdrop-blur-xs">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0 pt-0.5">
                <span className="text-sm font-bold text-slate-900 leading-snug">
                  {item.title}
                </span>
                <span className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Subtle community endorsement text directly on background */}
      <div className="pt-4 border-t border-slate-300/50 flex flex-col gap-1 max-w-md">
        <span className="text-[11px] font-bold tracking-wider text-[#0F766E] uppercase">
          • Better Stays • Brighter Futures
        </span>
        <span className="text-xs text-slate-500 leading-relaxed">
          Empowering hostel owners &amp; residents across India with unified digital living.
        </span>
      </div>
    </div>
  );
}
