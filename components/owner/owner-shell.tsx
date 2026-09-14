'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Home, 
  Users, 
  CreditCard, 
  MessageSquare, 
  Settings, 
  LogOut,
  Bell,
  FileText,
  Menu,
  X,
  Zap,
  Gauge,
  Clipboard,
  Receipt,
  Coins,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/context';
import { OwnerBackground } from './owner-background';
import { SidebarBackground } from './sidebar-background';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: {
    name: string;
    href: string;
    icon: React.ElementType;
  }[];
  group?: string;
}

const ownerNavItems: NavItem[] = [
  // MAIN
  { name: 'Dashboard', href: '/owner/dashboard', icon: LayoutDashboard, group: 'MAIN' },
  { name: 'Hostels', href: '/owner/hostels', icon: Building2, group: 'MAIN' },
  { name: 'Rooms', href: '/owner/rooms', icon: Home, group: 'MAIN' },
  { name: 'Room Requests', href: '/owner/requests', icon: FileText, group: 'MAIN' },
  { name: 'Students', href: '/owner/students', icon: Users, group: 'MAIN' },
  
  // OPERATIONS
  { 
    name: 'Electricity', 
    href: '/owner/electricity/billing', 
    icon: Zap,
    group: 'OPERATIONS',
    children: [
      { name: 'Billing Overview', href: '/owner/electricity/billing', icon: Receipt },
      { name: 'Meter Management', href: '/owner/electricity/meters', icon: Gauge },
      { name: 'Record Readings', href: '/owner/electricity/readings/record', icon: Clipboard },
      { name: 'Rate Configuration', href: '/owner/electricity/rates', icon: Coins }
    ]
  },
  { name: 'Announcements', href: '/owner/announcements', icon: Bell, group: 'OPERATIONS' },
  { name: 'Payments', href: '/owner/payments', icon: CreditCard, group: 'OPERATIONS' },
  { name: 'Complaints', href: '/owner/complaints', icon: MessageSquare, group: 'OPERATIONS' },
  { name: 'Reports', href: '/owner/reports', icon: BarChart3, group: 'OPERATIONS' },
  
  // SYSTEM
  { name: 'Settings', href: '/owner/settings', icon: Settings, group: 'SYSTEM' },
];

