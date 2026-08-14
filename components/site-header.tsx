'use client';

import React from 'react';
import Link from "next/link";
import { Building2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/context";

export function SiteHeader() {
  const { isAuthenticated, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight font-display">HostelHub</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/marketplace" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted transition-colors">
            Browse hostels
          </Link>
          <Link href="/#how-it-works" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted transition-colors">
            How it works
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Menu className="mr-2 h-4 w-4" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={
                    profile?.role === 'owner'
                      ? '/owner/dashboard'
                      : profile?.role === 'student'
                      ? '/student/dashboard'
                      : '/parent/dashboard'
                  }>Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
