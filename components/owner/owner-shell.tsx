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
  Search,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/lib/design-tokens';

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
    <nav className="space-y-6 px-3">
      {(() => {
        const groups = ['MAIN', 'OPERATIONS', 'SYSTEM'];
        return groups.map(group => {
          const groupItems = ownerNavItems.filter(item => item.group === group);
          if (groupItems.length === 0) return null;
          
          return (
            <div key={group}>
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
                              "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-teal-600 text-white shadow-sm"
                                : "text-gray-300 hover:bg-navy-800 hover:text-white"
                            )}
                            style={{ backgroundColor: isActive ? colors.primary.teal[600] : undefined }}
                          >
                            <item.icon className="h-5 w-5 shrink-0 mx-auto" />
                          </Link>
                        ) : (
                          <>
                            <button
                              onClick={() => setIsElectricityOpen(!isElectricityOpen)}
                              className={cn(
                                "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-teal-600 text-white font-semibold"
                                  : "text-gray-300 hover:bg-navy-800 hover:text-white"
                              )}
                              style={{ backgroundColor: isActive ? colors.primary.teal[600] : undefined }}
                            >
                              <div className="flex items-center">
                                <item.icon className="h-5 w-5 shrink-0 mr-3" />
                                <span>{item.name}</span>
                              </div>
                              {isOpen ? (
                                <ChevronUp size={16} className="text-gray-300" />
                              ) : (
                                <ChevronDown size={16} className="text-gray-300" />
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
                                        "group flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                        isChildItemActive
                                          ? "bg-teal-600 text-white shadow-sm font-semibold"
                                          : "text-gray-300 hover:bg-navy-800 hover:text-white"
                                      )}
                                      style={{ backgroundColor: isChildItemActive ? colors.primary.teal[600] : undefined }}
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
                      className={cn(
                        "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-teal-600 text-white shadow-sm"
                          : "text-gray-300 hover:bg-navy-800 hover:text-white"
                      )}
                      style={{ backgroundColor: isActive ? colors.primary.teal[600] : undefined }}
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
  const { profile, signOut, loading, accountCompletionStep, password_set } = useAuth();
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar - Dark Teal/Navy */}
      <aside 
        className={cn(
          "owner-sidebar fixed left-0 top-0 z-30 hidden h-screen border-r transition-all duration-300 md:block",
          isCollapsed ? "w-20" : "w-64"
        )}
        style={{ backgroundColor: colors.primary.navy[950], borderColor: colors.primary.navy[900] }}
      >
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className={cn(
            "flex items-center border-b p-4 flex-shrink-0",
            isCollapsed ? "justify-center" : "justify-between",
          )} style={{ borderColor: colors.primary.navy[900] }}>
            {!isCollapsed && (
              <Link href="/owner/dashboard" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: colors.primary.teal[500] }}>
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-white tracking-tight">HostelHub</span>
              </Link>
            )}
            {isCollapsed && (
              <Link href="/owner/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: colors.primary.teal[500] }}>
                <Building2 className="h-4 w-4 text-white" />
              </Link>
            )}
          </div>

          {/* Navigation with Groups - Scrollable */}
          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            <NavContent 
              isCollapsed={isCollapsed}
              pathname={pathname}
              isElectricityOpen={isElectricityOpen}
              setIsElectricityOpen={setIsElectricityOpen}
            />
          </div>
          
          {/* Collapse & Logout - Fixed Footer */}
          <div className="border-t p-4 flex-shrink-0" style={{ borderColor: colors.primary.navy[900] }}>
            <button
              onClick={() => signOut()}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span>Logout</span>}
            </button>
            
            <button
              onClick={toggleSidebar}
              className="mt-4 hidden w-full items-center justify-center rounded-lg border py-2 text-gray-300 hover:bg-navy-800 md:flex"
              style={{ borderColor: colors.primary.navy[800] }}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: colors.primary.navy[950] }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4 flex-shrink-0" style={{ borderColor: colors.primary.navy[900] }}>
            <Link href="/owner/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: colors.primary.teal[500] }}>
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-white tracking-tight">HostelHub</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleMobileSidebar} className="text-white hover:bg-navy-800">
              <X size={20} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            <NavContent 
              isCollapsed={false}
              pathname={pathname}
              isElectricityOpen={isElectricityOpen}
              setIsElectricityOpen={setIsElectricityOpen}
            />
          </div>
          <div className="border-t p-4 flex-shrink-0" style={{ borderColor: colors.primary.navy[900] }}>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 min-w-0 max-w-full transition-all duration-300",
        isCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4 md:px-6" style={{ borderColor: colors.neutral[200] }}>
          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" onClick={toggleMobileSidebar} className="md:hidden">
            <Menu size={20} />
          </Button>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-lg">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search hostels, rooms, students..."
                className="pl-10 h-9 bg-gray-50 border-gray-200 text-sm focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative h-9 w-9 hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            </Button>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-3 border-l" style={{ borderColor: colors.neutral[200] }}>
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Owner'}</p>
                <p className="text-xs text-gray-500">Owner</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-medium">
                {profile?.full_name?.charAt(0) || 'O'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-3.5rem)] min-w-0 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
