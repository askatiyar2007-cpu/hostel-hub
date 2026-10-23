'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { supabase } from '@/lib/supabase/client';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  Building2,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Compass,
  Menu,
  X,
  CheckCircle2,
  Search,
  Bed,
  CreditCard,
  Receipt,
  Home,
  Wifi,
  Shield,
  Clock,
  Users,
  Zap,
  FileText,
  Bell,
  Check,
  MessageSquare,
} from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAuthPayload, setMobileAuthPayload] = useState<string | null>(null);

  // Mobile App OAuth Bridge: If Supabase redirects here after a mobile OAuth sign-in,
  // immediately bounce back to the HostelHub mobile app via deep link.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasTokens = hash.includes('access_token=') || search.includes('code=') || hash.includes('code=');
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobileParam = search.includes('source=mobile') || hash.includes('source=mobile');

    if (hasTokens && (isMobileDevice || isMobileParam)) {
      const payload = hash || search;
      setMobileAuthPayload(payload);
      const appUrl = `hostelhubmobile://auth/callback${payload}`;
      try {
        window.location.replace(appUrl);
      } catch {
        window.location.href = appUrl;
      }
    }
  }, []);

  // Scroll-driven animations
  const { scrollY } = useScroll();
  const heroRef = useRef(null);
  const discoveryRef = useRef(null);
  const compareRef = useRef(null);
  const lifestyleRef = useRef(null);
  const manageRef = useRef(null);
  const billingRef = useRef(null);
  const networkRef = useRef(null);
  const howItWorksRef = useRef(null);

  // Hero scroll transforms
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.85]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, -80]);
  const heroRotate = useTransform(scrollY, [0, 500], [0, -2]);

  // Discovery scroll transforms
  const discoveryY = useTransform(scrollY, [300, 700], [100, 0]);
  const discoveryScale = useTransform(scrollY, [300, 600], [0.9, 1]);
  const discoveryOpacity = useTransform(scrollY, [300, 500], [0, 1]);

  // Comparison scroll transforms
  const compareProgress = useTransform(scrollY, [800, 1500], [0, 1], { clamp: true });
  const selectedCardScale = useTransform(compareProgress, [0, 0.5, 1], [1, 1.03, 1]);

  // Lifestyle scroll transforms
  const lifestyleRotation = useTransform(scrollY, [1500, 2200], [0, 360]);
  const lifestyleCounterRotation = useTransform(lifestyleRotation, (r) => -r);

  // Dashboard assembly
  const dashboardProgress = useTransform(scrollY, [2200, 3000], [0, 1], { clamp: true });
  const moduleY = useTransform(dashboardProgress, [0, 1], [50, 0]);
  const moduleOpacity = useTransform(dashboardProgress, [0, 1], [0, 1]);

  // Additional hero scroll transforms for inline elements
  const gridOpacity = useTransform(scrollY, [0, 300], [0.03, 0.08]);
  const buildingsY = useTransform(scrollY, [0, 400], [50, 0]);
  const buildingsOpacity = useTransform(scrollY, [0, 300], [0, 0.06]);
  const locationPointsOpacity = useTransform(scrollY, [100, 400], [0, 0.4]);

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

  if (mobileAuthPayload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07131D] px-6 py-12 text-center text-white">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-500/20 text-teal-400 shadow-xl shadow-teal-500/10">
          <Sparkles className="h-10 w-10 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Connecting to HostelHub Mobile</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-400">
          Google authentication successful! Returning to your mobile app...
        </p>
        <a
          href={`hostelhubmobile://auth/callback${mobileAuthPayload}`}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-transform active:scale-95 hover:bg-teal-500"
        >
          Open HostelHub App
        </a>
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#FAFCFB] dark:bg-[#07131d] text-slate-900 dark:text-slate-100 selection:bg-teal-100 dark:selection:bg-teal-900 selection:text-teal-900 dark:selection:text-teal-100 overflow-x-hidden">
      {/* Animated Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#07131d]/90 backdrop-blur-md border-b border-slate-200/60 dark:border-[#1a3d52]/60"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F766E] to-[#042F2E] text-white shadow-lg">
                <Building2 className="h-6 w-6" />
                <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[#042f2e] ring-2 ring-white dark:ring-[#07131d]">
                  <Sparkles className="h-2.5 w-2.5 fill-current" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display leading-tight">
                  Hostel<span className="text-[#0F766E] dark:text-teal-400">Hub</span>
                </span>
                <span className="text-[10px] font-medium tracking-wider text-[#0F766E]/80 dark:text-teal-300/80 uppercase">
                  Your Stay, Simplified
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/find-hostel" className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#122b3b] hover:text-slate-900 dark:hover:text-white transition-all duration-200">
                Browse Hostels
              </Link>
              <Link href="/#how-it-works" className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#122b3b] hover:text-slate-900 dark:hover:text-white transition-all duration-200">
                How it Works
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:block">
                <button className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#122b3b] hover:text-slate-900 dark:hover:text-white transition-colors">
                  Sign in
                </button>
              </Link>
              <Link href="/signup">
                <button className="rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shadow-lg shadow-teal-900/15">
                  Get started
                </button>
              </Link>
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#122b3b]">
                <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-72 bg-white dark:bg-[#0e222e] border-l border-slate-200 dark:border-[#1a3d52] shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#122b3b]">
                <X className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </button>
              <nav className="mt-16 space-y-2">
                <Link href="/find-hostel" className="block py-3 px-4 text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#122b3b] rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Browse Hostels
                </Link>
                <Link href="/#how-it-works" className="block py-3 px-4 text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#122b3b] rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  How it Works
                </Link>
                <div className="pt-4 border-t border-slate-200 dark:border-[#1a3d52] mt-4">
                  <Link href="/login" className="block py-3 px-4 text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#122b3b] rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/signup" className="block py-3 px-4 text-lg font-medium text-[#0F766E] dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                    Get started
                  </Link>
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CINEMATIC HERO WITH SCROLL TRANSFORMATION */}
      <section ref={heroRef} className="relative min-h-[90vh] sm:h-screen overflow-hidden">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity, y: heroY, rotate: heroRotate }}
          className="absolute inset-0"
        >
          {/* Cinematic Background with scroll-reactive elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5FBFF] via-[#EFF8FF] to-[#F8FCFD] dark:from-[#07131d] dark:via-[#0c202d] dark:to-[#07131d]" />
          
          {/* Architectural grid - becomes more visible on scroll */}
          <motion.div
            style={{ opacity: gridOpacity }}
            className="absolute inset-0"
          >
            <svg className="w-full h-full" viewBox="0 0 1920 1080" fill="none">
              <defs>
                <pattern id="heroGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#0F766E" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#heroGrid)" />
            </svg>
          </motion.div>

          {/* Building silhouettes - rise on scroll */}
          <motion.div
            style={{ y: buildingsY, opacity: buildingsOpacity }}
            className="absolute bottom-0 left-0 right-0 h-48"
          >
            <svg className="w-full h-full" viewBox="0 0 1920 192" fill="none">
              <rect x="100" y="80" width="60" height="112" fill="#0F766E" />
              <rect x="180" y="50" width="90" height="142" fill="#0F766E" />
              <rect x="290" y="70" width="70" height="122" fill="#0F766E" />
              <rect x="380" y="40" width="100" height="152" fill="#0F766E" />
              <rect x="500" y="60" width="80" height="132" fill="#0F766E" />
              <rect x="600" y="45" width="90" height="147" fill="#0F766E" />
              <rect x="710" y="70" width="65" height="122" fill="#0F766E" />
              <rect x="800" y="50" width="85" height="142" fill="#0F766E" />
              <rect x="910" y="65" width="75" height="127" fill="#0F766E" />
              <rect x="1000" y="55" width="95" height="137" fill="#0F766E" />
              <rect x="1110" y="70" width="70" height="122" fill="#0F766E" />
              <rect x="1200" y="45" width="100" height="147" fill="#0F766E" />
              <rect x="1320" y="60" width="80" height="132" fill="#0F766E" />
              <rect x="1420" y="50" width="90" height="142" fill="#0F766E" />
              <rect x="1530" y="70" width="65" height="122" fill="#0F766E" />
              <rect x="1610" y="55" width="85" height="137" fill="#0F766E" />
              <rect x="1710" y="75" width="60" height="117" fill="#0F766E" />
            </svg>
          </motion.div>

          {/* Location points - appear and connect on scroll */}
          <motion.div
            style={{ opacity: locationPointsOpacity }}
            className="absolute inset-0"
          >
            {[10, 25, 40, 55, 70, 85, 30, 50, 65].map((top, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="absolute w-2 h-2 rounded-full bg-[#0F766E]"
                style={{ left: `${5 + idx * 11}%`, top: `${top}%` }}
              />
            ))}
          </motion.div>

          {/* Controlled Typography */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-4xl px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="inline-flex items-center gap-2 rounded-full border border-teal-300/80 dark:border-teal-700/80 bg-white/90 dark:bg-[#0e222e]/90 px-4 py-1.5 shadow-sm backdrop-blur-xs mb-6"
              >
                <span className="flex h-2 w-2 rounded-full bg-[#0F766E] animate-pulse" />
                <span className="text-xs font-semibold tracking-wider text-teal-950 dark:text-teal-200 uppercase">
                  Verified Student Accommodation
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 dark:text-white font-display leading-[1.1] tracking-tight"
              >
                Find a place
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-[#0F766E] dark:text-teal-400 block"
                >
                  you'll love to call
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="relative inline-block text-[#0F766E] dark:text-teal-400"
                >
                  home.
                  <motion.svg
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                    className="absolute -bottom-2 left-0 w-full text-teal-400/50 -z-10 h-2"
                    viewBox="0 0 100 12"
                    preserveAspectRatio="none"
                    fill="currentColor"
                  >
                    <path d="M0,8 Q50,0 100,8 L100,12 Q50,4 0,12 Z" />
                  </motion.svg>
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-medium mt-6 max-w-xl mx-auto"
              >
                Discover hostels, compare rooms, and manage your stay — all in one place.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center mt-8"
              >
                <Link
                  href="/find-hostel"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#0F766E] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-900/15 hover:bg-teal-800 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Find a Hostel</span>
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </motion.span>
                </Link>

                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-[#0e222e]/90 px-8 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#122b3b] hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-300 shadow-sm"
                >
                  I'm a Hostel Owner
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-2 text-slate-400"
            >
              <span className="text-xs font-bold tracking-widest uppercase">Scroll to explore</span>
              <ArrowRight className="h-5 w-5 rotate-90" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* DISCOVERY - TRANSFORMS FROM HERO */}
      <section ref={discoveryRef} className="relative py-24 bg-gradient-to-b from-[#F5FBFF] to-[#FAFCFB] dark:from-[#07131d] dark:to-[#091823]">
        <motion.div
          style={{ y: discoveryY, scale: discoveryScale, opacity: discoveryOpacity }}
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-3">
              02 • DISCOVER
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
              Find Your Perfect Stay
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-4">
              Explore verified accommodation options near your college
            </p>
          </motion.div>

          {/* Map System with scroll-driven nodes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8 }}
                className="relative h-[350px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#0d212e] dark:to-[#081722] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-[#1a3d52]/80 shadow-inner"
              >
                <svg className="w-full h-full" viewBox="0 0 600 350" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F766E" strokeWidth="0.5"/>
                    </pattern>
                  </defs>

                  {/* Grid background */}
                  <rect width="100%" height="100%" fill="url(#mapGrid)" opacity="0.15" />

                  {/* Concentric radar rings centered at (300, 175) */}
                  <circle cx="300" cy="175" r="55" fill="none" stroke="#0F766E" strokeWidth="1" strokeDasharray="4 4" opacity="0.25" />
                  <circle cx="300" cy="175" r="115" fill="none" stroke="#0F766E" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
                  <circle cx="300" cy="175" r="175" fill="none" stroke="#0F766E" strokeWidth="1" strokeDasharray="4 4" opacity="0.08" />

                  {/* Connection Lines from all 6 nodes to central hub (300, 175) */}
                  {[
                    { x: 95, y: 80, delay: 0.2 },
                    { x: 220, y: 60, delay: 0.25 },
                    { x: 500, y: 85, delay: 0.3 },
                    { x: 485, y: 265, delay: 0.35 },
                    { x: 105, y: 265, delay: 0.4 },
                    { x: 275, y: 305, delay: 0.45 },
                  ].map((line, idx) => (
                    <motion.path
                      key={`map-line-${idx}`}
                      d={`M ${line.x} ${line.y} L 300 175`}
                      stroke="#0F766E"
                      strokeWidth="1.75"
                      strokeDasharray="4 4"
                      fill="none"
                      opacity="0.4"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: line.delay }}
                    />
                  ))}

                  {/* 6 Location Nodes with interactive beacon pins */}
                  {[
                    { x: 95, y: 80, label: 'Koramangala', labelX: 110, labelY: 84, delay: 0.1 },
                    { x: 220, y: 60, label: 'Indiranagar', labelX: 235, labelY: 64, delay: 0.15 },
                    { x: 500, y: 85, label: 'HSR Layout', labelX: 410, labelY: 89, delay: 0.2 },
                    { x: 485, y: 265, label: 'BTM Layout', labelX: 395, labelY: 269, delay: 0.25 },
                    { x: 105, y: 265, label: 'Jayanagar', labelX: 120, labelY: 269, delay: 0.3 },
                    { x: 275, y: 305, label: 'JP Nagar', labelX: 290, labelY: 309, delay: 0.35 },
                  ].map((node, idx) => (
                    <g key={`map-node-${idx}`}>
                      <circle cx={node.x} cy={node.y} r="8" fill="#0F766E" opacity="0.15" />
                      <circle cx={node.x} cy={node.y} r="4.5" fill="#0F766E" />
                      <circle cx={node.x} cy={node.y} r="2" fill="#FFFFFF" />
                      <rect
                        x={node.labelX - 4}
                        y={node.labelY - 11}
                        width={node.label.length * 7 + 16}
                        height="18"
                        rx="9"
                        fill="#FFFFFF"
                        stroke="#CBD5E1"
                        strokeWidth="0.8"
                        opacity="0.95"
                      />
                      <text
                        x={node.labelX + 4}
                        y={node.labelY + 2}
                        fill="#1E293B"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="sans-serif"
                      >
                        {node.label}
                      </text>
                    </g>
                  ))}

                  {/* Central Hub in SVG */}
                  <g>
                    <circle cx="300" cy="175" r="32" fill="#0F766E" opacity="0.15" />
                    <foreignObject x="272" y="147" width="56" height="56">
                      <div className="w-14 h-14 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-xl ring-4 ring-teal-500/25">
                        <Building2 className="h-7 w-7 text-white" />
                      </div>
                    </foreignObject>
                  </g>
                </svg>
              </motion.div>

              {/* Map Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'Verified Hostels', value: '50+' },
                  { label: 'Locations', value: '12' },
                  { label: 'Near Colleges', value: '8' },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.6 + idx * 0.08 }}
                    className="bg-white dark:bg-[#0e222e] rounded-lg p-3 border border-slate-200 dark:border-[#1a3d52] text-center shadow-xs"
                  >
                    <p className="text-xl font-bold text-[#0F766E] dark:text-teal-400">{stat.value}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Hostel Listings - Primary + Secondary */}
            <div className="space-y-4">
              {loadingHostels ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-[#0e222e] animate-pulse" />
                  ))}
                </div>
              ) : hostels.length > 0 ? (
                <>
                  {/* Primary Listing */}
                  {hostels.slice(0, 1).map((hostel, idx) => (
                    <motion.div
                      key={hostel.id}
                      initial={{ opacity: 0, x: 30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      <Link
                        href={`/hostels/${hostel.id}`}
                        className="group block rounded-2xl bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52]/90 shadow-md hover:shadow-xl hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row">
                          <div className="relative w-full sm:w-52 md:w-56 shrink-0 aspect-[16/10] sm:aspect-auto overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {hostel.cover_image_url ? (
                              <img
                                src={hostel.cover_image_url}
                                alt={hostel.name}
                                className="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <HostelCardVisual name={hostel.name} city={hostel.city} variant={idx} />
                            )}
                            <div className="absolute top-2.5 left-2.5 bg-white/95 dark:bg-[#0e222e]/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-[#0F766E] dark:text-teal-300 border border-teal-200/80 dark:border-teal-700/80 flex items-center gap-1 shadow-xs">
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </div>
                          </div>
                          <div className="flex-1 p-5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400">
                                  Featured Accommodation
                                </span>
                              </div>
                              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-display group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors line-clamp-1">
                                {hostel.name}
                              </h3>
                              {(hostel.city || hostel.state) && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  <MapPin className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400 shrink-0" />
                                  <span>{[hostel.city, hostel.state].filter(Boolean).join(', ')}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 flex-wrap mt-3">
                                <span className="text-[10px] font-medium bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 px-2 py-0.5 rounded-md border border-teal-100/60 dark:border-teal-800/60">WiFi Included</span>
                                <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">Attached Bath</span>
                                <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">24/7 Security</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-[#1a3d52]">
                              <div>
                                {hostel.starting_price ? (
                                  <span className="text-lg font-bold text-[#0F766E] dark:text-teal-400">
                                    ₹{hostel.starting_price.toLocaleString('en-IN')}
                                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">/mo</span>
                                  </span>
                                ) : (
                                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Contact for Pricing</span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0F766E] px-3.5 py-1.5 rounded-lg group-hover:bg-teal-800 transition-colors shadow-xs">
                                View Details <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}

                  {/* Secondary Listings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hostels.slice(1, 3).map((hostel, idx) => (
                      <motion.div
                        key={hostel.id}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: 0.3 + idx * 0.08 }}
                      >
                        <Link
                          href={`/hostels/${hostel.id}`}
                          className="group flex flex-col h-full rounded-xl bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52]/90 shadow-sm hover:shadow-md hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                        >
                          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {hostel.cover_image_url ? (
                              <img
                                src={hostel.cover_image_url}
                                alt={hostel.name}
                                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <HostelCardVisual name={hostel.name} city={hostel.city} variant={idx + 1} />
                            )}
                            <div className="absolute top-2 left-2 bg-white/90 dark:bg-[#0e222e]/90 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#0F766E] dark:text-teal-300 border border-teal-200/60 dark:border-teal-700/60 flex items-center gap-1 shadow-xs">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              Verified
                            </div>
                          </div>
                          <div className="p-3.5 flex flex-col justify-between flex-1">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors line-clamp-1">
                                {hostel.name}
                              </h3>
                              {(hostel.city || hostel.state) && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                  <MapPin className="h-3 w-3 text-[#0F766E] dark:text-teal-400 shrink-0" />
                                  <span>{[hostel.city, hostel.state].filter(Boolean).join(', ')}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-[#1a3d52]">
                              <p className="text-sm font-bold text-[#0F766E] dark:text-teal-400">
                                {hostel.starting_price ? (
                                  <>
                                    ₹{hostel.starting_price.toLocaleString('en-IN')}
                                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-0.5">/mo</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-600 dark:text-slate-300">Explore</span>
                                )}
                              </p>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors inline-flex items-center gap-0.5">
                                View <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <Link
                    href="/find-hostel"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F766E] dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors pt-1"
                  >
                    View all hostels <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-xl border-2 border-dashed border-slate-200 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] p-6 text-center"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 mb-3">
                    <Compass className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display mb-1">
                    No hostels in your area yet
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                    Hostels are being verified daily. Search by location or list your property.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Link
                      href="/find-hostel"
                      className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition-colors"
                    >
                      Search
                    </Link>
                    <Link
                      href="/signup"
                      className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#122b3b] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1a3d52] transition-colors"
                    >
                      List Hostel
                    </Link>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* COMPARISON - SCROLL-DRIVEN CARD MOVEMENT */}
      <section ref={compareRef} className="relative py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-3">
              03 • CHOOSE
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
              Choose What Fits Your Life
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-4">
              Compare rooms, amenities, locations, and prices
            </p>
          </motion.div>

          {/* Comparison layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Options on the left */}
            <div className="space-y-4">
              {[
                { icon: Bed, title: 'Private Room', price: '₹8,000', period: '/month', desc: 'Attached bath, dedicated AC, high-speed WiFi' },
                { icon: Bed, title: 'Shared Room', price: '₹5,500', period: '/month', desc: '2 sharing, attached bath, study desk, WiFi' },
                { icon: Home, title: '1RK Studio', price: '₹12,000', period: '/month', desc: 'Private kitchenette, attached bath, balcony' },
              ].map((option, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="group bg-white dark:bg-[#0e222e] rounded-xl p-4 sm:p-5 border border-slate-200/90 dark:border-[#1a3d52]/90 hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center text-[#0F766E] dark:text-teal-300 border border-teal-100/60 dark:border-teal-800/60 shadow-xs group-hover:scale-105 transition-transform shrink-0">
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors">
                        {option.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{option.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-[#0F766E] dark:text-teal-400">{option.price}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{option.period}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Dominant choice on the right */}
            <motion.div
              style={{ scale: selectedCardScale }}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-[#0F766E] via-[#0D655E] to-[#042F2E] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-teal-600/30 overflow-hidden">
                {/* Glow accent */}
                <div className="absolute -top-20 -right-20 w-56 h-56 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

                {/* Best Value badge cleanly placed inside top right */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300 shadow-xs mb-4">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Best Value Choice
                </div>

                <div className="flex items-center gap-3.5 mb-5">
                  <div className="w-12 h-12 bg-white/15 backdrop-blur-xs rounded-xl flex items-center justify-center border border-white/20 shadow-xs">
                    <Home className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-display text-white">2BHK Flat</h3>
                    <p className="text-teal-200 text-sm">Complete independence &amp; premium comfort</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                  {['Modular Kitchen', '2 Private Bathrooms', 'Scenic Balcony', 'Dedicated Parking', '24/7 Security & CCTV', 'Power Backup'].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.3 + idx * 0.05 }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-xs sm:text-sm text-teal-50">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="border-t border-white/15 pt-4 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-bold font-display text-white">₹18,000</span>
                    <span className="text-teal-200 text-sm ml-1.5">/month total</span>
                  </div>
                  <span className="text-xs text-teal-300 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 font-medium">
                    All-inclusive utilities
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* LIFESTYLE - ROTATING ORBITAL SYSTEM */}
      <section ref={lifestyleRef} className="relative py-28 bg-gradient-to-br from-[#F2FAF9] via-[#EAF6F3] to-[#E2F2EE] dark:from-[#07131d] dark:via-[#0c2328] dark:to-[#07131d] overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-3">
              04 • LIVE
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
              More Than Just A Room
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-4">
              Experience student living with convenience, security, and community
            </p>
          </motion.div>

          {/* Mobile view: Clean, contained grid without collision/overflow */}
          <div className="md:hidden space-y-6 max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-teal-500/15 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="w-16 h-16 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-teal-500/30">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: MapPin, label: 'Prime Location', sub: 'Near Top Colleges' },
                { icon: Wifi, label: 'High-Speed WiFi', sub: 'Unlimited 5G Fiber' },
                { icon: Shield, label: '24/7 Security', sub: 'CCTV & Biometrics' },
                { icon: Clock, label: 'Flexible Plans', sub: 'Monthly or Semester' },
                { icon: MessageSquare, label: 'Direct Chat', sub: 'Instant Owner Support' },
                { icon: Zap, label: 'Quick Requests', sub: 'Fast Maintenance' },
              ].map((benefit, idx) => (
                <div
                  key={idx}
                  className="bg-white/95 dark:bg-[#0e222e]/95 backdrop-blur-md rounded-2xl p-3.5 shadow-sm border border-slate-200/90 dark:border-[#1a3d52]/90 text-center hover:border-[#0F766E]/50 dark:hover:border-teal-500/50 transition-colors"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                    <benefit.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                    {benefit.label}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {benefit.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop & Tablet Rotating orbital system with upright counter-rotated cards */}
          <div className="relative hidden md:flex h-[480px] sm:h-[540px] items-center justify-center">
            {/* Background dashed orbit tracks */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
              <circle
                cx="300"
                cy="300"
                r="185"
                fill="none"
                stroke="#0F766E"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.25"
              />
              <circle
                cx="300"
                cy="300"
                r="215"
                fill="none"
                stroke="#0F766E"
                strokeWidth="1"
                strokeDasharray="4 8"
                opacity="0.12"
              />
            </svg>

            {/* Central Hub (Fixed upright with pulsing aura) */}
            <div className="relative z-20 flex items-center justify-center pointer-events-none">
              <div className="absolute w-32 h-32 rounded-full bg-teal-500/10 animate-ping" style={{ animationDuration: '4s' }} />
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-2xl ring-4 ring-teal-500/30">
                <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
              </div>
            </div>

            {/* Orbiting Layer that rotates smoothly with scroll */}
            <motion.div
              style={{ rotate: lifestyleRotation }}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {[
                { icon: MapPin, label: 'Prime Location', sub: 'Near Top Colleges', angle: 0 },
                { icon: Wifi, label: 'High-Speed WiFi', sub: 'Unlimited 5G Fiber', angle: 60 },
                { icon: Shield, label: '24/7 Security', sub: 'CCTV & Biometrics', angle: 120 },
                { icon: Clock, label: 'Flexible Plans', sub: 'Monthly or Semester', angle: 180 },
                { icon: MessageSquare, label: 'Direct Chat', sub: 'Instant Owner Support', angle: 240 },
                { icon: Zap, label: 'Quick Requests', sub: 'Fast Maintenance', angle: 300 },
              ].map((benefit, idx) => {
                const angle = (benefit.angle * Math.PI) / 180;
                const radius = 185;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* The card counter-rotates so it stays ALWAYS UPRIGHT! */}
                    <motion.div
                      style={{ rotate: lifestyleCounterRotation }}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.1 + idx * 0.08 }}
                      className="pointer-events-auto"
                    >
                      <div className="bg-white/95 dark:bg-[#0e222e]/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-lg border border-slate-200/90 dark:border-[#1a3d52]/90 hover:border-[#0F766E]/50 dark:hover:border-teal-500/50 hover:shadow-xl transition-all duration-300 w-36 sm:w-40 text-center group cursor-default">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm group-hover:scale-110 transition-transform">
                          <benefit.icon className="h-5 w-5 text-white" />
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors leading-tight">
                          {benefit.label}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {benefit.sub}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* DASHBOARD ASSEMBLY - MODULES COME TOGETHER */}
      <section ref={manageRef} className="relative py-24 bg-[#071922] text-white overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-3">
              05 • MANAGE
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">
              Manage Everything In One Place
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mt-4">
              From rent to complaints, track everything from your personal student dashboard
            </p>
          </motion.div>

          {/* Dashboard Frame with assembling modules */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 backdrop-blur-sm"
          >
            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center gap-3 mb-4 border-b border-slate-700/50 pb-3"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">HostelHub Dashboard</h3>
                <p className="text-slate-400 text-xs">Welcome back</p>
              </div>
            </motion.div>

            {/* Modules Grid - Assemble from separate positions */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: Home, title: 'My Stay', desc: 'Room details', delay: 0.35 },
                { icon: Receipt, title: 'Rent & Bills', desc: 'Monthly charges', delay: 0.4 },
                { icon: CreditCard, title: 'Payments', desc: 'Transaction history', delay: 0.45 },
                { icon: FileText, title: 'Complaints', desc: 'Raise & track', delay: 0.5 },
                { icon: Bell, title: 'Notices', desc: 'Announcements', delay: 0.55 },
                { icon: Users, title: 'Requests', desc: 'Change requests', delay: 0.65 },
              ].map((module, idx) => (
                <motion.div
                  key={idx}
                  style={{ y: moduleY, opacity: moduleOpacity }}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.4, delay: module.delay }}
                  className="bg-slate-700/50 rounded-xl p-3 border border-slate-600/50 hover:bg-slate-600/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <module.icon className="h-4 w-4 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{module.title}</h3>
                      <p className="text-slate-400 text-xs">{module.desc}</p>
                    </div>
                  </div>
                  <div className="h-0.5 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* BILLING - CINEMATIC UI SEQUENCE */}
      <section ref={billingRef} className="relative py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-3">
              06 • PAY
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
              Transparent Billing
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-4">
              Itemized bills for rent, electricity, and maintenance with instant digital receipts
            </p>
          </motion.div>

          {/* Animated Bill */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotate: -0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7 }}
            className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0e222e] dark:to-[#122b3b] rounded-2xl p-6 border border-slate-200 dark:border-[#1a3d52] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Monthly Stay</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Monthly Rent</p>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-teal-400" />
                <span className="text-sm font-semibold text-[#0F766E] dark:text-teal-400">Verified</span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Rent', value: 8500, delay: 0.1 },
                { label: 'Electricity', value: 640, delay: 0.15 },
                { label: 'Maintenance', value: 300, delay: 0.2 },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: item.delay }}
                  className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-[#1a3d52]"
                >
                  <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                  <AnimatedCounter value={item.value} prefix="₹" className="dark:text-slate-200 font-semibold" />
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="flex justify-between items-center py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-lg px-4 border border-teal-100/50 dark:border-teal-800/40"
              >
                <span className="font-bold text-base text-slate-900 dark:text-white">Total</span>
                <AnimatedCounter value={9140} prefix="₹" className="text-xl font-bold text-[#0F766E] dark:text-teal-400" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="mt-4 text-center"
            >
              <button className="w-full rounded-full bg-[#0F766E] py-2.5 text-white font-bold text-sm hover:bg-teal-800 transition-colors shadow-lg">
                Pay Bill
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* STUDENT ↔ HOSTELHUB ↔ OWNER NETWORK - REAL OPERATING ECOSYSTEM */}
      <section ref={networkRef} className="relative py-28 bg-gradient-to-br from-[#061720] via-[#082229] to-[#052E2B] text-white overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] h-[350px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-3">
              07 • CONNECT
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">
              One Platform. Everyone Connected.
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mt-4">
              HostelHub bridges student residents and hostel owners in one unified, real-time operating ecosystem
            </p>
          </motion.div>

          {/* Network Visualization with Real Operational Features */}
          <div className="relative">
            {/* Desktop Curved Connector Lines between each pair and the central hub */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block"
              viewBox="0 0 1000 450"
              preserveAspectRatio="none"
            >
              {[35, 110, 185, 265, 340, 415].map((y, idx) => (
                <React.Fragment key={`network-line-${idx}`}>
                  {/* Left curve: Student card edge (x=335) into central hub (x=465, y=225) */}
                  <motion.path
                    d={`M 335 ${y} C 410 ${y}, 430 225, 465 225`}
                    stroke="#0F766E"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                    fill="none"
                    opacity="0.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.08 }}
                  />
                  {/* Right curve: Central hub (x=535, y=225) out to Owner card edge (x=665) */}
                  <motion.path
                    d={`M 535 225 C 570 225, 590 ${y}, 665 ${y}`}
                    stroke="#0F766E"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                    fill="none"
                    opacity="0.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + idx * 0.08 }}
                  />
                </React.Fragment>
              ))}
            </svg>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6 items-center">
              {/* Student Residents Side */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="space-y-2.5"
              >
                <div className="text-center lg:text-left mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs font-bold uppercase tracking-wider text-teal-400">
                    <Users className="h-3.5 w-3.5" /> Student Resident
                  </span>
                </div>

                {[
                  { icon: Home, title: 'Room Requests', desc: 'Select room, bed & check-in' },
                  { icon: CreditCard, title: 'Rent & Bills', desc: 'Online fee payment & receipts' },
                  { icon: Zap, title: 'Electricity Meter', desc: 'Unit tracking & consumption' },
                  { icon: FileText, title: 'Complaints', desc: 'Maintenance tickets & updates' },
                  { icon: Bell, title: 'Notices & Mess', desc: 'Curfew, rules & hostel notices' },
                  { icon: Users, title: 'My Stay & Roommates', desc: 'Room details & co-residents' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                    className="flex items-center gap-3 bg-slate-800/70 backdrop-blur-sm rounded-xl p-3 border border-slate-700/60 hover:border-teal-500/50 hover:bg-slate-800 transition-all duration-200 group shadow-sm"
                  >
                    <div className="w-8 h-8 bg-teal-500/20 border border-teal-500/30 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <item.icon className="h-4 w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white text-xs sm:text-sm font-bold group-hover:text-teal-300 transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-[11px] truncate">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Center - HostelHub Sync Core */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative flex flex-col items-center justify-center py-6 my-auto"
              >
                {/* Pulsing beacon halos */}
                <div className="absolute w-36 h-36 rounded-full bg-teal-500/10 animate-ping pointer-events-none" style={{ animationDuration: '4s' }} />
                <div className="absolute w-44 h-44 rounded-full bg-teal-500/5 border border-teal-500/20 pointer-events-none" />

                {/* Central Emblem */}
                <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-2xl ring-4 ring-teal-500/30">
                  <Building2 className="h-11 w-11 text-white" />
                </div>

                <div className="text-center mt-4 z-10">
                  <p className="font-bold text-base tracking-widest text-teal-400 font-display">
                    HOSTELHUB CORE
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">Real-Time Sync Engine</p>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Instant Synchronization
                  </div>
                </div>
              </motion.div>

              {/* Hostel Owner Side */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="space-y-2.5"
              >
                <div className="text-center lg:text-right mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs font-bold uppercase tracking-wider text-teal-400">
                    <Building2 className="h-3.5 w-3.5" /> Hostel Owner &amp; Admin
                  </span>
                </div>

                {[
                  { icon: Bed, title: 'Room & Bed Allocation', desc: 'Inventory & student assignment' },
                  { icon: Receipt, title: 'Billing & Collection', desc: 'Automated rent & payment ledger' },
                  { icon: Zap, title: 'Electricity Metering', desc: 'Per-room billing & calculations' },
                  { icon: ShieldCheck, title: 'Complaint Resolution', desc: 'Maintenance dispatch & resolution' },
                  { icon: Bell, title: 'Notice Broadcasts', desc: 'Instant announcements to residents' },
                  { icon: Users, title: 'Resident Directory', desc: 'Tenant records, KYC & checkouts' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 + 0.2 }}
                    className="flex items-center gap-3 bg-slate-800/70 backdrop-blur-sm rounded-xl p-3 border border-slate-700/60 hover:border-teal-500/50 hover:bg-slate-800 transition-all duration-200 group shadow-sm"
                  >
                    <div className="w-8 h-8 bg-teal-500/20 border border-teal-500/30 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <item.icon className="h-4 w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white text-xs sm:text-sm font-bold group-hover:text-teal-300 transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-[11px] truncate">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS - EDITORIAL TIMELINE */}
      <section ref={howItWorksRef} className="relative py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-3">
              08 • PROCESS
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
              How HostelHub Works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-4">
              Get started in 4 simple steps
            </p>
          </motion.div>

          {/* Editorial Timeline */}
          <div className="relative max-w-3xl mx-auto">
            {/* Horizontal Line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-200 via-[#0F766E] to-slate-200 dark:from-[#1a3d52] dark:via-[#0F766E] dark:to-[#1a3d52] transform -translate-y-1/2" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {[
                { step: '01', title: 'DISCOVER', desc: 'Find a hostel that fits you', icon: Search },
                { step: '02', title: 'COMPARE', desc: 'Explore rooms and amenities', icon: Bed },
                { step: '03', title: 'CHOOSE', desc: 'Select your perfect stay', icon: Check },
                { step: '04', title: 'MANAGE', desc: 'Track your digital experience', icon: Home },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="text-center relative"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 + 0.2 }}
                    className="w-12 h-12 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-3 shadow-lg"
                  >
                    {item.step}
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0.8 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 + 0.3 }}
                    className="w-10 h-10 bg-white dark:bg-[#0e222e] rounded-full flex items-center justify-center mx-auto -mt-4 shadow-lg border-4 border-slate-100 dark:border-[#122b3b]"
                  >
                    <item.icon className="h-5 w-5 text-[#0F766E] dark:text-teal-400" />
                  </motion.div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mt-3 mb-1">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST - MINIMAL */}
      <section className="relative py-16 bg-slate-50 dark:bg-[#091823]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-display tracking-tight mb-8">
              Why Students Choose HostelHub
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: ShieldCheck, title: 'Verified Properties', desc: 'Every hostel is physically audited before listing' },
                { icon: CheckCircle2, title: 'Zero Brokerage', desc: 'Direct connection with hostel owners, no middlemen' },
                { icon: Sparkles, title: 'Digital Management', desc: 'Everything from bills to complaints in one place' },
              ].map((trust, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center mx-auto mb-3 text-[#0F766E] dark:text-teal-300">
                    <trust.icon className="h-6 w-6 text-[#0F766E] dark:text-teal-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{trust.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{trust.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA - CONVERGENCE */}
      <section className="relative py-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] text-white overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Building2 className="h-10 w-10 text-white" />
            </motion.div>
            <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight mb-3">
              Your Stay. Your Place.
              <span className="text-teal-300 block">HostelHub.</span>
            </h2>
            <p className="text-lg text-teal-100 max-w-2xl mx-auto mb-6">
              Whether you're finding your next stay or managing a hostel, HostelHub brings everything together in one simple platform.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/find-hostel"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#0F766E] px-6 py-3 text-base font-bold hover:bg-teal-50 transition-all duration-300 hover:-translate-y-0.5 shadow-xl"
            >
              <span>Explore Hostels</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full border-2 border-white/30 bg-transparent px-6 py-3 text-base font-bold hover:bg-white/10 transition-all duration-300"
            >
              Get Started
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <PublicFooter />
    </div>
  );
}

// Animated number counter component
function AnimatedCounter({ value, prefix, className }: { value: number; prefix: string; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      const duration = 1200;
      const startTime = performance.now();

      const animateNumber = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * eased));

        if (progress < 1) {
          requestAnimationFrame(animateNumber);
        }
      };

      requestAnimationFrame(animateNumber);
    }
  }, [isInView, value]);

  return <span ref={ref} className={className}>{prefix}{displayValue}</span>;
}
