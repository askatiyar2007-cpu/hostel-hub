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
  password_set: boolean | null;
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
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Resilient synchronization and in-flight deduplication refs
  const inFlightSyncRef = React.useRef<Promise<void> | null>(null);
  const accountStateFailureCountRef = React.useRef<number>(0);
  const lastAccountStateFailureTimeRef = React.useRef<number>(0);

  const refreshAuthState = async (): Promise<void> => {
    // If a synchronization is already in-flight, reuse it to prevent race conditions
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    const runSync = async (): Promise<void> => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setAccountCompletionStep(null);
        setPasswordSet(null);
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
        setPasswordSet(null);
        return;
      }

      // Get canonical completion state from server (single source of truth).
      // We always attempt to fetch canonical state, but if transient errors occur,
      // we gracefully fall back without poisoning future authentications.
      try {
        const response = await fetch('/api/auth/account-state');
        if (response.ok) {
          const state = await response.json();
          // Reset failure tracking on success
          accountStateFailureCountRef.current = 0;
          lastAccountStateFailureTimeRef.current = 0;

          const step = state.missing_step === 'complete' ? 'complete' : state.missing_step;
          setAccountCompletionStep(step as AccountCompletionStep);
          setPasswordSet(state.password_set ?? null);
        } else {
          accountStateFailureCountRef.current += 1;
          lastAccountStateFailureTimeRef.current = Date.now();
          console.error('Failed to fetch account state:', response.status);

          if (response.status === 401) {
            setAccountCompletionStep(null);
            setPasswordSet(null);
          } else {
            // Transient failure fallback for development or server hiccup
            if (profileData) {
              if (!profileData.role) {
                setAccountCompletionStep('role');
              } else if (!profileData.full_name) {
                setAccountCompletionStep('password');
              } else {
                setAccountCompletionStep('complete');
              }
              setPasswordSet(profileData.password_set ?? true);
            } else {
              setAccountCompletionStep(null);
              setPasswordSet(null);
            }
          }
        }
      } catch (error) {
        accountStateFailureCountRef.current += 1;
        lastAccountStateFailureTimeRef.current = Date.now();
        console.error('Unable to fetch account state:', error);

        if (profileData) {
          if (!profileData.role) {
            setAccountCompletionStep('role');
          } else if (!profileData.full_name) {
            setAccountCompletionStep('password');
          } else {
            setAccountCompletionStep('complete');
          }
          setPasswordSet(profileData.password_set ?? true);
        } else {
          setAccountCompletionStep(null);
          setPasswordSet(null);
        }
      }
    };

    const promise = runSync().finally(() => {
      inFlightSyncRef.current = null;
    });

    inFlightSyncRef.current = promise;
    return promise;
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
    } = supabase.auth.onAuthStateChange((event) => {
      // On explicit auth events, reset failure counters so fresh sign-ins always sync cleanly
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        accountStateFailureCountRef.current = 0;
        lastAccountStateFailureTimeRef.current = 0;
        void synchronize();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setAccountCompletionStep(null);
        setPasswordSet(null);
        accountStateFailureCountRef.current = 0;
        lastAccountStateFailureTimeRef.current = 0;
      } else {
        void synchronize();
      }
    });

    // Only throttle passive focus/pageshow if a recent failure occurred within 15 seconds
    const refreshOnFocus = () => {
      const now = Date.now();
      if (accountStateFailureCountRef.current > 0 && now - lastAccountStateFailureTimeRef.current < 15000) {
        return;
      }
      void synchronize();
    };

    const refreshOnPageShow = (event: PageTransitionEvent) => {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const isProtected = 
        pathname.startsWith('/owner') ||
        pathname.startsWith('/student') ||
        pathname.startsWith('/parent') ||
        pathname.startsWith('/admin');

      if (isProtected) {
        // Immediate session verification for protected routes on page restoration (bfcache or back/forward navigation)
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            window.location.replace('/auth/login');
            return;
          }
          if (event.persisted) {
            accountStateFailureCountRef.current = 0;
            lastAccountStateFailureTimeRef.current = 0;
          }
          void synchronize();
        });
      } else {
        if (event.persisted) {
          accountStateFailureCountRef.current = 0;
          lastAccountStateFailureTimeRef.current = 0;
        }
        const now = Date.now();
        if (accountStateFailureCountRef.current > 0 && now - lastAccountStateFailureTimeRef.current < 15000) {
          return;
        }
        void synchronize();
      }
    };

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
      if (error) console.error('Sign out error:', error);
    } catch (err) {
      console.error('Sign out exception:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setAccountCompletionStep(null);
      setPasswordSet(null);
      setShowLogoutConfirm(false);
      // Hard redirect to clear browser in-memory caches, React Query cache, and bfcache snapshots
      if (typeof window !== 'undefined') {
        window.location.replace('/auth/login');
      } else {
        router.replace('/auth/login');
      }
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
        password_set: passwordSet,
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