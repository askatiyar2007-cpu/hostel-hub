'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  FileText,
  Menu,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Home
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
import { OwnerBackground } from '../owner/owner-background';
import { SidebarBackground } from '../owner/sidebar-background';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  group?: string;
}

const studentNavItems: NavItem[] = [
  // MAIN
  { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard, group: 'MAIN' },
  { name: 'Bills', href: '/student/bills', icon: CreditCard, group: 'MAIN' },
  { name: 'Electricity', href: '/student/electricity', icon: Zap, group: 'MAIN' },

  // SUPPORT
  { name: 'Announcements', href: '/student/announcements', icon: Bell, group: 'SUPPORT' },
  { name: 'Complaints', href: '/student/complaints', icon: MessageSquare, group: 'SUPPORT' },
  { name: 'Documents', href: '/student/documents', icon: FileText, group: 'SUPPORT' },
  { name: 'Room Request', href: '/student/room-request', icon: Home, group: 'SUPPORT' },

  // SYSTEM
  { name: 'Settings', href: '/student/settings', icon: Settings, group: 'SYSTEM' },
];

function NavContent({ isCollapsed, pathname }: {
  isCollapsed: boolean;
  pathname: string | null;
}) {
  return (
    <nav className="space-y-1 px-3">
      {(() => {
        const groups = ['MAIN', 'SUPPORT', 'SYSTEM'];
        return groups.map(group => {
          const groupItems = studentNavItems.filter(item => item.group === group);
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
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  
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

export function StudentShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const { profile, user, signOut, loading, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Authentication guard
  useEffect(() => {
    if (loading || !profile) return;

    if (password_set === false) {
      console.log('[StudentShell] Detected incomplete account (password_set=false), signing out');
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
      {/* BackgroundLayer: pale blue architectural environment */}
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
          {/* Logo Section */}
          <div className={cn(
            "flex h-14 items-center border-b px-4 flex-shrink-0 border-slate-800/80 bg-[#081720]/95 backdrop-blur-xs",
            isCollapsed ? "justify-center" : "justify-between",
          )}>
            {!isCollapsed && (
              <Link href="/student/dashboard" className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-md group-hover:scale-105 transition-transform">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-white tracking-tight text-base block leading-none">HostelHub</span>
                  <span className="text-[10px] font-semibold text-teal-400 tracking-wider uppercase mt-1 block">Student Workspace</span>
                </div>
              </Link>
            )}
            {isCollapsed && (
              <Link href="/student/dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400">
                <Building2 className="h-5 w-5 text-white" />
              </Link>
            )}
          </div>

          {/* Navigation with Groups */}
          <div className="relative z-10 flex-1 overflow-y-auto py-4 min-h-0">
            <NavContent 
              isCollapsed={isCollapsed}
              pathname={pathname}
            />
          </div>
          
          {/* Collapse & Logout */}
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
        <SidebarBackground isCollapsed={false} />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b px-4 flex-shrink-0 border-slate-800/80 bg-[#081720]/95 backdrop-blur-xs">
            <Link href="/student/dashboard" className="flex items-center gap-2.5">
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

      {/* Top Header - FIXED AT THE TOP */}
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
              <span className="hidden sm:inline-block text-[10px] font-semibold text-teal-400/90 tracking-wider uppercase">Student Workspace</span>
            </div>
          </div>
        </div>

        {/* Center: Clean Empty Area */}
        <div className="flex-1" />

        {/* Right Side Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Notifications */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-9 w-9 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
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
                  aria-label="Student account menu"
                >
                  {/* Clean circular avatar */}
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.full_name || 'Student'}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-teal-400/40 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center text-xs font-bold tracking-wide ring-2 ring-teal-400/40 shadow-xs shrink-0">
                      {(() => {
                        const name = profile?.full_name || user?.user_metadata?.full_name || 'Student';
                        const parts = name.trim().split(/\s+/);
                        if (parts.length >= 2) {
                          return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
                        }
                        return (name.charAt(0) || 'S').toUpperCase();
                      })()}
                    </div>
                  )}

                  {/* Real student name + "Student" subtitle */}
                  <div className="hidden sm:block leading-tight text-left">
                    <p className="text-sm font-semibold text-white leading-none truncate max-w-[140px]">
                      {profile?.full_name || user?.user_metadata?.full_name || 'Student'}
                    </p>
                    <p className="text-[11px] text-teal-300/80 font-medium leading-none mt-1">
                      Student
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-68 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* Account Header Card */}
                <div className="p-3 bg-gradient-to-r from-slate-50 to-teal-50/40 rounded-lg border border-slate-200/80 mb-1.5">
                  <div className="flex items-center gap-3">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile?.full_name || 'Student'}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-xs"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-teal-700 via-teal-600 to-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-xs ring-2 ring-white">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {profile?.full_name || 'Student'}
                      </p>
                      <p className="text-xs text-slate-500 truncate" title={profile?.email || user?.email || ''}>
                        {profile?.email || user?.email || 'No email registered'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[11px]">
                    <span className="font-semibold text-teal-800 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-full">
                      Student
                    </span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1 border-slate-100" />

                <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:bg-slate-100">
                  <Link href="/student/settings" className="flex items-center gap-2.5 w-full">
                    <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                      <Settings size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">Account Settings</span>
                      <span className="text-[10px] text-slate-400">Profile & preferences</span>
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

      {/* Main Content Area */}
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
