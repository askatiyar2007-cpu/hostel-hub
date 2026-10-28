'use client';

import React from 'react';
import { AuthBackground } from './AuthBackground';
import { AuthMarketing } from './AuthMarketing';
import { StayKoshLogo } from '@/components/StayKoshLogo';

interface AuthShellProps {
  children: React.ReactNode;
  activeTab?: 'login' | 'signup';
  onTabChange?: (tab: 'login' | 'signup') => void;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen relative isolate overflow-x-hidden flex flex-col justify-between select-none">
      {/* Calm, peaceful, morning university campus atmospheric background */}
      <AuthBackground />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 flex items-center justify-between">
        {/* Mobile Header Logo (<lg screens) */}
        <div className="lg:hidden">
          <StayKoshLogo size={32} theme="dark" href="/" />
        </div>

        {/* Desktop left space (logo is positioned inside AuthMarketing directly on background) */}
        <div className="hidden lg:block" />
      </header>

      {/* Main content: Responsive two-column desktop layout / stacked mobile */}
      <main className="relative z-10 w-full flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-12 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto my-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 xl:gap-16">
            {/* Left Column: Marketing Content directly on background (Desktop full, Mobile headline) */}
            <section
              aria-label="About StayKosh"
              className="w-full lg:w-[50%] xl:w-[52%] flex flex-col justify-center"
            >
              {/* Desktop Full View */}
              <div className="hidden lg:block">
                <AuthMarketing />
              </div>

              {/* Mobile Compact View (Directly on background, NO white card) */}
              <div className="lg:hidden text-center sm:text-left space-y-2 py-1 max-w-md mx-auto sm:mx-0 animate-auth-marketing-enter">
                <h1 className="text-2xl sm:text-3xl font-bold text-[#102033] dark:text-white tracking-tight leading-tight font-display">
                  Find Your Perfect{' '}
                  <span className="text-[#0F766E] dark:text-teal-400">Stay at StayKosh</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  Manage your stay, pay your bills, and stay connected — all in one place.
                </p>
              </div>
            </section>

            {/* Right Column: Authentication Card (The ONLY major card on the page) */}
            <section
              aria-label="Account Authentication"
              className="w-full lg:w-[50%] xl:w-[48%] flex justify-center lg:justify-end"
            >
              {children}
            </section>
          </div>
        </div>
      </main>

      {/* Subtle bottom footer bar */}
      <footer className="relative z-10 w-full py-3 text-center text-xs text-slate-500/80 dark:text-slate-400">
        <span>© {new Date().getFullYear()} StayKosh. All rights reserved.</span>
      </footer>
    </div>
  );
}
