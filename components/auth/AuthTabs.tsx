'use client';

import React from 'react';

export type AuthTabType = 'login' | 'signup';

interface AuthTabsProps {
  activeTab: AuthTabType;
  onTabChange: (tab: AuthTabType) => void;
  disabled?: boolean;
}

/**
 * AuthTabs:
 * - Nested cleanly inside the dark premium teal card
 * - Fixed container: deep teal surface (#032623) with subtle border
 * - Active tab: Refined HostelHub teal (#0F766E to #0D9488) with crisp white text
 * - Inactive tab: Soft muted teal-white text with clean hover
 * - Zero sliding pill animation; strictly smooth opacity transition
 * - Outer card remains completely anchored
 */
export function AuthTabs({ activeTab, onTabChange, disabled = false }: AuthTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Authentication Options"
      className="grid grid-cols-2 p-1 rounded-xl bg-[#032623] border border-teal-500/20 shadow-inner mb-4 select-none"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'login'}
        aria-controls="auth-panel-login"
        id="auth-tab-login"
        disabled={disabled}
        onClick={() => onTabChange('login')}
        className={`flex items-center justify-center h-9 sm:h-9.5 rounded-lg text-xs sm:text-[13px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
          activeTab === 'login'
            ? 'bg-gradient-to-r from-[#0F766E] to-[#0D9488] text-white font-bold shadow-xs'
            : 'text-teal-100/75 hover:text-white font-medium hover:bg-white/[0.05]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        Sign In
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'signup'}
        aria-controls="auth-panel-signup"
        id="auth-tab-signup"
        disabled={disabled}
        onClick={() => onTabChange('signup')}
        className={`flex items-center justify-center h-9 sm:h-9.5 rounded-lg text-xs sm:text-[13px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
          activeTab === 'signup'
            ? 'bg-gradient-to-r from-[#0F766E] to-[#0D9488] text-white font-bold shadow-xs'
            : 'text-teal-100/75 hover:text-white font-medium hover:bg-white/[0.05]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        Sign Up
      </button>
    </div>
  );
}
