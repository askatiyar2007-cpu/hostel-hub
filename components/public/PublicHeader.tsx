'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { StayKoshLogo } from '@/components/StayKoshLogo';

export default function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/find-hostel', label: 'Browse Hostels' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#features', label: 'Features' },
    { href: '/#pricing', label: 'Pricing' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 h-20 ${
        scrolled
          ? 'bg-white/95 dark:bg-[#07131d]/95 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800/80'
          : 'bg-white/95 dark:bg-[#07131d]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sm:bg-transparent sm:backdrop-blur-none sm:border-transparent'
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Real Brand Logo Component */}
        <StayKoshLogo size="md" theme="auto" href="/" />

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-slate-600 dark:text-slate-300 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors duration-150 py-1 font-medium"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA / Auth */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors duration-150 px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden inline-flex items-center justify-center p-2.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#122b3b] hover:text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-600 transition-colors"
          aria-label="Open main menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop & Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Full-width Opaque Mobile Menu Overlay */}
          <div className="fixed inset-x-0 top-0 z-50 w-full bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-white/10 shadow-xl flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header row spanning 100% of viewport */}
            <div className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
              <StayKoshLogo size="sm" theme="auto" href="/" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation links with clean spacing */}
            <nav className="flex flex-col gap-1 p-4 text-base font-medium text-slate-800 dark:text-slate-100">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-800 dark:text-slate-100 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {/* Clean footer inside menu for Sign In & Get Started */}
              <div className="pt-3 mt-2 border-t border-slate-100 dark:border-white/10 flex flex-col gap-2.5">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-[#0F766E] text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