function NavContent({ isCollapsed, pathname, isElectricityOpen, setIsElectricityOpen }: {
  isCollapsed: boolean;
  pathname: string | null;
  isElectricityOpen: boolean;
  setIsElectricityOpen: (v: boolean) => void;
}) {
  return (
    <nav className="space-y-1 px-3">
      {(() => {
        const groups = ['MAIN', 'OPERATIONS', 'SYSTEM'];
        return groups.map(group => {
          const groupItems = ownerNavItems.filter(item => item.group === group);
          if (groupItems.length === 0) return null;
          
          return (
            <div key={group} className="mb-6 last:mb-0">
              {!isCollapsed && (
                <p className="px-3 mb-2 text-xs font-semibold text-gray-400 tracking-wider">
                  {group}
                </p>
              )}
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const hasChildren = 'children' in item && item.children && item.children.length > 0;
                  const isChildActive = hasChildren && item.children?.some(child => pathname === child.href || pathname?.startsWith(child.href + '/'));
                  const isActive = (!hasChildren && (pathname === item.href || pathname?.startsWith(item.href + '/'))) || isChildActive;
                  
                  if (hasChildren) {
                    const isOpen = item.name === 'Electricity' ? isElectricityOpen : false;
                    
                    return (
                      <div key={item.name} className="space-y-1">
                        {isCollapsed ? (
                          <Link
                            href={item.href}
                            title={item.name}
                            className={cn(
                              "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                              isActive
                                ? "bg-teal-600 text-white shadow-xs font-semibold"
                                : "text-slate-300 hover:bg-slate-800/80 hover:text-white hover:translate-x-0.5"
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0 mx-auto" />
                          </Link>
                        ) : (
                          <>
                            <button
                              onClick={() => setIsElectricityOpen(!isElectricityOpen)}
                              className={cn(
                                "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                                isActive
                                  ? "bg-teal-600 text-white shadow-xs font-semibold"
                                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white hover:translate-x-0.5"
                              )}
                            >
                              <div className="flex items-center">
                                <item.icon className="h-5 w-5 shrink-0 mr-3" />
                                <span>{item.name}</span>
                              </div>
                              {isOpen ? (
                                <ChevronUp size={16} className={isActive ? "text-white" : "text-slate-400"} />
                              ) : (
                                <ChevronDown size={16} className={isActive ? "text-white" : "text-slate-400"} />
                              )}
                            </button>
                            {isOpen && (
                              <div className="pl-8 space-y-1 mt-1">
                                {item.children?.map((child) => {
                                  const isChildItemActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                                  return (
                                    <Link
                                      key={child.name}
                                      href={child.href}
                                      className={cn(
                                        "group flex items-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                                        isChildItemActive
                                          ? "bg-teal-600 text-white shadow-xs font-semibold"
                                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white hover:translate-x-0.5"
                                      )}
                                    >
                                      <child.icon className="mr-2.5 h-4 w-4 shrink-0" />
                                      <span>{child.name}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={isCollapsed ? item.name : ""}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                        isActive
                          ? "bg-teal-600 text-white shadow-xs font-semibold"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white hover:translate-x-0.5"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "mx-auto" : "mr-3")} />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
    </nav>
  );
}

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isElectricityOpen, setIsElectricityOpen] = useState(false);
  const pathname = usePathname();
  const { profile, user, signOut, loading, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Expand electricity sub-menu if on electricity routes
  useEffect(() => {
    if (pathname?.startsWith('/owner/electricity')) {
      setIsElectricityOpen(true);
    }
  }, [pathname]);

  // Authentication guard (same logic as existing)
  useEffect(() => {
    if (loading || !profile) return;

    if (password_set === false) {
      console.log('[OwnerShell] Detected incomplete account (password_set=false), signing out');
      void signOut().then(() => {
        router.push('/auth/login');
      });
      return;
    }

    if (accountCompletionStep === 'role') {
      router.push('/auth/select-role');
      return;
    }

    if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
      router.push('/auth/setup-password');
    }
  }, [loading, profile, accountCompletionStep, password_set, router, signOut]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (profile && accountCompletionStep && accountCompletionStep !== 'complete') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative text-slate-900 overflow-x-hidden selection:bg-teal-100 selection:text-teal-900">
      {/* BackgroundLayer: dedicated atmospheric environmental background matching Image 2 */}
      <OwnerBackground />

      {/* Desktop Sidebar - Deep Dark Navy/Teal with architectural skyline at bottom */}
      <aside 
        className={cn(
          "owner-sidebar fixed left-0 top-0 z-50 hidden h-screen border-r transition-all duration-300 md:block shadow-2xl bg-[#081720] border-slate-800/80 overflow-hidden shrink-0",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Architectural background decoration behind sidebar navigation */}
        <SidebarBackground isCollapsed={isCollapsed} />

        <div className="relative z-10 flex h-full flex-col">
          {/* Logo Section - exact h-14 to match top header */}
          <div className={cn(
            "flex h-14 items-center border-b px-4 flex-shrink-0 border-slate-800/80 bg-[#081720]/95 backdrop-blur-xs",
            isCollapsed ? "justify-center" : "justify-between",
          )}>
            {!isCollapsed && (
              <Link href="/owner/dashboard" className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-md group-hover:scale-105 transition-transform">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-white tracking-tight text-base block leading-none">HostelHub</span>
                  <span className="text-[10px] font-semibold text-teal-400 tracking-wider uppercase mt-1 block">Owner Workspace</span>
                </div>
              </Link>
            )}
            {isCollapsed && (
              <Link href="/owner/dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
                <Building2 className="h-5 w-5 text-white" />
              </Link>
            )}
          </div>

          {/* Navigation with Groups - Scrollable, sitting solidly above background */}
          <div className="relative z-10 flex-1 overflow-y-auto py-4 min-h-0">
            <NavContent 
              isCollapsed={isCollapsed}
              pathname={pathname}
              isElectricityOpen={isElectricityOpen}
              setIsElectricityOpen={setIsElectricityOpen}
            />
          </div>
          
          {/* Collapse & Logout - Fixed Footer, sitting solidly above background */}
          <div className="relative z-20 border-t p-4 flex-shrink-0 border-slate-800/80 bg-[#081720] shadow-lg">
            <button
              onClick={() => signOut()}
              className={cn(
                "flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className={cn("h-4.5 w-4.5 shrink-0", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span>Logout</span>}
            </button>
            
            <button
              onClick={toggleSidebar}
              className="mt-2.5 hidden w-full items-center justify-center rounded-xl border py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 transition-all border-slate-800 md:flex text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl bg-[#081720] overflow-hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Architectural background decoration for mobile sidebar */}
        <SidebarBackground isCollapsed={false} />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b px-4 flex-shrink-0 border-slate-800/80 bg-[#081720]/95 backdrop-blur-xs">
            <Link href="/owner/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-700 via-teal-600 to-teal-500 shadow-md">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white tracking-tight">HostelHub</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleMobileSidebar} className="text-white hover:bg-slate-800/60 rounded-lg cursor-pointer">
              <X size={20} />
            </Button>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto py-4 min-h-0">
            <NavContent 
              isCollapsed={false}
              pathname={pathname}
              isElectricityOpen={isElectricityOpen}
              setIsElectricityOpen={setIsElectricityOpen}
            />
          </div>
          <div className="relative z-20 border-t p-4 flex-shrink-0 border-slate-800/80 bg-[#081720] shadow-lg">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut className="mr-3 h-4.5 w-4.5 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Top Header - FIXED AT THE TOP (NEVER SCROLLS AWAY) */}
      <header className={cn(
        "fixed top-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[#0d3340] bg-[#07212b] px-4 md:px-6 shadow-sm transition-all duration-300",
        isCollapsed ? "left-0 md:left-20" : "left-0 md:left-64"
      )}>
        {/* Left Side: Sidebar Toggle & Branding */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobileSidebar} 
            className="md:hidden text-teal-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer h-9 w-9 focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </Button>

          {/* Desktop Sidebar Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex text-teal-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer h-9 w-9 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 active:scale-95"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={18} />
          </Button>

          {/* Desktop HostelHub Branding context */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-xs">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-white tracking-tight text-base leading-none">HostelHub</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-teal-400/90 tracking-wider uppercase">Workspace</span>
            </div>
          </div>
        </div>

          {/* Center: Clean Empty Area (No giant global search bar on dashboard) */}
          <div className="flex-1" />

          {/* Right Side Actions: Notification Bell | Separator | Owner Profile Dropdown */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Notifications with indicator dot */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 active:scale-95"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#07212b]" />
            </Button>

            {/* Subtle vertical separator */}
            <div className="h-5 w-px bg-slate-700/80" aria-hidden="true" />

            {/* Profile Dropdown */}
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    type="button"
                    className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 text-left group cursor-pointer"
                    aria-label="Owner account menu"
                  >
                    {/* Clean circular avatar */}
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile?.full_name || 'Owner'}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-teal-400/40 shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xs font-bold tracking-wide ring-2 ring-teal-400/40 shadow-xs shrink-0">
                        {(() => {
                          const name = profile?.full_name || user?.user_metadata?.full_name || 'Owner';
                          const parts = name.trim().split(/\s+/);
                          if (parts.length >= 2) {
                            return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
                          }
                          return (name.charAt(0) || 'O').toUpperCase();
                        })()}
                      </div>
                    )}

                    {/* Real owner name + "Owner" subtitle */}
                    <div className="hidden sm:block leading-tight text-left">
                      <p className="text-sm font-semibold text-white leading-none truncate max-w-[140px]">
                        {profile?.full_name || user?.user_metadata?.full_name || 'Hostel Owner'}
                      </p>
                      <p className="text-[11px] text-teal-300/80 font-medium leading-none mt-1">
                        Owner
                      </p>
                    </div>

                    {/* Dropdown chevron */}
                    <ChevronDown size={14} className="text-slate-400 group-hover:text-white transition-transform duration-200 group-data-[state=open]:rotate-180 ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-68 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Account Header Card */}
                  <div className="p-3 bg-gradient-to-r from-slate-50 to-teal-50/40 rounded-lg border border-slate-200/80 mb-1.5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-teal-700 via-teal-600 to-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-xs ring-2 ring-white">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'O'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {profile?.full_name || 'Hostel Owner'}
                        </p>
                        <p className="text-xs text-slate-500 truncate" title={profile?.email || user?.email || ''}>
                          {profile?.email || user?.email || 'No email registered'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[11px]">
                      <span className="font-semibold text-teal-800 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-full">
                        Hostel Owner
                      </span>
                      <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="my-1 border-slate-100" />

                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:bg-slate-100">
                    <Link href="/owner/settings" className="flex items-center gap-2.5 w-full">
                      <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                        <Settings size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">Account Settings</span>
                        <span className="text-[10px] text-slate-400">Profile & preferences</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:bg-slate-100">
                    <Link href="/owner/settings/payment-methods" className="flex items-center gap-2.5 w-full">
                      <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                        <CreditCard size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">Payment Methods</span>
                        <span className="text-[10px] text-slate-400">UPI, Bank accounts & QR</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 border-slate-100" />

                  <DropdownMenuItem 
                    onClick={() => signOut()} 
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700 flex items-center gap-2.5"
                  >
                    <div className="p-1 rounded-md bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                      <LogOut size={14} />
                    </div>
                    <span className="font-semibold text-rose-600">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content Area - with pt-20 top offset to clear fixed header and md:ml to clear sidebar */}
        <div className={cn(
          "relative z-10 flex-1 min-w-0 ml-0 transition-all duration-300 pt-20",
          isCollapsed ? "md:ml-20" : "md:ml-64"
        )}>
          {/* Page Content */}
          <main className="min-h-[calc(100vh-5rem)] min-w-0">
            <div className="w-full max-w-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }
