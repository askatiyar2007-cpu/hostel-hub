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
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/context';
import { UserRole } from '@/types/database';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const ownerNavItems: NavItem[] = [
    { name: 'Dashboard', href: '/owner/dashboard', icon: LayoutDashboard },
    { name: 'Hostels', href: '/owner/hostels', icon: Building2 },
    { name: 'Rooms', href: '/owner/rooms', icon: Home },
    { name: 'Room Requests', href: '/owner/requests', icon: FileText },
    { name: 'Students', href: '/owner/students', icon: Users },
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
  const pathname = usePathname();
  const { profile, signOut, loading, accountCompletionStep } = useAuth();
  const router = useRouter();

  const role = profile?.role as UserRole || 'student';
  const navItems = roleNavItems[role] || [];

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // An account with a role but an incomplete required setup step (e.g. an
  // abandoned Google signup that selected a role but never set a password)
  // must never render or stay on a dashboard route. Resume at the exact
  // missing step instead. This is a read-only redirect; it creates nothing.
  useEffect(() => {
    if (loading || !profile) return;

    if (accountCompletionStep === 'role') {
      router.push('/auth/select-role');
      return;
    }

    if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
      router.push('/auth/setup-password');
    }
  }, [loading, profile, accountCompletionStep, router]);

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
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
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
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
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
