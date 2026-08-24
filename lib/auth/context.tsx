'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

export type AccountCompletionStep = 'role' | 'password' | 'student_onboarding' | 'complete';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  accountCompletionStep: AccountCompletionStep | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Synchronizes the browser session with its current application profile.
 * Account provisioning and all routing remain server- or page-owned concerns.
 * 
 * CRITICAL: This provider now uses /api/auth/account-state as the single source
 * of truth for account completion instead of reimplementing the get_account_state()
 * logic client-side. This ensures the database and client never diverge on what
 * constitutes a "complete" account.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountCompletionStep, setAccountCompletionStep] = useState<AccountCompletionStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const refreshAuthState = async (): Promise<void> => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setAccountCompletionStep(null);
      return;
    }

    setUser(session.user);

    // Fetch profile for UI display purposes (full_name, email, etc.)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    setProfile(profileData as Profile | null);

    if (!profileData) {
      setAccountCompletionStep(null);
      return;
    }

    // Get canonical completion state from server (single source of truth).
    // This replaces the previous client-side logic that duplicated the
    // get_account_state() SQL function's completion rules. Any changes to
    // account completion requirements now only need to update the SQL function.
    try {
      const response = await fetch('/api/auth/account-state');
      if (response.ok) {
        const state = await response.json();
        // The API returns missing_step='complete' for completed accounts, or the
        // actual missing step (role/password/student_onboarding) for incomplete ones
        const step = state.missing_step === 'complete' ? 'complete' : state.missing_step;
        setAccountCompletionStep(step as AccountCompletionStep);
      } else {
        // Fallback: if API fails, assume incomplete to be safe. This prevents
        // accidentally granting dashboard access due to API errors.
        console.error('Failed to fetch account state:', response.status);
        setAccountCompletionStep(null);
      }
    } catch (error) {
      console.error('Unable to fetch account state:', error);
      // Same fallback: assume incomplete on error
      setAccountCompletionStep(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const synchronize = async () => {
      try {
        await refreshAuthState();
      } catch (error) {
        console.error('Unable to synchronize auth state:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void synchronize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void synchronize();
    });
    const refreshOnFocus = () => void synchronize();
    const refreshOnPageShow = () => void synchronize();

    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('pageshow', refreshOnPageShow);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('pageshow', refreshOnPageShow);
    };
  }, []);

  const handleActualSignOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
      router.replace('/auth/login');
    } finally {
      setShowLogoutConfirm(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setShowLogoutConfirm(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        accountCompletionStep,
        loading,
        signOut,
        refreshAuthState,
        isAuthenticated: !!user,
      }}
    >
      {children}

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to logout?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleActualSignOut()}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
