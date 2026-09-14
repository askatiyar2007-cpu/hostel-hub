'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AuthBackground } from './AuthBackground';
import { AuthMarketing } from './AuthMarketing';
import { HostelHubLogo } from '@/components/HostelHubLogo';

interface AuthShellProps {
  children: React.ReactNode;
  activeTab?: 'login' | 'signup';
  onTabChange?: (tab: 'login' | 'signup') => void;
}

function SwitchLink({
  activeTab,
  onTabChange,
}: {
  activeTab?: 'login' | 'signup';
  onTabChange?: (tab: 'login' | 'signup') => void;
}) {
  const searchParams = useSearchParams();
  const currentTab = activeTab ?? (searchParams.get('tab') === 'signup' ? 'signup' : 'login');
  const isSignup = currentTab === 'signup';

  if (onTabChange) {
    return (
      <button
        type="button"
        onClick={() => onTabChange(isSignup ? 'login' : 'signup')}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 hover:text-[#064E4A] backdrop-blur-md border border-slate-200/80 shadow-xs transition-all duration-150 cursor-pointer"
      >
        <span>{isSignup ? 'Already have an account?' : "Don't have an account?"}</span>
        <span className="text-[#064E4A] font-bold flex items-center gap-0.5">
          {isSignup ? 'Sign In' : 'Sign Up'}
          <ArrowRight className="h-3 w-3" />
        </span>
      </button>
    );
  }

  return (
    <Link
      href={isSignup ? '/auth/login?tab=login' : '/auth/login?tab=signup'}
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 hover:text-[#064E4A] backdrop-blur-md border border-slate-200/80 shadow-xs transition-all duration-150"
    >
      <span>{isSignup ? 'Already have an account?' : "Don't have an account?"}</span>
      <span className="text-[#064E4A] font-bold flex items-center gap-0.5">
        {isSignup ? 'Sign In' : 'Sign Up'}
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

export function AuthShell({ children, activeTab, onTabChange }: AuthShellProps) {
  return (
    <div className="min-h-screen relative isolate overflow-x-hidden flex flex-col justify-between select-none">
      {/* Calm, peaceful, morning university campus atmospheric background (20-30% visual intensity) */}
      <AuthBackground />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 flex items-center justify-between">
        {/* Mobile Header Logo (<lg screens) */}
        <div className="lg:hidden">
          <HostelHubLogo size="sm" variant="dark" href="/" />
        </div>

        {/* Desktop left space (logo is positioned inside AuthMarketing directly on background) */}
        <div className="hidden lg:block" />

        {/* Top-Right Switch Link */}
        <div className="flex items-center ml-auto">
          <Suspense fallback={<div className="h-7 w-40" />}>
            <SwitchLink activeTab={activeTab} onTabChange={onTabChange} />
          </Suspense>
        </div>
      </header>

      {/* Main content: Responsive two-column desktop layout / stacked mobile */}
      <main className="relative z-10 w-full flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 xl:gap-16">
            {/* Left Column: Marketing Content directly on background (Desktop full, Mobile headline) */}
            <section
              aria-label="About HostelHub"
              className="w-full lg:w-[50%] xl:w-[52%] flex flex-col justify-center"
            >
              {/* Desktop Full View */}
              <div className="hidden lg:block">
                <AuthMarketing />
              </div>

              {/* Mobile Compact View (Directly on background, NO white card) */}
              <div className="lg:hidden text-center sm:text-left space-y-2 py-1 max-w-md mx-auto sm:mx-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight font-display">
                  Find Your Perfect{' '}
                  <span className="text-[#064E4A]">Stay at HostelHub</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
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
      <footer className="relative z-10 w-full py-3 text-center text-xs text-slate-500/80">
        <span>© {new Date().getFullYear()} HostelHub. All rights reserved.</span>
      </footer>
    </div>
  );
}
