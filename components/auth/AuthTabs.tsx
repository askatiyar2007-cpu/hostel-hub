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
 * - Rounded pill switcher nested cleanly inside the deep teal authentication card
 * - Container: Deep teal surface (#043634) with subtle translucent border
 * - Active tab: Refined HostelHub teal (#0F766E to #0D9488) with crisp white text
 * - Inactive tab: Soft muted teal-white text with clean hover
 * - Zero sliding or layout shifts on switch
 */
export function AuthTabs({ activeTab, onTabChange, disabled = false }: AuthTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Authentication Options"
      className="grid grid-cols-2 p-1 rounded-full bg-[#043330]/90 border border-teal-500/20 shadow-inner mb-4"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'login'}
        aria-controls="auth-panel-login"
        id="auth-tab-login"
        disabled={disabled}
        onClick={() => onTabChange('login')}
        className={`flex items-center justify-center h-8.5 sm:h-9 rounded-full text-xs sm:text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
          activeTab === 'login'
            ? 'bg-gradient-to-r from-[#0F766E] to-[#0D9488] text-white font-bold shadow-xs'
            : 'text-teal-100/75 hover:text-white font-medium'
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
        className={`flex items-center justify-center h-8.5 sm:h-9 rounded-full text-xs sm:text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
          activeTab === 'signup'
            ? 'bg-gradient-to-r from-[#0F766E] to-[#0D9488] text-white font-bold shadow-xs'
            : 'text-teal-100/75 hover:text-white font-medium'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        Sign Up
      </button>
    </div>
  );
}
