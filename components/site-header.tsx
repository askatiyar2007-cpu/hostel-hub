'use client';

import React from 'react';
import Link from "next/link";
import { Menu } from "lucide-react";
import { StayKoshLogo } from '@/components/StayKoshLogo';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/context";
import { dashboardPathForRole } from "@/lib/auth/dashboard";
import { usePathname } from 'next/navigation';

export function SiteHeader() {
  const { profile, signOut, password_set, accountCompletionStep } = useAuth();
  const dashboardPath = dashboardPathForRole(profile?.role) ?? '/auth/select-role';
  const pathname = usePathname();
  
  // Do not render on the public homepage, dedicated auth routes, or authenticated workspace shells
  if (
    pathname === '/' ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/owner') ||
    pathname?.startsWith('/student') ||
    pathname?.startsWith('/parent') ||
    pathname?.startsWith('/admin')
  ) {
    return null;
  }

  
  // CRITICAL: Only show dashboard link for COMPLETED accounts.
  // password_set=false means NOT a HostelHub user, so no dashboard link should be shown.
  // An incomplete account in active onboarding should not see dashboard navigation.
  const isCompleteUser = password_set === true && accountCompletionStep === 'complete';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <StayKoshLogo
          size={36}
          theme="light"
          href={isCompleteUser ? dashboardPath : "/"}
        />

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/find-hostel" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted transition-colors">
            Browse hostels
          </Link>
          <Link href="/#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted transition-colors">
            How it works
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isCompleteUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Menu className="mr-2 h-4 w-4" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isCompleteUser && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={dashboardPath}>Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" className="rounded-full">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button className="rounded-full shadow-lg hover:opacity-95 transition-opacity">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
