import React from 'react';
import Link from 'next/link';
import { Building2, Sparkles, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F4F9FC] flex flex-col justify-between relative overflow-hidden select-none">
      {/* Ambient background gradients */}
      <div
        className="absolute inset-0 pointer-events-none -z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 40% at 20% 20%, rgba(204, 238, 249, 0.6) 0%, transparent 70%),
            radial-gradient(ellipse 50% 35% at 80% 80%, rgba(220, 245, 240, 0.6) 0%, transparent 65%),
            linear-gradient(180deg, #EAF4F9 0%, #F4FAFD 50%, #FFFFFF 100%)
          `,
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-xl w-fit"
          aria-label="HostelHub Home"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#064E4A] via-[#0F766E] to-[#043330] text-white shadow-md shadow-teal-950/20 ring-1 ring-teal-500/20">
            <Building2 className="h-5 w-5 text-white" />
            <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[#042f2e] ring-2 ring-white">
              <Sparkles className="h-2 w-2" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slate-900 font-display leading-tight">
              Hostel<span className="text-[#0F766E]">Hub</span>
            </span>
            <span className="text-[9px] font-bold tracking-wider text-[#0F766E] uppercase leading-none">
              Your Stay, Simplified
            </span>
          </div>
        </Link>
      </header>

      {/* Main 404 message */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-md w-full text-center space-y-6 bg-white/80 backdrop-blur-md p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-teal-950/5">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-teal-50 text-[#0F766E] border border-teal-200/60 shadow-inner">
            <span className="font-display text-2xl font-black">404</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              We couldn&apos;t find the page you&apos;re looking for. It might have been moved, renamed, or is temporarily unavailable.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0F766E] hover:bg-teal-800 text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Return Home</span>
            </Link>
            <Link
              href="/find-hostel"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-sm transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Browse Hostels</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} HostelHub Technologies. All rights reserved.
      </footer>
    </div>
  );
}
