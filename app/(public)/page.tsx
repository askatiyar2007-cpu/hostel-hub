'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { supabase } from '@/lib/supabase/client';
import {
  Building2,
  Search,
  MapPin,
  Bed,
  Star,
  ArrowRight,
  Users,
  Zap,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Home,
  Receipt,
  MessageSquare,
  Check,
  Compass,
} from 'lucide-react';

import HeroArchitecturalVisual from '@/components/public/HeroArchitecturalVisual';
import CampusHeroBackground from '@/components/public/CampusHeroBackground';
import SearchExperience from '@/components/public/SearchExperience';
import DigitalReceipt from '@/components/public/DigitalReceipt';
import StudentInteriorVisual from '@/components/public/StudentInteriorVisual';
import HostelCardVisual from '@/components/public/HostelCardVisual';
import PublicFooter from '@/components/public/PublicFooter';

interface HostelListing {
  id: string;
  name: string;
  city?: string;
  state?: string;
  starting_price?: number;
  rating?: number;
  cover_image_url?: string | null;
  amenities?: string[];
  status?: string;
}

export default function PublicHomePage() {
  const { profile, loading, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();

  const [hostels, setHostels] = useState<HostelListing[]>([]);
  const [loadingHostels, setLoadingHostels] = useState(true);

  // Authentication redirection logic
  useEffect(() => {
    if (loading || !profile) return;

    if (password_set === false) {
      router.push('/auth/login');
      return;
    }

    if (accountCompletionStep === 'role') {
      router.push('/auth/select-role');
      return;
    }

    if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
      router.push('/auth/setup-password');
      return;
    }

    if (accountCompletionStep === 'complete') {
      const path = dashboardPathForRole(profile.role);
      if (path) {
        router.push(path);
      } else {
        router.push('/auth/select-role');
      }
    }
  }, [profile, loading, accountCompletionStep, password_set, router]);

  // Fetch real hostel listings from Supabase
  useEffect(() => {
    async function loadHostels() {
      try {
        const { data, error } = await supabase
          .from('hostels')
          .select('id, name, city, state, starting_price, rating, cover_image_url, amenities, status')
          .limit(6);

        if (!error && data) {
          setHostels(data as HostelListing[]);
        }
      } catch (err) {
        console.error('Error loading public hostels:', err);
      } finally {
        setLoadingHostels(false);
      }
    }

    loadHostels();
  }, []);

  if (loading || profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5FBFF]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#0F766E] border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider text-[#0F766E] uppercase">Loading HostelHub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFCFB] text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION — Natural Integrated Atmosphere (No Giant White Card)     */}
      {/* ========================================================================= */}
      <section className="relative isolate pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-18 lg:pb-32 overflow-hidden">
        {/* Layered Animated Campus Morning Background */}
        <CampusHeroBackground />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left: Headline & CTAs (7 cols) - Directly integrated over campus atmosphere */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/80 bg-white/90 px-4 py-1.5 shadow-2xs backdrop-blur-xs">
                <span className="flex h-2 w-2 rounded-full bg-[#0F766E] animate-pulse" />
                <span className="text-xs font-semibold tracking-wider text-teal-950 uppercase">
                  Verified Student Accommodation
                </span>
              </div>

              {/* Main Headline with Serif Fraunces & Teal Accent */}
              <h1 className="text-4xl sm:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 font-display leading-[1.08]">
                Find a place<br />
                you&apos;ll love to call<br />
                <span className="text-[#0F766E] relative inline-block">
                  home.
                  <svg
                    className="absolute -bottom-2.5 left-0 w-full text-teal-400/50 -z-10 h-3"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    fill="currentColor"
                  >
                    <path d="M0,8 Q50,0 100,8 L100,12 Q50,4 0,12 Z" />
                  </svg>
                </span>
              </h1>

              {/* Supporting Text */}
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0 font-medium">
                Discover hostels, compare rooms, and manage your stay — all in one place.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                <Link
                  href="/find-hostel"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F766E] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-teal-900/15 hover:bg-teal-800 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Find a Hostel</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/90 px-8 py-4 text-base font-semibold text-slate-700 hover:bg-white hover:border-slate-400 transition-all duration-200 shadow-xs"
                >
                  I&apos;m a Hostel Owner
                </Link>
              </div>

              {/* Compact Trust / Value Metrics (Simple text & icon elements) */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto lg:mx-0">
                <div className="flex items-center gap-2.5 bg-white/70 backdrop-blur-xs p-2.5 sm:p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                  <ShieldCheck className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p className="text-base sm:text-xl font-bold text-slate-900 font-display leading-none">100%</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">Verified</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-white/70 backdrop-blur-xs p-2.5 sm:p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p className="text-base sm:text-xl font-bold text-slate-900 font-display leading-none">₹0</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">Brokerage</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-white/70 backdrop-blur-xs p-2.5 sm:p-3 rounded-2xl border border-slate-200/60 shadow-2xs">
                  <Sparkles className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p className="text-base sm:text-xl font-bold text-slate-900 font-display leading-none">Instant</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">Check-in</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Modern Daylight Student Residence Showcase (5 cols) */}
            <div className="lg:col-span-5 w-full animate-float">
              <HeroArchitecturalVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SEARCH EXPERIENCE — Sleek Marketplace Search Bar                       */}
      {/* ========================================================================= */}
      <SearchExperience />

      {/* ========================================================================= */}
      {/* 3. HOSTEL DISCOVERY — Airbnb/Booking-Style Listing Cards                  */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-[#FAFCFB] relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-14">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-2">
                Curated Accommodations
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 font-display tracking-tight">
                Discover Great Hostels
              </h2>
            </div>
            <Link
              href="/find-hostel"
              className="mt-4 md:mt-0 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F766E] hover:text-teal-800 transition-colors"
            >
              Browse all verified hostels <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Cards Grid */}
          {loadingHostels ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 rounded-3xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : hostels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {hostels.map((hostel, idx) => (
                <Link
                  key={hostel.id}
                  href={`/hostels/${hostel.id}`}
                  className="group block rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#0F766E] motion-reduce:transform-none"
                >
                  {/* Property Visual Header */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    {hostel.cover_image_url ? (
                      <img
                        src={hostel.cover_image_url}
                        alt={hostel.name}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transform-none"
                      />
                    ) : (
                      <HostelCardVisual name={hostel.name} city={hostel.city} variant={idx} />
                    )}

                    {/* Verified Badge */}
                    <div className="absolute top-3.5 left-3.5 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-[#0F766E] border border-teal-200/80 flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </div>

                    {/* Star Rating if available */}
                    {hostel.rating && hostel.rating > 0 ? (
                      <div className="absolute top-3.5 right-3.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-slate-900 border border-slate-200/60 shadow-2xs">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{hostel.rating}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-xl font-bold text-slate-900 font-display group-hover:text-[#0F766E] transition-colors line-clamp-1">
                        {hostel.name}
                      </h3>
                    </div>

                    {/* Location */}
                    {(hostel.city || hostel.state) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                        <MapPin className="h-3.5 w-3.5 text-[#0F766E] shrink-0" />
                        <span>{[hostel.city, hostel.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}

                    {/* Amenities */}
                    {hostel.amenities && hostel.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {hostel.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity}
                            className="inline-flex items-center text-[11px] font-medium bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/60"
                          >
                            {amenity}
                          </span>
                        ))}
                        {hostel.amenities.length > 3 && (
                          <span className="text-[11px] font-medium text-slate-400 py-1 px-1">
                            +{hostel.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Pricing & CTA */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                          Starting From
                        </span>
                        {hostel.starting_price ? (
                          <span className="text-lg font-bold text-[#0F766E]">
                            ₹{hostel.starting_price.toLocaleString('en-IN')}
                            <span className="text-xs font-normal text-slate-500">/mo</span>
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-slate-600">Contact for Pricing</span>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-[#0F766E] transition-colors">
                        View Stay <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Fallback Empty State */
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center max-w-2xl mx-auto shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0F766E] mb-4">
                <Compass className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-display mb-2">
                Looking for Hostels in your Area?
              </h3>
              <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                Hostels are being verified daily across educational hubs. Search by specific location or register your property.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/find-hostel"
                  className="rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors"
                >
                  Search by Location
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  List Your Hostel
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. VALUE PROPOSITION (Editorial / Asymmetric Layout)                      */}
      {/* ========================================================================= */}
      <section id="features" className="py-20 sm:py-28 bg-white border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14 sm:mb-18">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              The HostelHub Standard
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight leading-tight">
              Everything about your stay, in one place.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
              Replacing scattered WhatsApp chats, paper receipt books, and unclear deposits with one seamless student accommodation standard.
            </p>
          </div>

          {/* Asymmetrical 3-Pillar Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Pillar 1: DISCOVER (Spans 7 cols on desktop) */}
            <div className="lg:col-span-7 rounded-3xl bg-gradient-to-br from-[#F2FAF9] to-[#E8F5F2] p-8 sm:p-12 border border-teal-100 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xs font-mono font-bold tracking-widest text-[#0F766E] uppercase bg-white/80 px-3 py-1.5 rounded-full shadow-2xs">
                    01 • DISCOVER
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F766E] text-white shadow-md">
                    <Search className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mb-4">
                  Find verified student residences without the broker guesswork.
                </h3>
                <p className="text-slate-600 leading-relaxed mb-8 max-w-lg">
                  Every listed hostel undergoes physical auditing. Compare room configurations, attached bathrooms, mess quality, distance to your college campus, and curfew guidelines upfront.
                </p>
              </div>

              {/* Visual sub-strip */}
              <div className="grid grid-cols-3 gap-3 bg-white/70 backdrop-blur-xs rounded-2xl p-4 border border-teal-200/50">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900">Room Audits</p>
                  <p className="text-[11px] text-slate-500">Verified Photos</p>
                </div>
                <div className="text-center border-x border-slate-200">
                  <p className="text-xs font-bold text-slate-900">Zero Broker</p>
                  <p className="text-[11px] text-slate-500">Direct Owner Terms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900">Campus Proximity</p>
                  <p className="text-[11px] text-slate-500">Exact GPS Coordinates</p>
                </div>
              </div>
            </div>

            {/* Pillar 2: MANAGE (Spans 5 cols on desktop) */}
            <div className="lg:col-span-5 rounded-3xl bg-[#071922] text-white p-8 sm:p-10 border border-slate-800 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase bg-slate-800/80 px-3 py-1.5 rounded-full">
                    02 • MANAGE
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white font-display mb-3">
                  Effortless day-to-day stay management.
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Raise maintenance tickets for leaking taps or Wi-Fi drops, track resolution times, review digital agreements, and receive owner notices directly on your personal student dashboard.
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>Real-time complaint tracking &amp; resolution status</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>Official digital announcements &amp; gate timings</span>
                </div>
              </div>
            </div>

            {/* Pillar 3: PAY (Spans full 12 cols as a sleek horizontal anchor) */}
            <div className="lg:col-span-12 rounded-3xl bg-slate-50 border border-slate-200/90 p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-xs">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono font-bold tracking-widest text-[#0F766E] uppercase bg-teal-100/60 px-3 py-1 rounded-full">
                    03 • PAY
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mb-2">
                  Itemized billing with zero hidden surprises.
                </h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Transparent sub-meter electricity readings, automated monthly rent reminders, and instantaneous verifiable digital receipts that keep students, owners, and parents in total alignment.
                </p>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/#how-it-works"
                  className="rounded-full bg-white border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs w-full sm:w-auto text-center"
                >
                  See Billing System
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-[#0F766E] px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shadow-xs w-full sm:w-auto text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. STUDENT LIVING ("A Place to Call Home")                                 */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-[#F2FAF9] via-[#E8F5F2] to-[#F2FAF9] border-b border-teal-100/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Visual on left (6 cols) */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <StudentInteriorVisual />
            </div>

            {/* Emotional copy and checklist on right (6 cols) */}
            <div className="lg:col-span-6 space-y-8 order-1 lg:order-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
                  Student Living Redefined
                </span>
                <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight leading-[1.15]">
                  More than a room.<br />
                  A place to call home.
                </h2>
                <p className="text-base sm:text-lg text-slate-600 mt-5 leading-relaxed">
                  Moving to a new city for your education is an adventure. We believe your living space should be your sanctuary — a quiet desk for late-night exams, a clean bed to recharge, and a supportive community you can rely on.
                </p>
              </div>

              {/* Exact Checklist */}
              <div className="space-y-4 pt-2">
                {[
                  { title: 'Discover hostels', desc: 'Browse audited accommodations with transparent room standards.' },
                  { title: 'Compare rooms', desc: 'Single occupancy, attached washroom, or shared double configurations.' },
                  { title: 'Check availability', desc: 'Real-time vacancy tracking so you never waste a site visit.' },
                  { title: 'Manage your stay', desc: 'One app for room requests, bill payments, and maintenance notices.' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 bg-white/75 backdrop-blur-xs p-3.5 rounded-2xl border border-teal-200/50 shadow-2xs">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F766E] text-white shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link
                  href="/find-hostel"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0F766E] px-7 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-teal-800 transition-colors"
                >
                  <span>Explore Student Rooms</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. BILLING TRANSPARENCY (Digital Receipt)                                 */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-[#FAFCFB]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left copy (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block">
                Zero Hidden Charges
              </span>
              <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight leading-tight">
                Clear, itemized billing on every stay.
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                No more sudden end-of-month surprises. HostelHub provides a clean, automated digital receipt with clear itemization for room rent, verified sub-meter electricity units, and maintenance.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0F766E] mb-3">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Meter-Accurate Electricity</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Recorded sub-meter readings split transparently by room occupants.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0F766E] mb-3">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Instant Verifiable Receipts</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Downloadable GST-compliant PDF receipts for parent tax and reimbursements.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Digital Receipt (5 cols) */}
            <div className="lg:col-span-5">
              <DigitalReceipt />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. HOW IT WORKS (Timeline Journey)                                        */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-white border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-2">
              Simple 4-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 font-display tracking-tight">
              Your Journey to Hassle-Free Living
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              From finding your preferred room to moving in and handling monthly stays with total peace of mind.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Connective Line */}
            <div className="hidden lg:block absolute top-12 left-16 right-16 h-0.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 -z-0 opacity-25" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {[
                {
                  step: '01',
                  name: 'DISCOVER',
                  title: 'Discover Accommodation',
                  desc: 'Search verified hostels in your target education hub and compare audited photos, mess menus, and room types.',
                  icon: Search,
                },
                {
                  step: '02',
                  name: 'CHOOSE',
                  title: 'Choose Room & Bed',
                  desc: 'Pick your preferred room occupancy, check active bed availability, and schedule a physical or digital walkthrough.',
                  icon: Bed,
                },
                {
                  step: '03',
                  name: 'MOVE IN',
                  title: 'Move In Smoothly',
                  desc: 'Complete quick digital KYC onboarding, review your room condition, and receive instant digital keys/credentials.',
                  icon: Home,
                },
                {
                  step: '04',
                  name: 'MANAGE',
                  title: 'Manage Your Stay',
                  desc: 'Pay itemized rent and meter bills online, raise maintenance tickets, and track announcements in one tap.',
                  icon: Sparkles,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-3xl bg-[#FAFCFB] border border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between hover:border-teal-400/50 hover:shadow-md transition-all duration-300 group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="font-mono text-2xl font-extrabold text-[#0F766E] tracking-tight">
                        {item.step}
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-2xs text-teal-700 border border-teal-100 group-hover:scale-110 transition-transform">
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>

                    <span className="text-[11px] font-bold tracking-widest text-teal-800 uppercase block mb-1">
                      {item.name}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 font-display mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. OWNER SECTION (Operations Dashboard Preview)                          */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-[#071922] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-18">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-2">
              For Property Owners &amp; Wardens
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-white">
              Built for Modern Hostel Operations
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
              Replace messy paper registers, missed electricity readings, and forgotten rent dues with HostelHub&apos;s intelligent property management suite.
            </p>
          </div>

          {/* 4 Pillars Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Rooms */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 hover:border-teal-500/40 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 mb-4">
                <Bed className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-display mb-1">Rooms &amp; Beds</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Real-time occupancy mapping, vacancy notifications, and bed allocation records.
              </p>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
                <span>Total Capacity</span>
                <span className="font-mono font-bold text-teal-400">94% Occupied</span>
              </div>
            </div>

            {/* Students */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 hover:border-teal-500/40 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 mb-4">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-display mb-1">Student Directory</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Digital KYC records, parent emergency contacts, and room allotment history.
              </p>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
                <span>Verified Onboarding</span>
                <span className="font-mono font-bold text-emerald-400">100% Digital</span>
              </div>
            </div>

            {/* Bills */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 hover:border-teal-500/40 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 mb-4">
                <CreditCard className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-display mb-1">Bills &amp; Sub-Meters</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Automated rent calculation, electricity reading split, and WhatsApp payment links.
              </p>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
                <span>Collection Rate</span>
                <span className="font-mono font-bold text-teal-400">98.5% on-time</span>
              </div>
            </div>

            {/* Complaints */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 hover:border-teal-500/40 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-display mb-1">Complaint Desk</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Track plumber, electrician, and Wi-Fi tickets with designated turnaround time SLAs.
              </p>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 flex justify-between items-center">
                <span>Resolution Time</span>
                <span className="font-mono font-bold text-teal-400">&lt; 4 Hours Avg</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8 py-3.5 text-sm transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-teal-500/20"
            >
              <span>Onboard Your Property</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. PRICING                                                                */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-20 sm:py-28 bg-[#FAFCFB]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-2">
              Transparent Ownership Plans
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 font-display tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Choose the plan that works for your hostel portfolio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {[
              {
                name: 'Starter',
                price: '₹999',
                period: '/month',
                desc: 'Ideal for standalone boutique hostels getting started with digital management.',
                features: ['1 Hostel', '50 Students', 'Basic Reports'],
                recommended: false,
              },
              {
                name: 'Pro',
                price: '₹4,999',
                period: '/month',
                desc: 'Complete operational automation for high-density hostels and student complexes.',
                features: ['5 Hostels', '500 Students', 'Advanced Analytics', 'Priority Support'],
                recommended: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                period: '',
                desc: 'For multi-city student accommodation chains and institutional university campuses.',
                features: ['Unlimited Hostels', 'Unlimited Users', 'API Access', 'Dedicated Support'],
                recommended: false,
              },
            ].map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 ${
                  plan.recommended
                    ? 'bg-white border-2 border-[#0F766E] shadow-xl shadow-teal-950/8 lg:-translate-y-2'
                    : 'bg-white border border-slate-200/90 shadow-2xs'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0F766E] text-white text-[11px] font-bold tracking-wider uppercase px-4 py-1 rounded-full shadow-xs">
                    RECOMMENDED
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-display mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mb-6 min-h-[32px]">{plan.desc}</p>

                  <div className="mb-6 pb-6 border-b border-slate-100">
                    <span className="text-4xl font-extrabold text-[#0F766E] font-display">{plan.price}</span>
                    {plan.period && <span className="text-xs text-slate-500 ml-1">{plan.period}</span>}
                  </div>

                  <div className="space-y-3 mb-8">
                    {plan.features.map((feature, fidx) => (
                      <div key={fidx} className="flex items-center gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-[#0F766E] shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/signup"
                  className={`w-full py-3.5 rounded-full text-center text-sm font-semibold transition-all duration-150 ${
                    plan.recommended
                      ? 'bg-[#0F766E] text-white shadow-md hover:bg-teal-800'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FINAL CTA ("Your next stay starts here.")                             */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-[#0B5C56] via-[#0F766E] to-[#08423E] text-white relative overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[550px] h-[550px] bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-[550px] h-[550px] bg-teal-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white font-display">
            Your next stay starts here.
          </h2>
          <p className="text-base sm:text-xl text-teal-50 max-w-xl mx-auto leading-relaxed">
            Discover verified student hostels or onboard your property today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/find-hostel"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-[#0F766E] shadow-xl hover:bg-teal-50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Find a Hostel</span>
              <ArrowRight className="h-5 w-5" />
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full border border-teal-300/40 bg-teal-800/40 backdrop-blur-xs px-8 py-4 text-base font-semibold text-white hover:bg-teal-800/70 transition-all duration-200"
            >
              I&apos;m a Hostel Owner
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 11. FOOTER                                                                */}
      {/* ========================================================================= */}
      <PublicFooter />
    </div>
  );
}
