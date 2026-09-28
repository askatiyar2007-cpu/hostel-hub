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
  const selectedCardScale = useTransform(compareProgress, [0, 0.5, 1], [1, 1.05, 1]);
  const otherCardsOpacity = useTransform(compareProgress, [0.5, 1], [1, 0.3]);

  // Lifestyle scroll transforms
  const lifestyleRotation = useTransform(scrollY, [1500, 2200], [0, 360]);

  // Dashboard assembly
  const dashboardProgress = useTransform(scrollY, [2200, 3000], [0, 1], { clamp: true });
  const moduleY = useTransform(dashboardProgress, [0, 1], [50, 0]);
  const moduleOpacity = useTransform(dashboardProgress, [0, 1], [0, 1]);

  // Network connections
  const networkProgress = useTransform(scrollY, [3000, 3800], [0, 1], { clamp: true });
  const leftLineWidth = useTransform(networkProgress, [0, 0.5], [0, 1]);
  const rightLineWidth = useTransform(networkProgress, [0.5, 1], [0, 1]);

  // Additional hero scroll transforms for inline elements
  const gridOpacity = useTransform(scrollY, [0, 300], [0.03, 0.08]);
  const buildingsY = useTransform(scrollY, [0, 400], [50, 0]);
  const buildingsOpacity = useTransform(scrollY, [0, 300], [0, 0.06]);
  const locationPointsOpacity = useTransform(scrollY, [100, 400], [0, 0.4]);
  const otherCardsX = useTransform(compareProgress, [0, 0.5], [0, 30]);

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
      {/* Animated Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F766E] to-[#042F2E] text-white shadow-lg">
                <Building2 className="h-6 w-6" />
                <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[#042f2e] ring-2 ring-white">
                  <Sparkles className="h-2.5 w-2.5 fill-current" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-slate-900 font-display leading-tight">
                  Hostel<span className="text-[#0F766E]">Hub</span>
                </span>
                <span className="text-[10px] font-medium tracking-wider text-[#0F766E]/80 uppercase">
                  Your Stay, Simplified
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/find-hostel" className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200">
                Browse Hostels
              </Link>
              <Link href="/#how-it-works" className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200">
                How it Works
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:block">
                <button className="rounded-full px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Sign in
                </button>
              </Link>
              <Link href="/signup">
                <button className="rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors shadow-lg shadow-teal-900/15">
                  Get started
                </button>
              </Link>
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
                <Menu className="h-6 w-6 text-slate-600" />
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
              className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100">
                <X className="h-6 w-6 text-slate-600" />
              </button>
              <nav className="mt-16 space-y-2">
                <Link href="/find-hostel" className="block py-3 px-4 text-lg font-medium text-slate-700 hover:bg-slate-100 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  Browse Hostels
                </Link>
                <Link href="/#how-it-works" className="block py-3 px-4 text-lg font-medium text-slate-700 hover:bg-slate-100 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                  How it Works
                </Link>
                <div className="pt-4 border-t border-slate-200 mt-4">
                  <Link href="/login" className="block py-3 px-4 text-lg font-medium text-slate-700 hover:bg-slate-100 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/signup" className="block py-3 px-4 text-lg font-medium text-[#0F766E] hover:bg-teal-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
                    Get started
                  </Link>
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CINEMATIC HERO WITH SCROLL TRANSFORMATION */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity, y: heroY, rotate: heroRotate }}
          className="absolute inset-0"
        >
          {/* Cinematic Background with scroll-reactive elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5FBFF] via-[#EFF8FF] to-[#F8FCFD]" />
          
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
                className="inline-flex items-center gap-2 rounded-full border border-teal-300/80 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-xs mb-6"
              >
                <span className="flex h-2 w-2 rounded-full bg-[#0F766E] animate-pulse" />
                <span className="text-xs font-semibold tracking-wider text-teal-950 uppercase">
                  Verified Student Accommodation
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 font-display leading-[1.1] tracking-tight"
              >
                Find a place
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-[#0F766E] block"
                >
                  you'll love to call
                </motion.span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="relative inline-block text-[#0F766E]"
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
                className="text-lg sm:text-xl text-slate-600 font-medium mt-6 max-w-xl mx-auto"
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
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/90 px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-white hover:border-slate-400 transition-all duration-300 shadow-sm"
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
      <section ref={discoveryRef} className="relative py-24 bg-gradient-to-b from-[#F5FBFF] to-[#FAFCFB]">
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
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              02 • DISCOVER
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight">
              Find Your Perfect Stay
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
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
                className="relative h-[350px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl overflow-hidden"
              >
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-15">
                  <svg className="w-full h-full" viewBox="0 0 600 350" fill="none">
                    <defs>
                      <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F766E" strokeWidth="0.5"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#mapGrid)" />
                  </svg>
                </div>

                {/* Central HostelHub Node - pulses on scroll */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-xl"
                >
                  <Building2 className="h-7 w-7 text-white" />
                </motion.div>

                {/* Location Nodes with labels */}
                {[
                  { x: 80, y: 90, label: 'Koramangala', delay: 0.1 },
                  { x: 200, y: 70, label: 'Indiranagar', delay: 0.15 },
                  { x: 320, y: 130, label: 'HSR Layout', delay: 0.2 },
                  { x: 450, y: 80, label: 'BTM', delay: 0.25 },
                  { x: 120, y: 250, label: 'Jayanagar', delay: 0.3 },
                  { x: 280, y: 270, label: 'JP Nagar', delay: 0.35 },
                ].map((node, idx) => (
                  <React.Fragment key={idx}>
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: node.delay }}
                      className="absolute w-3 h-3 rounded-full bg-[#0F766E]"
                      style={{ left: node.x, top: node.y }}
                    />
                    <motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 0.6 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: node.delay + 0.15 }}
                      className="absolute text-[10px] text-slate-600 font-medium"
                      style={{ left: node.x + 14, top: node.y - 3 }}
                    >
                      {node.label}
                    </motion.span>
                  </React.Fragment>
                ))}

                {/* Connection Lines that draw on scroll */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {[
                    { d: "M 80 90 L 300 175", delay: 0.4 },
                    { d: "M 200 70 L 300 175", delay: 0.45 },
                    { d: "M 320 130 L 300 175", delay: 0.5 },
                    { d: "M 450 80 L 300 175", delay: 0.55 },
                  ].map((line, idx) => (
                    <motion.path
                      key={idx}
                      d={line.d}
                      stroke="#0F766E"
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.3"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: line.delay }}
                    />
                  ))}
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
                    className="bg-white rounded-lg p-3 border border-slate-200 text-center"
                  >
                    <p className="text-xl font-bold text-[#0F766E]">{stat.value}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Hostel Listings - Primary + Secondary */}
            <div className="space-y-4">
              {loadingHostels ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
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
                        className="group block rounded-xl bg-white border border-slate-200/80 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-400 overflow-hidden"
                      >
                        <div className="flex">
                          <div className="relative w-40 aspect-square overflow-hidden bg-slate-100">
                            {hostel.cover_image_url ? (
                              <img
                                src={hostel.cover_image_url}
                                alt={hostel.name}
                                className="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <HostelCardVisual name={hostel.name} city={hostel.city} variant={idx} />
                            )}
                            <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2 py-1 rounded-full text-xs font-semibold text-[#0F766E] border border-teal-200/80 flex items-center gap-1 shadow-sm">
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </div>
                          </div>
                          <div className="flex-1 p-4">
                            <h3 className="text-lg font-bold text-slate-900 font-display group-hover:text-[#0F766E] transition-colors mb-1">
                              {hostel.name}
                            </h3>
                            {(hostel.city || hostel.state) && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                <MapPin className="h-3 w-3 text-[#0F766E]" />
                                <span>{[hostel.city, hostel.state].filter(Boolean).join(', ')}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              {hostel.starting_price ? (
                                <span className="text-base font-bold text-[#0F766E]">
                                  ₹{hostel.starting_price.toLocaleString('en-IN')}
                                  <span className="text-xs font-normal text-slate-500">/mo</span>
                                </span>
                              ) : (
                                <span className="text-sm font-semibold text-slate-600">Contact for Pricing</span>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-[#0F766E] transition-colors">
                                View <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}

                  {/* Secondary Listings */}
                  <div className="grid grid-cols-2 gap-3">
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
                          className="group block rounded-lg bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                        >
                          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                            {hostel.cover_image_url ? (
                              <img
                                src={hostel.cover_image_url}
                                alt={hostel.name}
                                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <HostelCardVisual name={hostel.name} city={hostel.city} variant={idx + 1} />
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display group-hover:text-[#0F766E] transition-colors line-clamp-1">
                              {hostel.name}
                            </h3>
                            {hostel.starting_price && (
                              <p className="text-sm font-bold text-[#0F766E] mt-1">
                                ₹{hostel.starting_price.toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <Link
                    href="/find-hostel"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F766E] hover:text-teal-800 transition-colors"
                  >
                    View all hostels <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-[#0F766E] mb-3">
                    <Compass className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 font-display mb-1">
                    No hostels in your area yet
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
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
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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
      <section ref={compareRef} className="relative py-24 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              03 • CHOOSE
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight">
              Choose What Fits Your Life
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
              Compare rooms, amenities, locations, and prices
            </p>
          </motion.div>

          {/* Scroll-driven comparison layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Options that move aside */}
            <motion.div
              style={{ opacity: otherCardsOpacity, x: otherCardsX }}
              className="space-y-3"
            >
              {[
                { icon: Bed, title: 'Private Room', price: '₹8,000', desc: 'Attached bath, AC, WiFi' },
                { icon: Bed, title: 'Shared Room', price: '₹5,500', desc: '2 sharing, attached bath, WiFi' },
                { icon: Home, title: '1RK Studio', price: '₹12,000', desc: 'Kitchen, attached bath, balcony' },
              ].map((option, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="group bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200 hover:border-[#0F766E]/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <option.icon className="h-5 w-5 text-[#0F766E]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900">{option.title}</h3>
                      <p className="text-xs text-slate-600">{option.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#0F766E]">{option.price}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Dominant choice that scales up */}
            <motion.div
              style={{ scale: selectedCardScale }}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Home className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-display">2BHK Flat</h3>
                    <p className="text-teal-200 text-sm">Complete independence</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {['Kitchen', '2 Bathrooms', 'Balcony', 'Parking', '24/7 Security'].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.4 + idx * 0.06 }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="border-t border-white/20 pt-3">
                  <p className="text-2xl font-bold mb-1">₹18,000</p>
                  <p className="text-teal-200 text-sm">per month</p>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-3 -right-3 bg-white rounded-lg p-2 shadow-lg"
              >
                <p className="text-[9px] text-slate-500 font-semibold uppercase">Best Value</p>
                <p className="text-base font-bold text-[#0F766E]">₹18,000</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* LIFESTYLE - ROTATING ORBITAL SYSTEM */}
      <section ref={lifestyleRef} className="relative py-24 bg-gradient-to-br from-[#F2FAF9] to-[#E8F5F2]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              04 • LIVE
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight">
              More Than Just A Room
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
              Experience student living with convenience, security, and community
            </p>
          </motion.div>

          {/* Rotating orbital system */}
          <motion.div
            style={{ rotate: lifestyleRotation }}
            className="relative h-[320px]"
          >
            {/* Central Hub */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-xl z-10">
              <Building2 className="h-10 w-10 text-white" />
            </div>

            {/* Orbiting Benefits */}
            {[
              { icon: MapPin, label: 'Prime Location', angle: 0 },
              { icon: Wifi, label: 'High-Speed WiFi', angle: 60 },
              { icon: Shield, label: '24/7 Security', angle: 120 },
              { icon: Clock, label: 'Flexible Plans', angle: 180 },
              { icon: MessageSquare, label: 'Direct Communication', angle: 240 },
              { icon: Zap, label: 'Quick Requests', angle: 300 },
            ].map((benefit, idx) => {
              const angle = (benefit.angle * Math.PI) / 180;
              const radius = 110;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="bg-white rounded-xl p-3 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow w-32 text-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-lg flex items-center justify-center mx-auto mb-2">
                      <benefit.icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="font-bold text-slate-900 text-xs">{benefit.label}</p>
                  </div>
                </motion.div>
              );
            })}

            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}>
              {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = Math.cos(rad) * 48;
                const y1 = Math.sin(rad) * 48;
                const x2 = Math.cos(rad) * 82;
                const y2 = Math.sin(rad) * 82;

                return (
                  <motion.line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#0F766E"
                    strokeWidth="1.5"
                    opacity="0.2"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 0.2 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.4 + idx * 0.06 }}
                  />
                );
              })}
            </svg>
          </motion.div>
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
      <section ref={billingRef} className="relative py-24 bg-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              06 • PAY
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight">
              Transparent Billing
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
              Itemized bills for rent, electricity, and maintenance with instant digital receipts
            </p>
          </motion.div>

          {/* Animated Bill */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotate: -0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7 }}
            className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Monthly Stay</h3>
                <p className="text-slate-500 text-sm">Monthly Rent</p>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
                <span className="text-sm font-semibold text-[#0F766E]">Verified</span>
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
                  className="flex justify-between items-center py-2 border-b border-slate-200"
                >
                  <span className="text-sm text-slate-600 font-medium">{item.label}</span>
                  <AnimatedCounter value={item.value} prefix="₹" />
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="flex justify-between items-center py-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg px-4"
              >
                <span className="font-bold text-base text-slate-900">Total</span>
                <AnimatedCounter value={9140} prefix="₹" className="text-xl font-bold text-[#0F766E]" />
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

      {/* STUDENT ↔ HOSTELHUB ↔ OWNER NETWORK - DRAWING CONNECTIONS */}
      <section ref={networkRef} className="relative py-24 bg-gradient-to-br from-[#071922] to-[#0A302D] text-white overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-3">
              07 • CONNECT
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">
              One Platform. Everyone Connected.
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mt-4">
              HostelHub connects students, parents, and hostel owners in one seamless ecosystem
            </p>
          </motion.div>

          {/* Network Visualization with drawing connections */}
          <div className="relative">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Student Side */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="space-y-2"
              >
                <h3 className="text-xl font-bold font-display mb-4 text-center">STUDENT</h3>
                {[
                  { icon: Search, label: 'Find Stay' },
                  { icon: Home, label: 'Room Requests' },
                  { icon: Receipt, label: 'Bills' },
                  { icon: CreditCard, label: 'Payments' },
                  { icon: FileText, label: 'Complaints' },
                  { icon: Bell, label: 'Notices' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                    className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-7 h-7 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <item.icon className="h-3.5 w-3.5 text-teal-400" />
                    </div>
                    <span className="text-slate-200 text-xs font-medium">{item.label}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Center - HostelHub */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-xl">
                  <Building2 className="h-12 w-12 text-white" />
                </div>
                <p className="text-center mt-3 font-bold text-lg text-teal-400">HOSTELHUB</p>
              </motion.div>

              {/* Owner Side */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="space-y-2"
              >
                <h3 className="text-xl font-bold font-display mb-4 text-center">HOSTEL OWNER</h3>
                {[
                  { icon: Bed, label: 'Manage Rooms' },
                  { icon: Users, label: 'Students' },
                  { icon: Receipt, label: 'Bills' },
                  { icon: CreditCard, label: 'Payments' },
                  { icon: FileText, label: 'Requests' },
                  { icon: Bell, label: 'Complaints' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.06 + 0.3 }}
                    className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-7 h-7 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <item.icon className="h-3.5 w-3.5 text-teal-400" />
                    </div>
                    <span className="text-slate-200 text-xs font-medium">{item.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Animated Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <motion.path
                d="M 100 200 L 600 200"
                stroke="#0F766E"
                strokeWidth="2"
                fill="none"
                opacity="0.4"
                initial={{ pathLength: 0 }}
                style={{ pathLength: leftLineWidth }}
              />
              <motion.path
                d="M 600 200 L 1100 200"
                stroke="#0F766E"
                strokeWidth="2"
                fill="none"
                opacity="0.4"
                initial={{ pathLength: 0 }}
                style={{ pathLength: rightLineWidth }}
              />
            </svg>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS - EDITORIAL TIMELINE */}
      <section ref={howItWorksRef} className="relative py-24 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] block mb-3">
              08 • PROCESS
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 font-display tracking-tight">
              How HostelHub Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
              Get started in 4 simple steps
            </p>
          </motion.div>

          {/* Editorial Timeline */}
          <div className="relative max-w-3xl mx-auto">
            {/* Horizontal Line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-200 via-[#0F766E] to-slate-200 transform -translate-y-1/2" />

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
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto -mt-4 shadow-lg border-4 border-slate-100"
                  >
                    <item.icon className="h-5 w-5 text-[#0F766E]" />
                  </motion.div>
                  <h3 className="font-bold text-base text-slate-900 mt-3 mb-1">{item.title}</h3>
                  <p className="text-slate-600 text-xs">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST - MINIMAL */}
      <section className="relative py-16 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 font-display tracking-tight mb-8">
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
                  <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <trust.icon className="h-6 w-6 text-[#0F766E]" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">{trust.title}</h3>
                  <p className="text-slate-600 text-sm">{trust.desc}</p>
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
