'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { motion, useScroll, useTransform, useInView, useReducedMotion } from 'framer-motion';
import {
  Building2,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Sparkles,
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

import PublicFooter from '@/components/public/PublicFooter';

export default function PublicHomePage() {
  const { profile, loading, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();
  const [mobileAuthPayload, setMobileAuthPayload] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  // Responsive device check for adapting 3D transforms & horizontal slides
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Hero scroll transforms (safely disabled/relaxed on reduced motion or narrow mobile)
  const heroScale = useTransform(scrollY, [0, 500], [1, shouldReduceMotion ? 1 : 0.88]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, shouldReduceMotion ? 0 : -60]);
  const heroRotate = useTransform(scrollY, [0, 500], [0, shouldReduceMotion || isMobile ? 0 : -2]);

  // Discovery scroll transforms
  const discoveryY = useTransform(scrollY, [300, 700], [shouldReduceMotion ? 0 : 60, 0]);
  const discoveryScale = useTransform(scrollY, [300, 600], [shouldReduceMotion ? 1 : 0.94, 1]);
  const discoveryOpacity = useTransform(scrollY, [300, 500], [0, 1]);

  // Comparison scroll transforms
  const compareProgress = useTransform(scrollY, [800, 1500], [0, 1], { clamp: true });
  const selectedCardScale = useTransform(compareProgress, [0, 0.5, 1], [1, shouldReduceMotion ? 1 : 1.02, 1]);

  // Lifestyle scroll transforms (orbit rotation only active on desktop when motion allowed)
  const lifestyleRotation = useTransform(scrollY, [1500, 2200], [0, shouldReduceMotion ? 0 : 360]);
  const lifestyleCounterRotation = useTransform(lifestyleRotation, (r) => -r);

  // Dashboard assembly
  const dashboardProgress = useTransform(scrollY, [2200, 3000], [0, 1], { clamp: true });
  const moduleY = useTransform(dashboardProgress, [0, 1], [shouldReduceMotion ? 0 : 35, 0]);
  const moduleOpacity = useTransform(dashboardProgress, [0, 1], [0, 1]);

  // Additional hero scroll transforms for subtle architectural background elements
  const gridOpacity = useTransform(scrollY, [0, 300], [0.03, 0.08]);
  const buildingsY = useTransform(scrollY, [0, 400], [30, 0]);
  const buildingsOpacity = useTransform(scrollY, [0, 300], [0, 0.06]);
  const locationPointsOpacity = useTransform(scrollY, [100, 400], [0, 0.35]);

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

  if (mobileAuthPayload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07131D] px-6 py-12 text-center text-white">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-500/20 text-teal-400 shadow-xl shadow-teal-500/10">
          <Sparkles className="h-10 w-10 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Connecting to StayKosh Mobile</h1>
        <p className="mt-3 max-w-sm text-sm text-slate-400">
          Google authentication successful! Returning to your mobile app...
        </p>
        <a
          href={`hostelhubmobile://auth/callback${mobileAuthPayload}`}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-transform active:scale-95 hover:bg-teal-500"
        >
          Open StayKosh App
        </a>
      </div>
    );
  }

  if (loading || profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFCFB] dark:bg-[#07131d]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#0F766E] border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider text-[#0F766E] dark:text-teal-400 uppercase">Loading StayKosh...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFCFB] dark:bg-[#07131d] text-slate-900 dark:text-slate-100 selection:bg-teal-100 dark:selection:bg-teal-900 selection:text-teal-900 dark:selection:text-teal-100 overflow-x-hidden">

      {/* 1. CINEMATIC HERO SECTION */}
      <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-screen flex items-center justify-center overflow-hidden pt-4 sm:pt-0">
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity, y: heroY, rotate: heroRotate }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* Cinematic Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5FBFF] via-[#EFF8FF] to-[#F8FCFD] dark:from-[#07131d] dark:via-[#0c202d] dark:to-[#07131d]" />

          {/* Architectural grid */}
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

          {/* Location points */}
          <motion.div
            style={{ opacity: locationPointsOpacity }}
            className="absolute inset-0"
          >
            {[10, 25, 40, 55, 70, 85, 30, 50, 65].map((top, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.04 }}
                className="absolute w-2 h-2 rounded-full bg-[#0F766E]"
                style={{ left: `${5 + idx * 11}%`, top: `${top}%` }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Hero Content Container */}
        <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-20 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-teal-300/80 dark:border-teal-700/80 bg-white/95 dark:bg-[#0e222e]/95 px-3 sm:px-4 py-1 sm:py-1.5 shadow-xs backdrop-blur-xs mb-4 sm:mb-6 max-w-full"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#0F766E] animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-normal sm:tracking-wider text-teal-950 dark:text-teal-200 uppercase truncate">
              Verified Student Accommodation Platform
            </span>
          </motion.div>

          {/* Heading with Restored Split-Phrase Reveal */}
          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-slate-900 dark:text-white font-sans font-bold leading-[1.12] sm:leading-[1.1] tracking-tight break-words"
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="block"
            >
              Find a place
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="text-[#0F766E] dark:text-teal-400 block mt-1"
            >
              you'll love to call
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="relative inline-block text-[#0F766E] dark:text-teal-400"
            >
              home.
              <motion.svg
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.75, ease: 'easeOut' }}
                className="absolute -bottom-1.5 sm:-bottom-2 left-0 w-full text-teal-400/50 -z-10 h-2 origin-left"
                viewBox="0 0 100 12"
                preserveAspectRatio="none"
                fill="currentColor"
              >
                <path d="M0,8 Q50,0 100,8 L100,12 Q50,4 0,12 Z" />
              </motion.svg>
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 font-medium mt-4 sm:mt-6 max-w-xl mx-auto px-2 leading-relaxed"
          >
            Discover verified student accommodations, compare rooms, and manage your entire stay — all in one modern platform.
          </motion.p>

          {/* CTA Buttons with Restored Arrow Nudge Loop */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-6 sm:mt-8 w-full max-w-xs sm:max-w-none mx-auto"
          >
            <Link
              href="/find-hostel"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0F766E] px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-teal-900/15 hover:bg-teal-800 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Browse Hostels</span>
              <motion.span
                animate={shouldReduceMotion ? {} : { x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                className="inline-flex items-center"
              >
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
              </motion.span>
            </Link>

            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-[#0e222e]/90 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#122b3b] hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-300 shadow-sm"
            >
              I'm a Hostel Owner
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator (visible on tablet and desktop) */}
        <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 pointer-events-none hidden sm:block">
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-1.5 text-slate-400"
          >
            <span className="text-[10px] font-bold tracking-widest uppercase">Scroll to explore</span>
            <ArrowRight className="h-4 w-4 rotate-90 text-teal-600 dark:text-teal-400" />
          </motion.div>
        </div>
      </section>

      {/* 2. DISCOVERY - PLATFORM SEARCH & CAMPUS ACCOMMODATION PORTAL */}
      <section id="discover" ref={discoveryRef} className="relative py-12 md:py-24 bg-gradient-to-b from-[#F5FBFF] to-[#FAFCFB] dark:from-[#07131d] dark:to-[#091823]">
        <motion.div
          style={{ y: discoveryY, scale: discoveryScale, opacity: discoveryOpacity }}
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-2 sm:mb-3">
              02 • DISCOVER
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              Find Your Perfect Stay
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              Explore verified student accommodations near top colleges and education hubs
            </p>
          </motion.div>

          {/* Discovery Grid: Left Map + Right Platform Search Portal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Interactive Campus Hub Network Map with Restored Entrance */}
            <motion.div
              initial={{ opacity: 0, y: isMobile ? 20 : 0, x: isMobile ? 0 : -30 }}
              whileInView={{ opacity: 1, y: 0, x: 0 }}
              viewport={{ once: true, amount: 0.08, margin: "-20px" }}
              transition={{ duration: 0.7 }}
              className="relative"
            >
              <div className="relative h-[250px] sm:h-[320px] lg:h-[350px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#0d212e] dark:to-[#081722] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-[#1a3d52]/80 shadow-inner">
                <svg className="w-full h-full" viewBox="0 0 600 350" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F766E" strokeWidth="0.5"/>
                    </pattern>
                  </defs>

                  {/* Grid background */}
                  <rect width="100%" height="100%" fill="url(#mapGrid)" opacity="0.15" />

                  {/* Concentric radar rings with continuous subtle pulse & ripple */}
                  <motion.circle
                    cx="300"
                    cy="175"
                    r="55"
                    fill="none"
                    stroke="#0F766E"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    animate={{ r: [50, 65, 50], opacity: [0.2, 0.45, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.circle
                    cx="300"
                    cy="175"
                    r="115"
                    fill="none"
                    stroke="#0F766E"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    animate={{ r: [110, 125, 110], opacity: [0.12, 0.3, 0.12] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  />
                  <motion.circle
                    cx="300"
                    cy="175"
                    r="175"
                    fill="none"
                    stroke="#0F766E"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    animate={{ r: [170, 185, 170], opacity: [0.06, 0.2, 0.06] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                  />
                  {/* Subtle Radar Pulse Wave */}
                  <motion.circle
                    cx="300"
                    cy="175"
                    fill="none"
                    stroke="#0F766E"
                    strokeWidth="1.5"
                    animate={{ r: [35, 185], opacity: [0.45, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut' }}
                  />

                  {/* Connection Lines from nodes to central hub */}
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
                      viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                      transition={{ duration: 0.8, delay: line.delay }}
                    />
                  ))}

                  {/* 6 Location Nodes with interactive beacon pins */}
                  {[
                    { x: 95, y: 80, label: 'Koramangala', labelX: 110, labelY: 84, delay: 0 },
                    { x: 220, y: 60, label: 'Indiranagar', labelX: 235, labelY: 64, delay: 0.4 },
                    { x: 500, y: 85, label: 'HSR Layout', labelX: 405, labelY: 89, delay: 0.8 },
                    { x: 485, y: 265, label: 'BTM Layout', labelX: 390, labelY: 269, delay: 1.2 },
                    { x: 105, y: 265, label: 'Jayanagar', labelX: 120, labelY: 269, delay: 1.6 },
                    { x: 275, y: 305, label: 'JP Nagar', labelX: 290, labelY: 309, delay: 2.0 },
                  ].map((node, idx) => (
                    <motion.g
                      key={`map-node-${idx}`}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: node.delay }}
                    >
                      <circle cx={node.x} cy={node.y} r="8" fill="#0F766E" opacity="0.2" />
                      <circle cx={node.x} cy={node.y} r="4.5" fill="#0F766E" />
                      <circle cx={node.x} cy={node.y} r="2" fill="#FFFFFF" />
                      <rect
                        x={node.labelX - 4}
                        y={node.labelY - 11}
                        width={node.label.length * 7.2 + 18}
                        height="20"
                        rx="10"
                        fill="#FFFFFF"
                        stroke="#CBD5E1"
                        strokeWidth="0.8"
                        opacity="0.95"
                      />
                      <text
                        x={node.labelX + 5}
                        y={node.labelY + 3}
                        fill="#0F172A"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {node.label}
                      </text>
                    </motion.g>
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
              </div>

              {/* Map Stats - Restored Staggered Entrance */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
                {[
                  { label: 'Verified Stays', value: '50+' },
                  { label: 'College Hubs', value: '12' },
                  { label: 'Direct Connect', value: '100%' },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.4, delay: 0.15 + idx * 0.1 }}
                    className="bg-white dark:bg-[#0e222e] rounded-xl p-2 sm:p-3 border border-slate-200/90 dark:border-[#1a3d52]/90 text-center shadow-xs min-w-0 flex flex-col justify-center"
                  >
                    <p className="text-base sm:text-xl font-bold text-[#0F766E] dark:text-teal-400 truncate">
                      {stat.value}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight truncate">
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: StayKosh Platform Living Formats with Restored Staggered Reveal */}
            <div className="space-y-3.5 sm:space-y-4">
              {/* Category 1: Student Hostels & PGs */}
              <motion.div
                initial={{ opacity: 0, y: isMobile ? 15 : 0, x: isMobile ? 0 : 25 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="rounded-2xl bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52]/90 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 transition-all duration-300"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#0F766E] dark:text-teal-300 border border-teal-100/60 dark:border-teal-800/60 shrink-0">
                    <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-sans font-bold truncate">
                        Student Hostels &amp; PGs
                      </h3>
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                        Audited
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Full-service residential accommodation with regular meals, housekeeping, high-speed Wi-Fi, and 24/7 security.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <span className="text-[10px] font-medium bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 px-2 py-0.5 rounded-md border border-teal-100/60 dark:border-teal-800/60">
                        Meals Included
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        Biometrics &amp; CCTV
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        Zero Brokerage
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Category 2: Shared Rooms & Co-Living Spaces */}
              <motion.div
                initial={{ opacity: 0, y: isMobile ? 15 : 0, x: isMobile ? 0 : 25 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.5, delay: 0.22 }}
                className="rounded-2xl bg-white dark:bg-[#0e222e] border border-slate-200/90 dark:border-[#1a3d52]/90 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 transition-all duration-300"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#0F766E] dark:text-teal-300 border border-teal-100/60 dark:border-teal-800/60 shrink-0">
                    <Bed className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-sans font-bold truncate">
                        Shared Rooms &amp; Co-Living
                      </h3>
                      <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200/60 dark:border-teal-800/60 shrink-0">
                        Popular
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      2-sharing and 3-sharing rooms with dedicated study desks, individual wardrobes, attached baths, and power backup.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <span className="text-[10px] font-medium bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-300 px-2 py-0.5 rounded-md border border-teal-100/60 dark:border-teal-800/60">
                        Study Desk
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        Attached Bath
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 dark:bg-[#122b3b] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        High-Speed Wi-Fi
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Browse Hostels Call-To-Action Banner */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.5, delay: 0.34 }}
                className="rounded-2xl bg-gradient-to-br from-[#0F766E] via-[#0D655E] to-[#042F2E] p-5 sm:p-6 text-white shadow-lg"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold text-teal-200 mb-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
                      100% Direct Owner Connection
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold font-sans font-bold text-white">
                      Explore All Accommodations
                    </h3>
                    <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-md">
                      Browse verified properties, compare room types, and check availability across all student clusters.
                    </p>
                  </div>
                  <Link
                    href="/find-hostel"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0F766E] px-5 py-3 text-sm font-bold shadow-md hover:bg-teal-50 transition-all duration-200 shrink-0"
                  >
                    <span>Browse All Hostels</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. COMPARISON - CHOOSE WHAT FITS YOUR LIFE */}
      <section id="pricing" ref={compareRef} className="relative py-12 md:py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-2 sm:mb-3">
              03 • CHOOSE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              Choose What Fits Your Life
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              Compare room formats, amenities, and transparent pricing
            </p>
          </motion.div>

          {/* Comparison layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
            {/* Options on the left with Restored Staggered Entrance */}
            <div className="space-y-3.5 sm:space-y-4">
              {[
                { icon: Bed, title: 'Private Room', price: '₹8,000', period: '/month', desc: 'Attached bath, dedicated AC, high-speed WiFi' },
                { icon: Bed, title: 'Shared Room', price: '₹5,500', period: '/month', desc: '2 sharing, attached bath, study desk, WiFi' },
                { icon: Home, title: '1RK Studio', price: '₹12,000', period: '/month', desc: 'Private kitchenette, attached bath, balcony' },
              ].map((option, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: isMobile ? 15 : 0, x: isMobile ? 0 : -20 }}
                  whileInView={{ opacity: 1, y: 0, x: 0 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="group bg-white dark:bg-[#0e222e] rounded-xl p-3.5 sm:p-5 border border-slate-200/90 dark:border-[#1a3d52]/90 hover:border-[#0F766E]/40 dark:hover:border-teal-500/40 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center text-[#0F766E] dark:text-teal-300 border border-teal-100/60 dark:border-teal-800/60 shadow-xs shrink-0">
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-[#0F766E] dark:group-hover:text-teal-300 transition-colors truncate">
                        {option.title}
                      </h3>
                      <p className="line-clamp-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{option.desc}</p>
                    </div>
                    <div className="text-right shrink-0 pl-1">
                      <p className="text-base sm:text-lg font-bold text-[#0F766E] dark:text-teal-400">{option.price}</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">{option.period}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Dominant choice on the right - Restored Entrance Pop + Scroll Scale */}
            <motion.div
              style={{ scale: selectedCardScale }}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.08, margin: "-20px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-[#0F766E] via-[#0D655E] to-[#042F2E] rounded-2xl p-5 sm:p-7 md:p-8 text-white shadow-xl border border-teal-600/30 overflow-hidden">
                {/* Glow accent */}
                <div className="absolute -top-20 -right-20 w-56 h-56 bg-teal-400/10 rounded-full blur-2xl pointer-events-none transform-gpu" />

                {/* Best Value badge */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300 shadow-xs mb-3.5 sm:mb-4">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  <span>Best Value Choice</span>
                </div>

                <div className="flex items-center gap-3.5 mb-4 sm:mb-5">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 backdrop-blur-xs rounded-xl flex items-center justify-center border border-white/20 shadow-xs shrink-0">
                    <Home className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold font-sans font-bold text-white truncate">2BHK Flat</h3>
                    <p className="line-clamp-2 text-xs sm:text-sm text-teal-200 mt-0.5 leading-snug">Complete independence &amp; premium comfort</p>
                  </div>
                </div>

                {/* Restored Staggered Feature Reveal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 mb-5 sm:mb-6">
                  {['Modular Kitchen', '2 Private Bathrooms', 'Scenic Balcony', 'Dedicated Parking', '24/7 Security & CCTV', 'Power Backup'].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: isMobile ? 0 : -10, y: isMobile ? 8 : 0 }}
                      whileInView={{ opacity: 1, x: 0, y: 0 }}
                      viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                      transition={{ duration: 0.3, delay: 0.25 + idx * 0.05 }}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
                      <span className="text-xs sm:text-sm text-teal-50 truncate">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Bottom Price & Utility row - Fully contained with flex-col on small viewports */}
                <div className="border-t border-white/15 pt-4 flex flex-col xs:flex-row xs:items-baseline justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold font-sans font-bold text-white">₹18,000</span>
                    <span className="text-teal-200 text-xs sm:text-sm">/month total</span>
                  </div>
                  <span className="inline-flex self-start xs:self-auto text-[11px] sm:text-xs text-teal-300 bg-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/10 font-medium">
                    All-inclusive utilities
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. LIFESTYLE - ORBITAL LIVING EXPERIENCE */}
      <section id="lifestyle" ref={lifestyleRef} className="relative py-12 md:py-24 bg-gradient-to-br from-[#F2FAF9] via-[#EAF6F3] to-[#E2F2EE] dark:from-[#07131d] dark:via-[#0c2328] dark:to-[#07131d] overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-2 sm:mb-3">
              04 • LIVE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              More Than Just A Room
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              Experience student living with convenience, security, and community
            </p>
          </motion.div>

          {/* Mobile view: Clean, contained grid with central pulse emblem & Restored Stagger */}
          <div className="md:hidden space-y-6 max-w-sm mx-auto">
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-teal-500/15 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="w-16 h-16 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-teal-500/30">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { icon: MapPin, label: 'Prime Location', sub: 'Near Top Colleges' },
                { icon: Wifi, label: 'High-Speed WiFi', sub: 'Unlimited 5G Fiber' },
                { icon: Shield, label: '24/7 Security', sub: 'CCTV & Biometrics' },
                { icon: Clock, label: 'Flexible Plans', sub: 'Monthly or Semester' },
                { icon: MessageSquare, label: 'Direct Chat', sub: 'Instant Owner Support' },
                { icon: Zap, label: 'Quick Requests', sub: 'Fast Maintenance' },
              ].map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.4, delay: idx * 0.06 }}
                  className="bg-white/95 dark:bg-[#0e222e]/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 shadow-xs border border-slate-200/90 dark:border-[#1a3d52]/90 text-center min-w-0"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                    <benefit.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-xs leading-tight truncate">
                    {benefit.label}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {benefit.sub}
                  </p>
                </motion.div>
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

            {/* Central Hub */}
            <div className="relative z-20 flex items-center justify-center pointer-events-none">
              <div className="absolute w-32 h-32 rounded-full bg-teal-500/10 animate-ping" style={{ animationDuration: '4s' }} />
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-2xl ring-4 ring-teal-500/30">
                <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
              </div>
            </div>

            {/* Orbiting Layer with Restored Entrance Pop */}
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
                    <motion.div
                      style={{ rotate: lifestyleCounterRotation }}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                      transition={{ duration: 0.5, delay: 0.1 + idx * 0.08 }}
                      className="pointer-events-auto"
                    >
                      <div className="bg-white/95 dark:bg-[#0e222e]/95 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 shadow-lg border border-slate-200/90 dark:border-[#1a3d52]/90 hover:border-[#0F766E]/50 dark:hover:border-teal-500/50 hover:shadow-xl transition-all duration-300 w-36 sm:w-40 text-center group cursor-default transform-gpu">
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

      {/* 5. DASHBOARD ASSEMBLY - MANAGE EVERYTHING IN ONE PLACE */}
      <section id="features" ref={manageRef} className="relative py-12 md:py-24 bg-[#071922] text-white overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-2 sm:mb-3">
              05 • MANAGE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans font-bold tracking-tight">
              Manage Everything In One Place
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              From rent to complaints, track everything from your personal student dashboard
            </p>
          </motion.div>

          {/* Dashboard Frame with Restored Perspective Tilt & Entrance Pop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: isMobile ? 0 : -2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="bg-slate-800/50 rounded-2xl p-3.5 sm:p-5 border border-slate-700/50 backdrop-blur-sm"
          >
            {/* Restored Header Slide-Down */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.08, margin: "-20px" }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4 border-b border-slate-700/50 pb-3"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-xs sm:text-sm truncate">StayKosh Dashboard</h3>
                <p className="text-slate-400 text-[11px] sm:text-xs truncate">Welcome back</p>
              </div>
            </motion.div>

            {/* Modules Grid - Restored Scroll Convergence Assembly & Staggered Reveal */}
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { icon: Home, title: 'My Stay', desc: 'Room details', delay: 0.1 },
                { icon: Receipt, title: 'Rent & Bills', desc: 'Monthly charges', delay: 0.15 },
                { icon: CreditCard, title: 'Payments', desc: 'Transaction history', delay: 0.2 },
                { icon: FileText, title: 'Complaints', desc: 'Raise & track', delay: 0.25 },
                { icon: Bell, title: 'Notices', desc: 'Announcements', delay: 0.3 },
                { icon: Users, title: 'Requests', desc: 'Change requests', delay: 0.35 },
              ].map((module, idx) => (
                <motion.div
                  key={idx}
                  style={{ y: moduleY, opacity: moduleOpacity }}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.4, delay: module.delay }}
                  className="bg-slate-700/50 rounded-xl p-2.5 sm:p-3 border border-slate-600/50 hover:bg-slate-600/50 transition-colors group min-w-0"
                >
                  <div className="flex items-center gap-2.5 mb-2 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                      <module.icon className="h-4 w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white text-xs sm:text-sm truncate">{module.title}</h4>
                      <p className="text-slate-400 text-[10px] sm:text-xs truncate">{module.desc}</p>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-slate-600/30 rounded-full overflow-hidden mt-1"><div className="h-full bg-teal-400/60 w-0 group-hover:w-full transition-all duration-500 rounded-full" /></div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. TRANSPARENT BILLING - PRESERVED BILLING SECTION WITH RESTORED ANIMATION */}
      <section id="billing" ref={billingRef} className="relative py-12 md:py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-12"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-2 sm:mb-3">
              06 • PAY
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              Transparent Billing
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              Itemized bills for rent, electricity, and maintenance with instant digital receipts
            </p>
          </motion.div>

          {/* Animated Bill Card with Restored Editorial Paper Receipt Tilt */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotate: isMobile ? 0 : -0.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0e222e] dark:to-[#122b3b] rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-[#1a3d52] shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Monthly Stay</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">Monthly Rent</p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ShieldCheck className="h-4 w-4 text-[#0F766E] dark:text-teal-400 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#0F766E] dark:text-teal-400">Verified</span>
              </div>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {[
                { label: 'Rent', value: 8500, delay: 0.15 },
                { label: 'Electricity', value: 640, delay: 0.22 },
                { label: 'Maintenance', value: 300, delay: 0.29 },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: isMobile ? 0 : -15, y: isMobile ? 10 : 0 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.4, delay: item.delay }}
                  className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-[#1a3d52] text-sm"
                >
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{item.label}</span>
                  <AnimatedCounter value={item.value} prefix="₹" className="dark:text-slate-200 font-semibold" />
                </motion.div>
              ))}

              {/* Restored Total Bar Slide-Up */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.5, delay: 0.36 }}
                className="flex justify-between items-center py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-lg px-3.5 sm:px-4 border border-teal-100/50 dark:border-teal-800/40"
              >
                <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Total</span>
                <AnimatedCounter value={9140} prefix="₹" className="text-lg sm:text-xl font-bold text-[#0F766E] dark:text-teal-400" />
              </motion.div>
            </div>

            {/* Restored Pay Bill Button Scale Pop */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.08, margin: "-20px" }}
              transition={{ duration: 0.4, delay: 0.42 }}
              className="mt-4 text-center"
            >
              <button className="w-full rounded-full bg-[#0F766E] py-2.5 sm:py-3 text-white font-bold text-sm hover:bg-teal-800 transition-colors shadow-md">
                Pay Bill
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 7. CONNECT - REAL OPERATING ECOSYSTEM */}
      <section id="ecosystem" ref={networkRef} className="relative py-12 md:py-24 bg-gradient-to-br from-[#061720] via-[#082229] to-[#052E2B] text-white overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] h-[350px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none transform-gpu" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-16"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-2 sm:mb-3">
              07 • CONNECT
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans font-bold tracking-tight">
              One Platform. Everyone Connected.
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              StayKosh bridges student residents and hostel owners in one unified, real-time operating ecosystem
            </p>
          </motion.div>

          {/* Desktop Curved Connector Lines between each pair and the central hub */}
          <div className="relative">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block"
              viewBox="0 0 1000 450"
              preserveAspectRatio="none"
            >
              {[35, 110, 185, 265, 340, 415].map((y, idx) => (
                <React.Fragment key={`network-line-${idx}`}>
                  {/* Left curve: Student card edge into central hub */}
                  <motion.path
                    d={`M 335 ${y} C 410 ${y}, 430 225, 465 225`}
                    stroke="#0F766E"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                    fill="none"
                    opacity="0.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.8, delay: 0.15 + idx * 0.05 }}
                  />
                  {/* Right curve: Central hub out to Owner card edge */}
                  <motion.path
                    d={`M 535 225 C 570 225, 590 ${y}, 665 ${y}`}
                    stroke="#0F766E"
                    strokeWidth="1.75"
                    strokeDasharray="4 4"
                    fill="none"
                    opacity="0.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.05 }}
                  />
                </React.Fragment>
              ))}
            </svg>

            {/* Mobile StayKosh Core Hub Hero with Restored Emblem Pop */}
            <div className="lg:hidden flex flex-col items-center justify-center py-6 mb-8 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="relative flex items-center justify-center"
              >
                <div className="absolute w-28 h-28 rounded-full bg-teal-500/10 animate-ping pointer-events-none" style={{ animationDuration: '3.5s' }} />
                <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-xl ring-4 ring-teal-500/30">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
              </motion.div>
              <p className="font-bold text-sm tracking-widest text-teal-400 font-sans font-bold mt-3">
                STAYKOSH CORE
              </p>
              <p className="text-xs text-slate-300 mt-0.5">Real-Time Sync Engine</p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Instant Synchronization
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6 items-center">
              {/* Student Residents Side with Restored Slide-In & Feature Stagger */}
              <motion.div
                initial={{ opacity: 0, y: isMobile ? 20 : 0, x: isMobile ? 0 : -25 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.6 }}
                className="space-y-2.5"
              >
                <div className="text-center lg:text-left mb-3 sm:mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs font-bold uppercase tracking-wider text-teal-400">
                    <Users className="h-3.5 w-3.5" /> Student Residents
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
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.4, delay: 0.15 + idx * 0.07 }}
                    className="flex items-center gap-2.5 sm:gap-3 bg-slate-800/70 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-slate-700/60 hover:border-teal-500/50 hover:bg-slate-800 transition-all duration-200 group shadow-sm min-w-0"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-teal-500/20 border border-teal-500/30 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white text-xs sm:text-sm font-bold group-hover:text-teal-300 transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-[10px] sm:text-[11px] truncate">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Desktop Center - StayKosh Sync Core with Restored Emblem Pop */}
              <div className="hidden lg:flex flex-col items-center justify-center py-6 my-auto relative">
                {/* Pulsing beacon halos */}
                <div className="absolute w-36 h-36 rounded-full bg-teal-500/10 animate-ping pointer-events-none" style={{ animationDuration: '4s' }} />
                <div className="absolute w-44 h-44 rounded-full bg-teal-500/5 border border-teal-500/20 pointer-events-none" />

                {/* Central Emblem with Restored Entrance Pop */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="relative z-10 w-24 h-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center shadow-2xl ring-4 ring-teal-500/30"
                >
                  <Building2 className="h-11 w-11 text-white" />
                </motion.div>

                <div className="text-center mt-4 z-10">
                  <p className="font-bold text-base tracking-widest text-teal-400 font-sans font-bold">
                    STAYKOSH CORE
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">Real-Time Sync Engine</p>
                  <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Instant Synchronization
                  </div>
                </div>
              </div>

              {/* Hostel Owner Side with Restored Slide-In & Feature Stagger */}
              <motion.div
                initial={{ opacity: 0, y: isMobile ? 20 : 0, x: isMobile ? 0 : 25 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-2.5"
              >
                <div className="text-center lg:text-right mb-3 sm:mb-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-xs font-bold uppercase tracking-wider text-teal-400">
                    <Building2 className="h-3.5 w-3.5" /> Hostel Owners &amp; Admins
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
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.4, delay: 0.2 + idx * 0.07 }}
                    className="flex items-center gap-2.5 sm:gap-3 bg-slate-800/70 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-slate-700/60 hover:border-teal-500/50 hover:bg-slate-800 transition-all duration-200 group shadow-sm min-w-0"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-teal-500/20 border border-teal-500/30 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white text-xs sm:text-sm font-bold group-hover:text-teal-300 transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-[10px] sm:text-[11px] truncate">
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

      {/* 8. HOW IT WORKS - EDITORIAL PROCESS WITH RESTORED STEP POP */}
      <section id="how-it-works" ref={howItWorksRef} className="relative py-12 md:py-24 bg-white dark:bg-[#07131d]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 sm:mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E] dark:text-teal-400 block mb-2 sm:mb-3">
              08 • PROCESS
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              How StayKosh Works
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-3 sm:mt-4 px-2">
              Get started in 4 simple steps
            </p>
          </motion.div>

          {/* Editorial Timeline - Responsive for Desktop & Mobile with Restored Step Animations */}
          <div className="relative max-w-3xl mx-auto">
            {/* Desktop Horizontal Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-200 via-[#0F766E] to-slate-200 dark:from-[#1a3d52] dark:via-[#0F766E] dark:to-[#1a3d52] transform -translate-y-1/2 pointer-events-none" />

            {/* Mobile Vertical Connecting Line */}
            <div className="md:hidden absolute top-6 bottom-6 left-6 w-0.5 bg-gradient-to-b from-[#0F766E] via-teal-400 to-[#0F766E] -translate-x-1/2 pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 relative">
              {[
                { step: '01', title: 'DISCOVER', desc: 'Find accommodation near your campus', icon: Search },
                { step: '02', title: 'COMPARE', desc: 'Explore rooms, amenities & pricing', icon: Bed },
                { step: '03', title: 'CHOOSE', desc: 'Select your stay with zero brokerage', icon: Check },
                { step: '04', title: 'MANAGE', desc: 'Track rent, electricity & complaints', icon: Home },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                  transition={{ duration: 0.6, delay: idx * 0.12 }}
                  className="relative flex md:flex-col items-center md:items-center gap-3.5 sm:gap-4 md:gap-0 text-left md:text-center"
                >
                  {/* Step Number Circle with Restored Scale Pop */}
                  <motion.div
                    initial={{ scale: 0.8 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                    transition={{ duration: 0.4, delay: 0.1 + idx * 0.1 }}
                    className="w-12 h-12 bg-gradient-to-br from-[#0F766E] to-[#042F2E] rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0 md:mx-auto md:mb-3 shadow-md z-10 ring-4 ring-white dark:ring-[#07131d]"
                  >
                    {item.step}
                  </motion.div>

                  {/* Content Container */}
                  <div className="flex-1 md:flex-initial bg-slate-50 dark:bg-[#0e222e] md:bg-transparent md:dark:bg-transparent rounded-xl p-3 sm:p-4 md:p-0 border border-slate-200/80 dark:border-[#1a3d52]/80 md:border-0 min-w-0">
                    <div className="md:hidden flex items-center gap-1.5 mb-1">
                      <item.icon className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</h3>
                    </div>
                    <h3 className="hidden md:block font-bold text-base text-slate-900 dark:text-white mt-1 mb-1">{item.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 9. TRUST & ASSURANCE WITH RESTORED PILLAR POP */}
      <section className="relative py-14 sm:py-16 bg-slate-50 dark:bg-[#091823]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Restored Section Header Entrance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-10"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white font-sans font-bold tracking-tight">
              Why Students Choose StayKosh
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: ShieldCheck, title: 'Verified Properties', desc: 'Every stay is audited for safety, clean facilities, and real photos' },
              { icon: CheckCircle2, title: 'Zero Brokerage', desc: 'Direct connection with verified property owners without middlemen' },
              { icon: Sparkles, title: 'Digital Management', desc: 'Everything from rent receipts to maintenance tickets in one app' },
            ].map((trust, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08, margin: "-20px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-white dark:bg-[#0e222e] rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-[#1a3d52]/90 text-center shadow-xs"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-teal-50 dark:bg-teal-950/60 rounded-xl flex items-center justify-center mx-auto mb-3 text-[#0F766E] dark:text-teal-300">
                  <trust.icon className="h-5 w-5 sm:h-6 sm:w-6 text-[#0F766E] dark:text-teal-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">{trust.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">{trust.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FINAL CONVERGENCE CALL-TO-ACTION WITH RESTORED CARD & BUTTON ENTRANCES */}
      <section className="relative py-12 md:py-24 bg-gradient-to-br from-[#0F766E] to-[#042F2E] text-white overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08, margin: "-20px" }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center"
        >
          {/* Restored Center Icon Scale Pop */}
          <motion.div
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-sans font-bold tracking-tight mb-3">
            Your Stay. Your Place.
            <span className="text-teal-300 block">StayKosh.</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-teal-100 max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
            Whether you're finding your next college stay or managing your student residence, StayKosh brings everything together.
          </p>

          {/* Restored Button Group Staggered Slide-Up */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08, margin: "-20px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-xs sm:max-w-none mx-auto"
          >
            <Link
              href="/find-hostel"
              className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#0F766E] px-6 py-3 text-sm sm:text-base font-bold hover:bg-teal-50 transition-all duration-300 hover:-translate-y-0.5 shadow-xl"
            >
              <span>Explore Hostels</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border-2 border-white/30 bg-transparent px-6 py-3 text-sm sm:text-base font-bold hover:bg-white/10 transition-all duration-300"
            >
              Get Started
            </Link>
          </motion.div>
        </motion.div>
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
