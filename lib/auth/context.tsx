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

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    // A missing profile represents an incomplete, onboarding-only session.
    // The provider deliberately does not create records or choose a route.
    setProfile(profileData as Profile | null);

    if (!profileData) {
      setAccountCompletionStep(null);
      return;
    }

    // Mirrors the canonical server-side completion rule in get_account_state():
    // a role must be present, the account password must be set, and a student
    // role additionally requires its students row. This is a read-only check
    // under existing RLS policies; it never creates or modifies any record.
    if (!profileData.role) {
      setAccountCompletionStep('role');
      return;
    }

    if (!profileData.password_set) {
      setAccountCompletionStep('password');
      return;
    }

    if (profileData.role === 'student') {
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profileData.id)
        .maybeSingle();

      if (studentError) throw studentError;

      setAccountCompletionStep(studentRecord ? 'complete' : 'student_onboarding');
      return;
    }

    setAccountCompletionStep('complete');
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
