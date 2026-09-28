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
    <div className="flex flex-col justify-center h-full max-w-xl py-2 select-none animate-auth-marketing-enter">
      {/* 1. Real HostelHub Logo directly on the background */}
      <div className="mb-7">
        <HostelHubLogo size="lg" variant="dark" href="/" />
      </div>

      {/* 2. Editorial Typography: 42–58px desktop, dark navy #102033 with #0F766E accent */}
      <div className="space-y-3.5 mb-9">
        <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-[#102033] tracking-tight leading-[1.12] font-display">
          Find Your Perfect{' '}
          <span className="text-[#0F766E] block sm:inline">Stay at HostelHub</span>
        </h1>
        <p className="text-base sm:text-[17px] text-slate-600 leading-relaxed max-w-lg font-normal">
          Manage your stay, pay your bills, and stay connected — all in one place.
        </p>
      </div>

      {/* 3. Lightweight Inline Feature Blocks: Pure line icons & typography (NO boxes, NO cards, NO white circles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mb-8">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3">
              <div className="pt-0.5 text-[#0F766E] shrink-0">
                <Icon className="h-5 w-5 stroke-[2.25]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-[#102033] leading-snug">
                  {item.title}
                </span>
                <span className="text-xs sm:text-[13px] text-slate-500 mt-0.5 leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Subtle community endorsement text */}
      <div className="pt-4 border-t border-slate-300/40 flex flex-col gap-1 max-w-md">
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
