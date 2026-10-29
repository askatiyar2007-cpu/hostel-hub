'use client';

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Users2,
  Headphones,
} from 'lucide-react';
import { StayKoshLogo } from '@/components/StayKoshLogo';

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
      {/* 1. Real StayKosh Logo directly on the background */}
      <div className="mb-7">
        <StayKoshLogo size="lg" theme="light" href="/" />
      </div>

      {/* 2. Editorial Typography: Slate-900 with rich #0F766E accent for high contrast */}
      <div className="space-y-3.5 mb-9">
        <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-900 dark:text-white tracking-tight leading-[1.12] font-display">
          Find Your Perfect{' '}
          <span className="text-[#0F766E] dark:text-teal-400 block sm:inline">Stay at StayKosh</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 leading-relaxed max-w-lg font-medium">
          Manage your stay, pay your bills, and stay connected — all in one place.
        </p>
      </div>

      {/* 3. Lightweight Inline Feature Blocks with high-contrast icon pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mb-8">
        {features.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center text-[#0F766E] dark:text-teal-300 shrink-0 shadow-xs">
                <Icon className="h-5 w-5 stroke-[2.25]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                  {item.title}
                </span>
                <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Community endorsement text with clear contrast */}
      <div className="pt-4 border-t border-slate-200 dark:border-[#1a3d52] flex flex-col gap-1 max-w-md">
        <span className="text-[11px] font-bold tracking-wider text-[#0F766E] dark:text-teal-400 uppercase">
          • Better Stays • Brighter Futures
        </span>
        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          Empowering hostel owners &amp; residents across India with unified digital living.
        </span>
      </div>
    </div>
  );
}
