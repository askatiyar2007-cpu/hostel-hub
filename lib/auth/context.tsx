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
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: UserRole
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (isSignup?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setPassword: (password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  updateUserRole: (role: UserRole) => Promise<void>;
  isAuthenticated: boolean;
  existingGoogleSignupRejected: boolean;
  resetRejectionState: () => void;
  rejectedGoogleSignupRef: React.MutableRefObject<boolean>;
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

  const [existingGoogleSignupRejected, setExistingGoogleSignupRejected] = useState(false);

  const resetRejectionState = () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AuthProvider resetRejectionState] Clearing signup rejection states`);
    setExistingGoogleSignupRejected(false);
    rejectedGoogleSignupRef.current = false;
    rejectionInProgressRef.current = false;
  };

  // Memory lock to prevent concurrent student record checks/insert requests
  const ensuredProfilesRef = useRef<Set<string>>(new Set());

  // Guard to prevent SIGNED_IN handler from executing after signup rejection
  const rejectedGoogleSignupRef = useRef(false);

  // Guard to prevent duplicate rejection flows (React Strict Mode)
  const rejectionInProgressRef = useRef(false);

  // Guard to prevent SIGNED_IN handler from redirecting during email signup
  const isEmailSigningUpRef = useRef(false);

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
          .maybeSingle();

        if (profileError) {
          console.error(`[${time}] [AuthProvider] Profile fetch error:`, profileError.message);
          return;
        }

        if (!isMounted) return;

        if (profileData) {
          console.log(`[${time}] [AuthProvider] Profile loaded. Role: ${profileData.role}, Profile ID: ${profileData.id}`);
          
          let isComplete = true;
          if (profileData.role === 'student') {
            const { data: student } = await supabase
              .from('students')
              .select('id')
              .eq('profile_id', profileData.id)
              .maybeSingle();
            if (!student) {
              isComplete = false;
            }
          }

          if (isComplete) {
            setProfile(profileData as Profile);
            if (profileData.role === 'student') {
              console.log(`[${time}] [AuthProvider] Calling ensureStudentRecord for student`);
              await ensureStudentRecord(profileData.id);
            }
          } else {
            console.log(`[${time}] [AuthProvider] Profile role is student but no student record exists - setting role to null in state`);
            setProfile({ ...profileData, role: null } as Profile);
          }
        } else {
          console.log(`[${time}] [AuthProvider] No profile found for user - onboarding required`);
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

          // Check for signup intent during initial session load
          const googleAuthIntent = typeof window !== 'undefined' ? sessionStorage.getItem('googleAuthIntent') : null;
          if (googleAuthIntent === 'signup') {
            console.log(`[${time}] [AuthProvider initializeAuth] Signup intent detected during initial session - checking for existing profile`);

            // Check if rejection is already in progress (React Strict Mode guard)
            if (rejectionInProgressRef.current) {
              console.log(`[${time}] [AuthProvider initializeAuth] Rejection already in progress, skipping duplicate flow`);
              return;
            }

            const { data: profileData } = await supabase
              .from('profiles')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (profileData) {
              console.log(`[${time}] [AuthProvider initializeAuth] Existing profile found during signup initialization - rejecting`);

              // Mark rejection as in progress BEFORE any other operations
              rejectionInProgressRef.current = true;
              rejectedGoogleSignupRef.current = true;

              console.log(`[${time}] [AuthProvider initializeAuth] Rejection guard enabled BEFORE signOut`);

              sessionStorage.removeItem('googleAuthIntent');

              console.log(`[${time}] [AuthProvider initializeAuth] Signing out rejected signup session`);
              const { error: signOutError } = await supabase.auth.signOut();

              if (signOutError) {
                console.error(`[${time}] [AuthProvider initializeAuth] Failed to sign out rejected signup session:`, signOutError);
              } else {
                console.log(`[${time}] [AuthProvider initializeAuth] Rejected signup session signed out successfully`);
              }

              if (isMounted) {
                setUser(null);
                setProfile(null);
                setExistingGoogleSignupRejected(true);
                setLoading(false);
              }

              console.log(`[${time}] [AuthProvider initializeAuth] Existing Google signup rejected - notifying login UI`);
              return;
            }
          }

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
        // Synchronous check for rejection guard
        if (rejectedGoogleSignupRef.current) {
          console.log(`[${time}] [AuthProvider onAuthStateChange] Ignoring SIGNED_IN event because Google signup was already rejected`);
          return;
        }

        if (isEmailSigningUpRef.current) {
          console.log(`[${time}] [AuthProvider onAuthStateChange] Ignoring SIGNED_IN event because email signup is in progress`);
          return;
        }

        const googleAuthIntent = typeof window !== 'undefined' ? sessionStorage.getItem('googleAuthIntent') : null;
        if (googleAuthIntent === 'signup') {
          // Check if profile exists and if account is complete before setting user or profile state in React
          const { data: profileData } = await supabase
            .from('profiles')
            .select('role, password_set')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (profileData) {
            // Check if this is a complete account (has password_set = true and appropriate role records)
            let isCompleteAccount = false;
            
            if (profileData.password_set) {
              // Check role-specific records exist
              if (profileData.role === 'student') {
                const { data: student } = await supabase
                  .from('students')
                  .select('id')
                  .eq('profile_id', profileData.id)
                  .maybeSingle();
                isCompleteAccount = !!student;
              } else if (profileData.role && profileData.role !== 'student') {
                // For owner/admin, having a role and password_set is sufficient
                isCompleteAccount = true;
              }
            }

            if (isCompleteAccount) {
              // This is an existing complete account - treat as login, not signup
              if (rejectionInProgressRef.current) {
                console.log(`[${time}] [AuthProvider onAuthStateChange] Rejection already in progress, skipping duplicate flow`);
                return;
              }

              console.log(`[${time}] [AuthProvider onAuthStateChange] Google login with existing complete account detected - treating as login`);
              rejectionInProgressRef.current = true;
              rejectedGoogleSignupRef.current = true;

              sessionStorage.removeItem('googleAuthIntent');

              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) {
                console.error(`[${time}] [AuthProvider onAuthStateChange] Failed to sign out rejected signup session:`, signOutError);
              } else {
                console.log(`[${time}] [AuthProvider onAuthStateChange] Rejected signup session signed out successfully`);
              }

              if (isMounted) {
                setUser(null);
                setProfile(null);
                setExistingGoogleSignupRejected(true);
              }
              return;
            }
            // If profile exists but account is incomplete, continue with signup flow
            console.log(`[${time}] [AuthProvider onAuthStateChange] Profile exists but account incomplete - continuing with signup`);
          }
        }

        if (isMounted) {
          setUser(session.user);
        }

        await handleProfileAndStudent(session.user);

        // Manual log in / sign up redirect triggers
        if (event === 'SIGNED_IN' && isMounted) {
          // Check if this SIGNED_IN should be ignored due to prior signup rejection
          if (rejectedGoogleSignupRef.current) {
            console.log(`[${time}] [AuthProvider onAuthStateChange] Ignoring SIGNED_IN because Google signup was already rejected`);
            return;
          }

          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          console.log(`[${time}] [AuthProvider onAuthStateChange] SIGNED_IN event fired. Current path: ${currentPath}`);

          if (googleAuthIntent === 'signup') {
            console.log(`[${time}] [AuthProvider onAuthStateChange] Google signup intent detected`);
          }
          if (googleAuthIntent === 'login') {
            console.log(`[${time}] [AuthProvider onAuthStateChange] Google login intent detected`);
          }

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
            '/invite',                    // ← Invitation pages - stay here
          ];

          // Only redirect if on public pages
          const isPublicPage = !noRedirectPaths.some(path => currentPath.startsWith(path));

          if (isPublicPage) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            // Clear intent after rejection check
            if (googleAuthIntent) {
              sessionStorage.removeItem('googleAuthIntent');
            }

            // Reset rejection guard on successful login (not rejected signup)
            if (googleAuthIntent === 'login' || !googleAuthIntent) {
              rejectedGoogleSignupRef.current = false;
              rejectionInProgressRef.current = false;
            }

            if (profileData) {
              let hasRole = false;
              if (profileData.role === 'student') {
                const { data: student } = await supabase
                  .from('students')
                  .select('id')
                  .eq('profile_id', profileData.id)
                  .maybeSingle();
                if (student) {
                  hasRole = true;
                }
              } else if (profileData.role && profileData.role !== 'student') {
                hasRole = true;
              }

              if (hasRole) {
                const redirectMap: Record<string, string> = {
                  owner: '/owner/dashboard',
                  student: '/student/dashboard',
                  parent: '/parent/dashboard',
                  super_admin: '/admin/dashboard',
                };
                const target = redirectMap[profileData.role as string];
                if (!target) {
                  console.error(`[${time}] [AuthProvider onAuthStateChange] Invalid role: ${profileData.role}. Redirecting to role selection.`);
                  router.push('/auth/select-role');
                  return;
                }
                console.log(`[${time}] [AuthProvider onAuthStateChange] Redirecting logged in user to: ${target}`);
                router.push(target);
              } else {
                console.log(`[${time}] [AuthProvider onAuthStateChange] Role is student but student record does not exist - redirecting to /auth/select-role`);
                router.push('/auth/select-role');
              }
            } else {
              console.log(`[${time}] [AuthProvider onAuthStateChange] No profile found - redirecting to role selection`);
              router.push('/auth/select-role');
            }
          } else {
            console.log(`[${time}] [AuthProvider onAuthStateChange] SKIPPING auto-redirect - preserved location: ${currentPath}`);
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
      // Reset rejection guards on unmount (for React Strict Mode remount)
      rejectedGoogleSignupRef.current = false;
      rejectionInProgressRef.current = false;
    };
  }, [router]);

  /**
   * Triggers redirection to Google OAuth endpoint.
   *
   * @param isSignup Whether this is initiated from signup flow (true) or login flow (false)
   */
  const signInWithGoogle = async (isSignup: boolean = false): Promise<void> => {
    const timestamp = new Date().toISOString();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Button clicked`);
    console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Current pathname: ${currentPath}`);
    try {
      // Store signup intent in session storage for client-side AuthProvider
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('googleAuthIntent', isSignup ? 'signup' : 'login');
        console.log(`[${timestamp}] [GOOGLE AUTH] Stored intent: ${isSignup ? 'signup' : 'login'}`);
      }

      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?isSignup=${isSignup}`
        : `http://localhost:3000/auth/callback?isSignup=${isSignup}`;

      console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] redirectTo: ${redirectTo}`);
      console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] OAuth request starting`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] OAuth request returned`);
      console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Data:`, data);
      console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Error:`, error);

      if (error) throw error;

      // If Supabase returns a URL, explicitly navigate to it
      if (data?.url && typeof window !== 'undefined') {
        console.log(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Navigating to OAuth URL: ${data.url}`);
        window.location.assign(data.url);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Google OAuth redirection failed';
      console.error(`[${timestamp}] [GOOGLE ${isSignup ? 'SIGNUP' : 'LOGIN'}] Redirect failed:`, errMsg);
      throw error;
    }
  };

  /**
   * Registers a user account with metadata attributes.
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: UserRole
  ): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [signUp] Registering user: ${email} with role: ${role}`);
    isEmailSigningUpRef.current = true;
    try {
      // Check if email already exists in profiles table with a complete account
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role, password_set')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        // Check if this is a complete account
        let isCompleteAccount = false;
        
        if (existingProfile.password_set) {
          if (existingProfile.role === 'student') {
            const { data: student } = await supabase
              .from('students')
              .select('id')
              .eq('profile_id', existingProfile.id)
              .maybeSingle();
            isCompleteAccount = !!student;
          } else if (existingProfile.role && existingProfile.role !== 'student') {
            isCompleteAccount = true;
          }
        }

        if (isCompleteAccount) {
          console.log(`[${timestamp}] [signUp] Complete account already exists with email: ${email}`);
          throw new Error('Account already exists. Please login instead.');
        }
        
        // If profile exists but account is incomplete, continue to complete the signup
        console.log(`[${timestamp}] [signUp] Incomplete profile exists for email: ${email} - completing signup`);
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phone,
            password_set: true,
            role_selected: true,
          }
        }
      });

      if (signUpError) {
        // Handle case where Supabase auth already has this email
        if (signUpError.message.includes('already registered') || signUpError.status === 400) {
          console.log(`[${timestamp}] [signUp] Email already registered in Supabase auth: ${email}`);
          
          // Check if this might be a Google account
          throw new Error('This email is already registered. If you signed up with Google, please use Google login instead.');
        }
        throw signUpError;
      }

      if (!authData.user) throw new Error('Auth account creation failed');

      console.log(`[${timestamp}] [signUp] Auth user record created. ID: ${authData.user.id}`);

      // Create profile in profiles table with explicit role (idempotent)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: authData.user.id,
          full_name: fullName,
          email,
          phone_number: phone,
          role,
          password_set: true,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error(`[${timestamp}] [signUp] Profile upsert error:`, profileError.message);
        throw profileError;
      }
      console.log(`[${timestamp}] [signUp] Profile record created/updated successfully`);

      // Fetch profile context
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

      if (profileData) {
        if (role === 'student') {
          console.log(`[${timestamp}] [signUp] Provisioning student record for Profile ID: ${profileData.id}`);
          await ensureStudentRecord(profileData.id);
        }
        setProfile(profileData as Profile);
      }

      setUser(authData.user);

      const redirectMap: Record<string, string> = {
        'owner': '/owner/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'super_admin': '/admin/dashboard',
      };
      const redirectPath = redirectMap[role];
      if (redirectPath) {
        console.log(`[${timestamp}] [signUp] Redirecting to: ${redirectPath}`);
        router.push(redirectPath);
      } else {
        console.log(`[${timestamp}] [signUp] Redirecting to role selection: /auth/select-role`);
        router.push('/auth/select-role');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Registration process failed';
      console.error(`[${timestamp}] [signUp] Error during signup:`, errMsg);
      throw error;
    } finally {
      isEmailSigningUpRef.current = false;
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
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile(profileData as Profile);
        
        if (profileData.role === 'student') {
          await ensureStudentRecord(profileData.id);
        }

        const redirectMap: Record<string, string> = {
          'owner': '/owner/dashboard',
          'student': '/student/dashboard',
          'parent': '/parent/dashboard',
          'super_admin': '/admin/dashboard',
        };

        const path = redirectMap[profileData.role as string];
        if (!path) {
          console.error(`[${timestamp}] [signIn] Invalid role: ${profileData.role}. Redirecting to role selection.`);
          router.push('/auth/select-role');
          return;
        }
        console.log(`[${timestamp}] [signIn] Redirecting to: ${path}`);
        router.push(path);
      } else {
        console.error(`[${timestamp}] [signIn] No profile found for user - redirecting to role selection`);
        router.push('/auth/select-role');
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
      if (!user) throw new Error('No authenticated user session found');
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { password_set: true }
      });
      if (error) throw error;

      // Update public.profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ password_set: true })
        .eq('user_id', user.id);

      if (profileError) {
        console.error(`[${timestamp}] [setPassword] Profile update error:`, profileError.message);
      }

      console.log(`[${timestamp}] [setPassword] Password updated successfully with metadata and profile`);
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
      if (!user) throw new Error('No authenticated user session found');
      const { error } = await supabase.auth.updateUser({ 
        password,
        data: { password_set: true }
      });
      if (error) throw error;

      // Update public.profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ password_set: true })
        .eq('user_id', user.id);

      if (profileError) {
        console.error(`[${timestamp}] [resetPassword] Profile update error:`, profileError.message);
      }

      console.log(`[${timestamp}] [resetPassword] Password reset successfully`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Password reset failed';
      console.error(`[${timestamp}] [resetPassword] Error:`, errMsg);
      throw error;
    }
  };

  /**
   * Updates the role profile of the currently logged-in user.
   * Creates profile if it doesn't exist, then updates the role.
   *
   * @param role The target UserRole selection.
   */
  const updateUserRole = async (role: UserRole): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [updateUserRole] Initiating role update to: ${role}`);
    try {
      if (!user) throw new Error('No authenticated user session found');

      // 1. Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingProfile) {
        console.log(`[${timestamp}] [updateUserRole] Profile exists, updating role`);
        // Update existing profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('user_id', user.id);

        if (profileError) throw profileError;
      } else {
        console.log(`[${timestamp}] [updateUserRole] No profile found, creating new profile`);
        // Create new profile for Google user
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData.user;

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || '',
            email: currentUser?.email || '',
            phone_number: currentUser?.user_metadata?.phone_number || '',
            role,
          });

        if (profileError) throw profileError;
      }

      // 2. Fetch fresh profile state to sync provider React state immediately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);

        // 3. Automatically provision student record if role is student
        if (role === 'student') {
          await ensureStudentRecord(profileData.id);
        }
      } else {
        console.warn(`[${timestamp}] [updateUserRole] Profile not found after update - unexpected state`);
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
        existingGoogleSignupRejected,
        resetRejectionState,
        rejectedGoogleSignupRef,
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
