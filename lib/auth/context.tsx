'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';
import { User } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string, role: UserRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  updateUserRole: (role: UserRole) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Global authentication state and profile sync provider.
 * Wraps user sessions, profile lookups, and auto-provisioning of student records.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const router = useRouter();

  // Memory lock to prevent concurrent student record checks/insert requests
  const ensuredProfilesRef = useRef<Set<string>>(new Set());

  /**
   * Idempotent check and insert for student records.
   * Ensures that student table contains a row referencing the profile ID.
   * 
   * @param profileId Profile UUID.
   */
  const ensureStudentRecord = async (profileId: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ensureStudentRecord START] Profile ID: ${profileId}`);

    // 1. Check memory lock
    if (ensuredProfilesRef.current.has(profileId)) {
      console.log(`[${timestamp}] [ensureStudentRecord END] Already processed or check in progress (skipped)`);
      return;
    }
    
    // Acquire memory lock
    ensuredProfilesRef.current.add(profileId);

    try {
      console.log(`[${timestamp}] [ensureStudentRecord] Checking existing student record for Profile ID: ${profileId}`);
      const { data: existing, error: fetchError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[${timestamp}] [ensureStudentRecord] Error fetching student record:`, fetchError.message);
        // Release lock to allow recovery on retry
        ensuredProfilesRef.current.delete(profileId);
        console.log(`[${timestamp}] [ensureStudentRecord END] Aborted due to fetch failure`);
        return;
      }

      console.log(`[${timestamp}] [ensureStudentRecord] Query completed. Existing student found:`, existing ? 'Yes' : 'No');

      // 2. Return immediately if profile already has student record
      if (existing) {
        console.log(`[${timestamp}] [ensureStudentRecord END] Student record already verified`);
        return;
      }

      // 3. Insert student record
      console.log(`[${timestamp}] [ensureStudentRecord] Attempting insert for Profile ID: ${profileId}...`);
      const { error: insertError } = await supabase
        .from('students')
        .insert({
          profile_id: profileId,
          status: 'active'
        });

      if (insertError) {
        // 4. Gracefully ignore unique constraint violations (race condition won by parallel session/handler)
        if (insertError.code === '23505') {
          console.log(`[${timestamp}] [ensureStudentRecord END] Duplicate ignored (race condition won by concurrent request)`);
          return;
        }
        
        console.error(`[${timestamp}] [ensureStudentRecord] Insertion failed:`, insertError.message);
        ensuredProfilesRef.current.delete(profileId);
      } else {
        console.log(`[${timestamp}] [ensureStudentRecord] Student created successfully`);
      }
      console.log(`[${timestamp}] [ensureStudentRecord END] Completed execution`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown exception';
      console.error(`[${timestamp}] [ensureStudentRecord] Unexpected exception:`, errMsg);
      ensuredProfilesRef.current.delete(profileId);
      console.log(`[${timestamp}] [ensureStudentRecord END] Aborted on critical exception`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authListener: { unsubscribe: () => void } | null = null;

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AuthProvider useEffect] Mount initiated`);

    /**
     * Shared logic to fetch fresh profiles and trigger student record creation.
     */
    const handleProfileAndStudent = async (sessionUser: User) => {
      const time = new Date().toISOString();
      try {
        console.log(`[${time}] [AuthProvider] Fetching fresh profile data for User ID: ${sessionUser.id}`);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', sessionUser.id)
          .single();

        if (profileError) {
          console.error(`[${time}] [AuthProvider] Profile fetch error:`, profileError.message);
          return;
        }

        if (!isMounted) return;

        if (profileData) {
          console.log(`[${time}] [AuthProvider] Profile loaded. Role: ${profileData.role}, Profile ID: ${profileData.id}`);
          setProfile(profileData as Profile);
          
          if (profileData.role === 'student') {
            console.log(`[${time}] [AuthProvider] Calling ensureStudentRecord for student`);
            await ensureStudentRecord(profileData.id);
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown exception';
        console.error(`[${time}] [AuthProvider] Exception handling auth state:`, errMsg);
      }
    };

    /**
     * Async initialization task executing once on mount.
     */
    const initializeAuth = async () => {
      const time = new Date().toISOString();
      try {
        console.log(`[${time}] [AuthProvider initializeAuth] Fetching session...`);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error(`[${time}] [AuthProvider initializeAuth] Session fetch error:`, sessionError.message);
          if (isMounted) setLoading(false);
          return;
        }

        if (session?.user) {
          console.log(`[${time}] [AuthProvider initializeAuth] Active session found for User: ${session.user.email}`);
          if (isMounted) setUser(session.user);
          await handleProfileAndStudent(session.user);
        } else {
          console.log(`[${time}] [AuthProvider initializeAuth] No active session found`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown exception';
        console.error(`[${time}] [AuthProvider initializeAuth] Exception during initialization:`, errMsg);
      } finally {
        if (isMounted) {
          console.log(`[${new Date().toISOString()}] [AuthProvider initializeAuth] Loading finished`);
          setLoading(false);
        }
      }
    };

    // 1. Run initial auth state recovery
    initializeAuth();

    // 2. Register callback listener to capture auth changes
    console.log(`[${timestamp}] [AuthProvider useEffect] Subscribing to onAuthStateChange...`);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const time = new Date().toISOString();
      console.log(`[${time}] [AuthProvider onAuthStateChange] Event: ${event}, User email: ${session?.user?.email || 'None'}`);

      if (event === 'SIGNED_OUT') {
        console.log(`[${time}] [AuthProvider onAuthStateChange] Signed out. Clearing states.`);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          ensuredProfilesRef.current.clear();
        }
        return;
      }

      if (session?.user) {
        if (isMounted) {
          setUser(session.user);
        }

        await handleProfileAndStudent(session.user);

        // Manual log in / sign up redirect triggers
        if (event === 'SIGNED_IN' && isMounted) {
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          console.log('[onAuthStateChange] SIGNED_IN event fired. Current path:', currentPath);

          // List of pages where we should NOT auto-redirect
          const noRedirectPaths = [
            '/auth/callback',
            '/auth/setup-password',
            '/auth/select-role',
            '/auth/reset-password',
            '/auth/forgot-password',
            '/student/room-request',      // ← Student pages - stay here
            '/student/dashboard',
            '/student/fees',
            '/student/allocations',
            '/student/complaints',
            '/owner/dashboard',            // ← Owner pages - stay here
            '/owner/requests',
            '/owner/hostels',
            '/owner/rooms',
            '/owner/students',
            '/owner/settings',
            '/parent/dashboard',           // ← Parent pages - stay here
          ];

          // Only redirect if on public pages
          const isPublicPage = !noRedirectPaths.some(path => currentPath.startsWith(path));

          if (isPublicPage) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('role')
              .eq('user_id', session.user.id)
              .single();
            
            if (profileData) {
              const redirectMap: Record<string, string> = {
                hostel_owner: '/owner/dashboard',
                student: '/student/dashboard',
                parent: '/parent/dashboard',
                super_admin: '/admin/dashboard',
              };
              const target = redirectMap[profileData.role as string] ?? '/student/dashboard';
              console.log(`[${time}] [AuthProvider onAuthStateChange] Redirecting logged in user to: ${target}`);
              router.push(target);
            }
          } else {
            console.log(`[onAuthStateChange] SKIPPING auto-redirect - preserved location: ${currentPath}`);
          }
        }
      }
    });

    authListener = subscription;

    // 3. Cleanup hooks on unmount
    return () => {
      console.log(`[${new Date().toISOString()}] [AuthProvider useEffect] Unmounting context provider`);
      isMounted = false;
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, [router]);

  /**
   * Triggers redirection to Google OAuth endpoint.
   * 
   * @param role The student/hostel owner/parent role string.
   */
  const signInWithGoogle = async (role?: UserRole): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [signInWithGoogle] Initiating Google login. Role: ${role || 'None'}`);
    try {
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback` 
        : 'http://localhost:8080/auth/callback';
      
      console.log(`[${timestamp}] [signInWithGoogle] Callback redirect URL: ${redirectTo}`);
      const isValidRole = typeof role === 'string' && ['student', 'hostel_owner', 'parent', 'super_admin'].includes(role);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          ...(isValidRole ? { data: { role } } : {}),
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Google OAuth redirection failed';
      console.error(`[${timestamp}] [signInWithGoogle] Redirect failed:`, errMsg);
      throw error;
    }
  };

  /**
   * Registers a user account with metadata attributes.
   */
  const signUp = async (email: string, password: string, fullName: string, phone: string, role: UserRole): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [signUp] Registering user: ${email}, role: ${role}`);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phone,
            role,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Auth account creation failed');

      console.log(`[${timestamp}] [signUp] Auth user record created. ID: ${authData.user.id}`);

      // Handle fallback manual profiles table insertions
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name: fullName,
          email,
          phone_number: phone,
          role,
        });

      if (profileError) {
        if (profileError.code !== '23505') {
          console.error(`[${timestamp}] [signUp] Profile insertion error:`, profileError.message);
          throw profileError;
        }
        console.log(`[${timestamp}] [signUp] Profile record already existed (trigger handled)`);
      } else {
        console.log(`[${timestamp}] [signUp] Profile record created successfully`);
      }

      // Fetch newly created profile context
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
        if (profileData.role === 'student') {
          await ensureStudentRecord(profileData.id);
        }
      }

      setUser(authData.user);
      
      const redirectMap: Record<UserRole, string> = {
        'hostel_owner': '/owner/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'super_admin': '/admin/dashboard',
      };

      router.push(redirectMap[role]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Registration process failed';
      console.error(`[${timestamp}] [signUp] Error during signup:`, errMsg);
      throw error;
    }
  };

  /**
   * Log in via credentials.
   */
  const signIn = async (email: string, password: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [signIn] Logging in email: ${email}`);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials') || error.status === 400) {
          throw new Error('Invalid login credentials. If you signed up via Google, please try logging in with Google instead.');
        }
        throw error;
      }
      
      setUser(authData.user);

      console.log(`[${timestamp}] [signIn] Credentials accepted. Retrieving profile...`);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile(profileData as Profile);
        
        if (profileData.role === 'student') {
          await ensureStudentRecord(profileData.id);
        }

        const redirectMap: Record<UserRole, string> = {
          'hostel_owner': '/owner/dashboard',
          'student': '/student/dashboard',
          'parent': '/parent/dashboard',
          'super_admin': '/admin/dashboard',
        };

        const path = redirectMap[profileData.role as UserRole];
        console.log(`[${timestamp}] [signIn] Redirecting to: ${path}`);
        router.push(path);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Login failed';
      console.error(`[${timestamp}] [signIn] Error during signin:`, errMsg);
      throw error;
    }
  };

  /**
   * Sets or updates a password for the currently authenticated user session.
   * Useful to add email/password access to Google OAuth accounts.
   * 
   * @param password The new password to set.
   */
  const setPassword = async (password: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [setPassword] Initiating password update...`);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { password_set: true }
      });
      if (error) throw error;
      console.log(`[${timestamp}] [setPassword] Password updated successfully with metadata`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Password update failed';
      console.error(`[${timestamp}] [setPassword] Error during password update:`, errMsg);
      throw error;
    }
  };

  /**
   * Request password reset link for the given email.
   * 
   * @param email The account email.
   */
  const forgotPassword = async (email: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [forgotPassword] Sending reset email to: ${email}`);
    try {
      // Using window.location.origin to point the recovery redirect dynamically
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset-password`
        : 'http://localhost:8080/auth/reset-password';
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      console.log(`[${timestamp}] [forgotPassword] Reset email sent successfully`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to send reset email';
      console.error(`[${timestamp}] [forgotPassword] Error:`, errMsg);
      throw error;
    }
  };

  /**
   * Resets the password for the current recovery session.
   * 
   * @param password The new password.
   */
  const resetPassword = async (password: string): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [resetPassword] Initiating password reset...`);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { password_set: true }
      });
      if (error) throw error;
      console.log(`[${timestamp}] [resetPassword] Password reset successfully`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Password reset failed';
      console.error(`[${timestamp}] [resetPassword] Error:`, errMsg);
      throw error;
    }
  };

  /**
   * Updates the role profile of the currently logged-in user.
   * Clears old permission roles in user_roles and updates user profiles role.
   * 
   * @param role The target UserRole selection.
   */
  const updateUserRole = async (role: UserRole): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [updateUserRole] Initiating role update to: ${role}`);
    try {
      if (!user) throw new Error('No authenticated user session found');

      // 1. Update profiles table role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // 2. Fetch fresh profile state to sync provider React state immediately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);
        
        // 3. Automatically provision student record if role is student
        if (role === 'student') {
          await ensureStudentRecord(profileData.id);
        }
      }
      
      console.log(`[${timestamp}] [updateUserRole] Role update successfully synced`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Role sync failed';
      console.error(`[${timestamp}] [updateUserRole] Exception:`, errMsg);
      throw error;
    }
  };

  /**
   * Signs the user out.
   */
  const handleActualSignOut = async (): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [signOut] Processing logout`);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      ensuredProfilesRef.current.clear();
      
      console.log(`[${timestamp}] [signOut] Logout complete. Redirecting to home.`);
      router.push('/');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Signout failed';
      console.error(`[${timestamp}] [signOut] Error during signout:`, errMsg);
      throw error;
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
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        setPassword,
        forgotPassword,
        resetPassword,
        updateUserRole,
        isAuthenticated: !!user,
      }}
    >
      {children}

      {/* Global Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleActualSignOut}>
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
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
