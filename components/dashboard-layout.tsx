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
  ChevronLeft,
  ChevronRight,
  Bell,
  FileText,
  User,
  Menu,
  X,
  ShieldCheck,
  BarChart3,
  Zap,
  Gauge,
  Clipboard,
  Receipt,
  Coins,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { UserRole } from '@/types/database';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: {
    name: string;
    href: string;
    icon: React.ElementType;
  }[];
}

const ownerNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/owner/dashboard', icon: LayoutDashboard },
    { name: 'Hostels', href: '/owner/hostels', icon: Building2 },
    { name: 'Rooms', href: '/owner/rooms', icon: Home },
    { name: 'Room Requests', href: '/owner/requests', icon: FileText },
    { name: 'Students', href: '/owner/students', icon: Users },
    { 
      name: 'Electricity', 
      href: '/owner/electricity/billing', 
      icon: Zap,
      children: [
        { name: 'Billing Overview', href: '/owner/electricity/billing', icon: Receipt },
        { name: 'Meter Management', href: '/owner/electricity/meters', icon: Gauge },
        { name: 'Record Readings', href: '/owner/electricity/readings/record', icon: Clipboard },
        { name: 'Rate Configuration', href: '/owner/electricity/rates', icon: Coins }
      ]
    },
    { name: 'Announcements', href: '/owner/announcements', icon: Bell },
    { name: 'Payments', href: '/owner/payments', icon: CreditCard },
    { name: 'Complaints', href: '/owner/complaints', icon: MessageSquare },
    { name: 'Settings', href: '/owner/settings', icon: Settings },
  ];

const roleNavItems: Record<UserRole, NavItem[]> = {
  owner: ownerNavItems,
  hostel_owner: ownerNavItems,
  student: [
    { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Bills', href: '/student/bills', icon: CreditCard },
    { name: 'Electricity', href: '/student/electricity', icon: Zap },
    { name: 'Complaints', href: '/student/complaints', icon: MessageSquare },
    { name: 'Documents', href: '/student/documents', icon: FileText },
    { name: 'Announcements', href: '/student/announcements', icon: Bell },
    { name: 'Settings', href: '/student/settings', icon: Settings },
  ],
  parent: [
    { name: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
    { name: 'Student Info', href: '/parent/student-info', icon: Users },
    { name: 'Payments', href: '/parent/payments', icon: CreditCard },
    { name: 'Safety Logs', href: '/parent/safety', icon: ShieldCheck },
    { name: 'Contact', href: '/parent/contact', icon: MessageSquare },
    { name: 'Settings', href: '/parent/settings', icon: Settings },
  ],
  super_admin: [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Hostels', href: '/admin/hostels', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ],
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isElectricityOpen, setIsElectricityOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut, loading, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();

  const role = profile?.role as UserRole || 'student';
  const navItems = roleNavItems[role] || [];

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

  // CRITICAL BUSINESS RULE ENFORCEMENT:
  // password_set=false means NOT a HostelHub user, regardless of whether profile
  // or role data exists. An incomplete signup (e.g., Google OAuth where user
  // selected a role but never set a password) must NEVER access the dashboard.
  // The saved role is only temporary onboarding progress and grants NO access.
  //
  // This guard enforces the fundamental state machine:
  // password_set=false → incomplete signup → NOT a user → NO dashboard access
  // password_set=true → completed password step → check remaining onboarding steps
  //
  // For abandoned signups (user closed tab at password page, later reopened site),
  // this guard signs them out and redirects to /auth/login instead of restoring
  // the incomplete onboarding session at /auth/setup-password. This prevents
  // incomplete accounts from being treated as authenticated users.
  useEffect(() => {
    if (loading || !profile) return;

    // Check password_set FIRST, before any other completion checks.
    // If password_set is explicitly false, this is NOT a HostelHub user yet.
    // Sign them out and redirect to login page (fresh visit behavior).
    if (password_set === false) {
      console.log('[DashboardLayout] Detected incomplete account (password_set=false), signing out');
      void signOut().then(() => {
        router.push('/auth/login');
      });
      return;
    }

    // Only check accountCompletionStep if password_set is true (or null due to API error).
    // These checks handle legitimate onboarding-in-progress scenarios where the user
    // is actively completing their account setup (not an abandoned signup).
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
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile && accountCompletionStep && accountCompletionStep !== 'complete') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] border-r border-border bg-card transition-all duration-300 md:block",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto py-6">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => {
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
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
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
                                ? "bg-muted text-foreground font-semibold"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center">
                              <item.icon className="h-5 w-5 shrink-0 mr-3 text-muted-foreground group-hover:text-foreground" />
                              <span>{item.name}</span>
                            </div>
                            {isOpen ? (
                              <ChevronUp size={16} className="text-muted-foreground" />
                            ) : (
                              <ChevronDown size={16} className="text-muted-foreground" />
                            )}
                          </button>
                          {isOpen && (
                            <div className="pl-8 space-y-1 mt-1 transition-all">
                              {item.children?.map((child) => {
                                const isChildItemActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={cn(
                                      "group flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                      isChildItemActive
                                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    className={cn(
                      "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "mx-auto" : "mr-3")} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="border-t border-border p-4">
            <button
              onClick={() => signOut()}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className={cn("h-5 w-5 shrink-0", !isCollapsed && "mr-3")} />
              {!isCollapsed && <span>Logout</span>}
            </button>
            
            <button
              onClick={toggleSidebar}
              className="mt-4 hidden w-full items-center justify-center rounded-lg border border-border py-2 text-muted-foreground hover:bg-muted md:flex"
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r border-border transition-transform duration-300 ease-in-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="font-semibold">HostelHub</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleMobileSidebar}>
              <X size={20} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-6">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => {
                const hasChildren = 'children' in item && item.children && item.children.length > 0;
                const isChildActive = hasChildren && item.children?.some(child => pathname === child.href || pathname?.startsWith(child.href + '/'));
                const isActive = (!hasChildren && (pathname === item.href || pathname?.startsWith(item.href + '/'))) || isChildActive;

                if (hasChildren) {
                  const isOpen = item.name === 'Electricity' ? isElectricityOpen : false;
                  
                  return (
                    <div key={item.name} className="space-y-1">
                      <button
                        onClick={() => setIsElectricityOpen(!isElectricityOpen)}
                        className={cn(
                          "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-muted text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center">
                          <item.icon className="mr-3 h-5 w-5 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {isOpen ? (
                          <ChevronUp size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={16} className="text-muted-foreground" />
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
                                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <child.icon className="mr-2.5 h-4 w-4 shrink-0" />
                                <span>{child.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="border-t border-border p-4">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        {/* Mobile Header (only visible on small screens) */}
        <header className="sticky top-16 z-20 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleMobileSidebar}>
            <Menu size={20} />
          </Button>
          <div className="text-sm font-medium">{profile?.full_name}</div>
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User size={18} className="text-muted-foreground" />
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}