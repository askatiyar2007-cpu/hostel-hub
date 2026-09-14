'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, Sparkles, Heart } from 'lucide-react';

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#071922] text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-12 border-b border-slate-800/80">
          {/* Col 1: Brand & Identity */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group" aria-label="HostelHub Home">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md">
                <Building2 className="h-5 w-5" />
                <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[#042f2e] ring-2 ring-[#071922]">
                  <Sparkles className="h-2 w-2" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white font-display">
                  Hostel<span className="text-teal-400">Hub</span>
                </span>
                <span className="text-[9px] font-semibold tracking-wider text-teal-300/80 uppercase">
                  Your Stay, Simplified
                </span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Modern student accommodation platform and hostel management system connecting students and verified property owners.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-2 text-xs text-teal-400 font-medium bg-teal-950/60 px-3 py-1.5 rounded-full border border-teal-800/50">
                Better Stays • Brighter Futures
              </span>
            </div>
          </div>

          {/* Col 2: For Students */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Students & Parents
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/find-hostel" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Browse Hostels
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-slate-400 hover:text-teal-400 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Student Portal Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Create Student Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: For Hostel Owners */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Hostel Owners
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/signup" className="text-slate-400 hover:text-teal-400 transition-colors">
                  List Your Hostel
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Management Features
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Owner Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Owner Dashboard Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform & Support */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/find-hostel" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Search Accommodations
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Digital Billing Transparency
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Account Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-slate-400 hover:text-teal-400 transition-colors">
                  Get Started Today
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {currentYear} HostelHub Technologies. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Built for modern student accommodation</span>
            <Heart className="h-3 w-3 text-teal-400 fill-teal-400 inline mx-0.5" />
          </div>
        </div>
      </div>
    </footer>
  );
}
