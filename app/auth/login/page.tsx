'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { AuthMessage } from '@/components/auth-message';
import { AccountAlreadyExistsDialog } from '@/components/account-already-exists-dialog';
import {
  AuthShell,
  AuthCard,
  AuthTabs,
  LoginForm,
  SignupFlow,
  AuthTabType,
  RoleType,
  SignupFormData,
} from '@/components/auth';

type CompletionNext = 'profile' | 'role' | 'password' | 'student_onboarding' | 'complete';
type OAuthIntent = 'login' | 'signup';

const GENERIC_SIGNUP_ERROR = 'Signup could not be completed. Please try again or sign in.';
const GENERIC_CODE_ERROR = 'The code is invalid, expired, or cannot be used.';
const onboardingDestinationForStep: Record<Exclude<CompletionNext, 'complete'>, string> = {
  profile: '/auth/select-role',
  role: '/auth/select-role',
  password: '/auth/setup-password',
  student_onboarding: '/auth/setup-password',
};

function AuthContent() {
  const { isAuthenticated, profile, refreshAuthState, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Tab & Step state
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState<AuthTabType>(initialTab);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);

  // Signup form inputs
  const [signupFormData, setSignupFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Verification & errors
  const [otpError, setOtpError] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Messages & Dialogs
  const [authMessage, setAuthMessage] = useState<{
    variant: 'error' | 'success';
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const [accountExistsDialog, setAccountExistsDialog] = useState<{
    open: boolean;
    type: 'email' | 'google';
  }>({ open: false, type: 'email' });

  const verifyInFlightRef = useRef(false);
  const googleRedirectInFlightRef = useRef(false);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Window pageshow event to reset google loading if user navigates back
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && googleRedirectInFlightRef.current) {
        googleRedirectInFlightRef.current = false;
        setGoogleLoading(false);
        setLoading(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: AuthTabType) => {
    setAuthMessage(null);
    setActiveTab(value);
    router.replace(`/auth/login?tab=${value}`);
  };

  const handleAccountExistsSignIn = () => {
    setActiveTab('login');
    router.replace('/auth/login?tab=login');
  };

  // Auth routing based on user profile state
  useEffect(() => {
    if (!isAuthenticated || !profile) return;

    if (password_set === false) {
      console.log('[LoginPage] Detected incomplete account (password_set=false), staying on login');
      return;
    }

    if (accountCompletionStep === 'role') {
      router.push('/auth/select-role');
      return;
    }

    if (accountCompletionStep === 'password' || accountCompletionStep === 'student_onboarding') {
      router.push('/auth/setup-password');
      return;
    }

    if (accountCompletionStep === 'complete') {
      router.push(dashboardPathForRole(profile.role) || '/auth/select-role');
    }
  }, [isAuthenticated, profile, accountCompletionStep, router]);

  // URL searchParams handling
  useEffect(() => {
    const error = searchParams.get('error');
    const reason = searchParams.get('reason');
    const existingAccount = searchParams.get('existing_account');

    if (existingAccount === 'google') {
      setAccountExistsDialog({ open: true, type: 'google' });
      router.replace('/auth/login?tab=signup');
      return;
    }

    if (reason === 'no-account') {
      setAuthMessage({
        variant: 'error',
        title: 'Account not found',
        description: 'No HostelHub account exists with this Google email. Please create an account first.',
        action: {
          label: 'Create account',
          onClick: () => {
            setAuthMessage(null);
            setActiveTab('signup');
            router.replace('/auth/login?tab=signup');
          },
        },
      });
      return;
    }

    if (reason === 'signin') {
      setAccountExistsDialog({ open: true, type: 'google' });
      router.replace('/auth/login?tab=signup');
      return;
    }

    if (error || reason) {
      setAuthMessage({
        variant: 'error',
        title: 'Sign-in issue',
        description: 'Unable to complete that sign-in request. Please sign in to continue.',
      });
      router.replace('/auth/login');
    }
  }, [searchParams, router]);

  // Handle Login submission
  const handleLoginSubmit = async (email: string, pass: string, _rememberMe: boolean) => {
    setAuthMessage(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error || !data.user) {
        throw error ?? new Error('Login failed');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (profileError) {
        throw profileError;
      }

      await refreshAuthState();
      router.push(profileData?.role ? dashboardPathForRole(profileData.role) || '/auth/select-role' : '/auth/select-role');
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Initiator
  const handleGoogleAuth = async (intent: OAuthIntent) => {
    setAuthMessage(null);
    setGoogleLoading(true);
    try {
      const response = await fetch('/api/auth/oauth-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const redirectTo = payload && typeof payload === 'object' && 'redirectTo' in payload && typeof payload.redirectTo === 'string'
        ? payload.redirectTo
        : null;

      if (!response.ok || !redirectTo) {
        throw new Error('OAuth intent unavailable');
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error || !data.url) {
        throw error ?? new Error('OAuth redirect unavailable');
      }

      googleRedirectInFlightRef.current = true;
      window.location.assign(data.url);
    } catch {
      toast.error('Google sign-in could not be started. Please try again.');
      setGoogleLoading(false);
    }
  };

  // Request OTP for Signup
  const requestVerificationCode = async () => {
    const response = await fetch('/api/auth/signup/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: signupFormData.email }),
    });

    if (response.status === 409) {
      setAccountExistsDialog({ open: true, type: 'email' });
      return false;
    }

    if (!response.ok) {
      toast.error('Unable to request a verification code. Please try again.');
      return false;
    }

    toast.success('Verification code sent', {
      description: `We've sent a 6-digit code to ${signupFormData.email}. Check your inbox or spam folder.`,
    });
    return true;
  };

  const handleRequestCode = async (): Promise<boolean> => {
    setAuthMessage(null);
    if (!selectedRole) {
      toast.error('Please choose your role to continue.');
      return false;
    }
    if (signupFormData.password !== signupFormData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    setLoading(true);
    try {
      const ok = await requestVerificationCode();
      if (!ok) return false;

      setOtpError(false);
      setResendCountdown(60);
      return true;
    } catch {
      toast.error('Unable to request a verification code. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    try {
      const ok = await requestVerificationCode();
      if (!ok) return;

      setOtpError(false);
      setResendCountdown(60);
    } catch {
      toast.error('Unable to request a verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Complete Signup call
  const completeSignup = async () => {
    try {
      const response = await fetch('/api/auth/signup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupFormData.fullName,
          phone: signupFormData.phone,
          password: signupFormData.password,
          role: selectedRole,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const next = payload && typeof payload === 'object' && 'next' in payload && typeof payload.next === 'string'
        ? (payload.next as CompletionNext)
        : null;

      if (!response.ok || !next || !['profile', 'role', 'password', 'student_onboarding', 'complete'].includes(next)) {
        setCompletionError(true);
        toast.error(GENERIC_SIGNUP_ERROR);
        return;
      }

      if (next === 'complete') {
        setSignupFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
        setSelectedRole(null);
        setSignupStep(1);
        toast.success('Your account is ready! Please sign in to continue.');
        handleTabChange('login');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupFormData.email,
        password: signupFormData.password,
      });

      if (signInError) {
        setCompletionError(true);
        toast.error(GENERIC_SIGNUP_ERROR);
        return;
      }

      await refreshAuthState();
      router.push(onboardingDestinationForStep[next]);
    } catch {
      setCompletionError(true);
      toast.error(GENERIC_SIGNUP_ERROR);
    }
  };

  // Verify OTP submission
  const submitVerificationCode = async (code: string) => {
    if (loading || verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    setLoading(true);
    setCompletionError(false);
    try {
      const response = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupFormData.email, otp: code }),
      });

      if (!response.ok) {
        setOtpError(true);
        toast.error(GENERIC_CODE_ERROR, {
          description: 'Please check the code and try again, or request a new one.',
        });
        return;
      }

      setOtpError(false);
      if (!selectedRole) {
        toast.error(GENERIC_SIGNUP_ERROR);
        return;
      }

      await completeSignup();
    } catch {
      setOtpError(true);
      toast.error(GENERIC_CODE_ERROR, {
        description: 'Please check the code and try again, or request a new one.',
      });
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  };

  const retrySignupCompletion = async () => {
    if (loading || verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    setLoading(true);
    try {
      await completeSignup();
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSignupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <AuthShell activeTab={activeTab} onTabChange={handleTabChange}>
      <AuthCard>
        {/* Auth Message Alert (only shown when present) */}
        {authMessage && (
          <div className="mb-4 shrink-0">
            <AuthMessage
              variant={authMessage.variant}
              title={authMessage.title}
              description={authMessage.description}
              action={authMessage.action}
              onDismiss={() => setAuthMessage(null)}
              className="bg-rose-950/60 border-rose-500/40 text-rose-100 [&_p.font-semibold]:text-rose-200 [&_p]:text-rose-300"
            />
          </div>
        )}

        {/* TAB HEADER: Stable tab bar at the top of the card */}
        <div className="shrink-0 pb-1">
          <AuthTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            disabled={loading || googleLoading}
          />
        </div>

        {/* Form Panels: Login vs Sign Up (Zero card movement on switch) */}
        <div className="relative min-h-[460px]">
          {/* Login Panel */}
          <div
            className={`transition-opacity duration-150 ${
              activeTab === 'login'
                ? 'opacity-100'
                : 'invisible opacity-0 pointer-events-none absolute inset-0'
            }`}
          >
            <LoginForm
              onSubmit={handleLoginSubmit}
              onGoogleAuth={() => void handleGoogleAuth('login')}
              onSwitchToSignup={() => handleTabChange('signup')}
              loading={loading}
              googleLoading={googleLoading}
            />
          </div>

          {/* Signup Panel */}
          <div
            className={`transition-opacity duration-150 ${
              activeTab === 'signup'
                ? 'opacity-100'
                : 'invisible opacity-0 pointer-events-none absolute inset-0'
            }`}
          >
            <SignupFlow
              formData={signupFormData}
              onChange={handleSignupInputChange}
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              onRequestCode={handleRequestCode}
              onVerifyCode={submitVerificationCode}
              onResendCode={handleResendCode}
              onRetryCompletion={retrySignupCompletion}
              onGoogleAuth={() => void handleGoogleAuth('signup')}
              onSwitchToLogin={() => handleTabChange('login')}
              loading={loading}
              googleLoading={googleLoading}
              resendLoading={resendLoading}
              resendCountdown={resendCountdown}
              otpError={otpError}
              completionError={completionError}
              step={signupStep}
              setStep={setSignupStep}
            />
          </div>
        </div>
      </AuthCard>

      {/* Account Already Exists Modal */}
      <AccountAlreadyExistsDialog
        open={accountExistsDialog.open}
        onOpenChange={(open) => setAccountExistsDialog((prev) => ({ ...prev, open }))}
        type={accountExistsDialog.type}
        onSignIn={handleAccountExistsSignIn}
      />
    </AuthShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#EFF8FF] flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#0F766E] border-t-transparent" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
