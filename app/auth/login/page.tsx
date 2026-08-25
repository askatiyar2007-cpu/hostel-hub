'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { dashboardPathForRole } from '@/lib/auth/dashboard';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Phone, Building2, GraduationCap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OtpInput } from '@/components/otp-input';
import { AuthMessage } from '@/components/auth-message';
import { AccountAlreadyExistsDialog } from '@/components/account-already-exists-dialog';

type SignupStage = 'request-code' | 'verify-code';
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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AuthContent() {
  const { isAuthenticated, profile, refreshAuthState, accountCompletionStep, password_set } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'owner' | null>(null);
  const [signupStage, setSignupStage] = useState<SignupStage>('request-code');
  const [verificationCode, setVerificationCode] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [completionError, setCompletionError] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpAttempt, setOtpAttempt] = useState(0);
  const [authMessage, setAuthMessage] = useState<{ variant: 'error' | 'success'; title: string; description: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [accountExistsDialog, setAccountExistsDialog] = useState<{ open: boolean; type: 'email' | 'google' }>({ open: false, type: 'email' });
  const verifyInFlightRef = useRef(false);
  const googleRedirectInFlightRef = useRef(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((previous) => previous - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && googleRedirectInFlightRef.current) {
        googleRedirectInFlightRef.current = false;
        setLoading(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
    setActiveTab(tab);
  }, [searchParams]);

  const handleAccountExistsSignIn = () => {
    setActiveTab('login');
    router.replace('/auth/login?tab=login');
  };

  const handleTabChange = (value: string) => {
    setAuthMessage(null);
    setActiveTab(value as 'login' | 'signup');
    router.replace(`/auth/login?tab=${value}`);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile) return;

    // CRITICAL: password_set=false means NOT a HostelHub user.
    // An abandoned signup must NOT be automatically restored to onboarding pages.
    // Sign out and remain on login page to allow explicit "Create Account" restart.
    if (password_set === false) {
      console.log('[LoginPage] Detected incomplete account (password_set=false), staying on login');
      // Don't redirect anywhere - user is already on login page
      // They can explicitly choose "Create Account" to restart
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

  useEffect(() => {
    const error = searchParams.get('error');
    const reason = searchParams.get('reason');
    const existingAccount = searchParams.get('existing_account');

    if (existingAccount === 'google') {
      setAccountExistsDialog({ open: true, type: 'google' });
      // Clear the URL parameter to prevent showing the dialog again on refresh
      // Keep the user on the signup tab
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
      // Removed: router.replace(`/auth/login?tab=${activeTab}`)
      // Tab remains unchanged until user explicitly clicks "Create account"
      return;
    }

    if (reason === 'signin') {
      setAccountExistsDialog({ open: true, type: 'google' });
      // Clear the URL parameter to prevent showing the dialog again on refresh
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
  }, [searchParams, router]);  // Removed activeTab dependency

  const [loginFormData, setLoginFormData] = useState({ email: '', password: '' });
  // This draft deliberately exists only in React component memory. It is never
  // written to storage, URL parameters, cookies, or the OTP request body.
  const [signupFormData, setSignupFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleLoginChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLoginFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSignupChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSignupFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthMessage(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginFormData.email,
        password: loginFormData.password,
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

  const requestVerificationCode = async () => {
    const response = await fetch('/api/auth/signup/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: signupFormData.email }),
    });

    // CRITICAL: Check for completed account (409 Conflict)
    // password_set=true means this is an EXISTING HostelHub user, not an incomplete signup.
    // Do NOT send OTP to completed users. Show "Account already exists" instead.
    // This matches the Google OAuth "Create Account" behavior.
    if (response.status === 409) {
      setAccountExistsDialog({ open: true, type: 'email' });
      return false;
    }

    if (!response.ok) {
      toast.error('Unable to request a verification code. Please try again.');
      return false;
    }

    toast.success('Verification code sent', {
      description: `We've sent a 6-digit code to ${signupFormData.email}. Check your inbox, and your spam folder if you don't see it.`,
    });
    return true;
  };

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthMessage(null);

    if (!selectedRole) {
      toast.error('Please choose your role to continue.');
      return;
    }
    if (signupFormData.password !== signupFormData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const ok = await requestVerificationCode();
      if (!ok) return;

      setVerificationCode('');
      setOtpError(false);
      setSignupStage('verify-code');
      setResendCountdown(60);
    } catch {
      toast.error('Unable to request a verification code. Please try again.');
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

      setVerificationCode('');
      setOtpError(false);
      setOtpAttempt((previous) => previous + 1);
      setResendCountdown(60);
    } catch {
      toast.error('Unable to request a verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

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
        ? payload.next as CompletionNext
        : null;

      if (!response.ok || !next || !['profile', 'role', 'password', 'student_onboarding', 'complete'].includes(next)) {
        setCompletionError(true);
        toast.error(GENERIC_SIGNUP_ERROR);
        return;
      }

      if (next === 'complete') {
        setSignupFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
        setSelectedRole(null);
        setVerificationCode('');
        setSignupStage('request-code');
        toast.success('Your account is ready. Please sign in to continue.');
        router.replace('/auth/login?tab=login');
        return;
      }

      // The account/password mutation above happened through the service-role
      // admin API, which never sets a browser session cookie. Sign in now with
      // the same credentials so the next page's session guard (select-role,
      // setup-password) sees an authenticated user instead of Access Denied.
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

  const handleGoogleAuth = async (intent: OAuthIntent) => {
    setAuthMessage(null);
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-2xl font-semibold tracking-tight font-display text-foreground">HostelHub</span>
          </Link>
        </div>

        <div className="mt-8 bg-card border border-border p-8 rounded-3xl shadow-sm space-y-6">
          {authMessage && (
            <AuthMessage
              variant={authMessage.variant}
              title={authMessage.title}
              description={authMessage.description}
              action={authMessage.action}
              onDismiss={() => setAuthMessage(null)}
            />
          )}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/60 rounded-xl mb-6">
              <TabsTrigger value="login" className="rounded-lg h-9 font-medium transition-all">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg h-9 font-medium transition-all">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight font-display text-foreground">Welcome to HostelHub</h2>
                <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your accommodation</p>
              </div>

              <Button variant="outline" className="w-full h-11 rounded-full border-border/60 hover:bg-muted/50 font-semibold shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-foreground" onClick={() => void handleGoogleAuth('login')} disabled={loading}>
                <GoogleIcon />
                {loading ? 'Connecting to Google...' : 'Continue with Google'}
              </Button>

              <div className="relative flex items-center justify-center my-4">
                <span className="absolute w-full border-t border-border" />
                <span className="relative bg-card px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Or continue with email</span>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-email" name="email" type="email" placeholder="name@example.com" required value={loginFormData.email} onChange={handleLoginChange} className="pl-10 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <Link href="/auth/forgot-password" className="text-xs font-semibold text-primary hover:underline underline-offset-4">Forgot Password?</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="login-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required value={loginFormData.password} onChange={handleLoginChange} className="pl-10 pr-10 h-11" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-full shadow-lg mt-2 font-semibold">{loading ? 'Signing in...' : 'Login'}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight font-display text-foreground">Find your place at HostelHub</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {signupStage === 'request-code' && 'Create your HostelHub account to get started.'}
                </p>
              </div>

              {signupStage === 'request-code' && <>
                <Button variant="outline" className="w-full h-11 rounded-full border-border/60 hover:bg-muted/50 font-semibold shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-foreground" onClick={() => void handleGoogleAuth('signup')} disabled={loading}>
                  <GoogleIcon />
                  {loading ? 'Connecting to Google...' : 'Continue with Google'}
                </Button>
                <div className="relative flex items-center justify-center my-4">
                  <span className="absolute w-full border-t border-border" />
                  <span className="relative bg-card px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Or continue with email</span>
                </div>
                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-foreground">Choose your role</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => setSelectedRole('student')} className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden group ${selectedRole === 'student' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <GraduationCap className={`h-5 w-5 ${selectedRole === 'student' ? 'text-primary' : 'text-muted-foreground'}`} />
                          {selectedRole === 'student' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200"><Check className="h-3.5 w-3.5" /></span>}
                        </div>
                        <span className="font-bold text-sm text-foreground">Student</span>
                        <span className="text-[11px] text-muted-foreground leading-normal mt-1 block">Find and manage your accommodation</span>
                      </button>
                      <button type="button" onClick={() => setSelectedRole('owner')} className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden group ${selectedRole === 'owner' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <Building2 className={`h-5 w-5 ${selectedRole === 'owner' ? 'text-primary' : 'text-muted-foreground'}`} />
                          {selectedRole === 'owner' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200"><Check className="h-3.5 w-3.5" /></span>}
                        </div>
                        <span className="font-bold text-sm text-foreground">Hostel Owner</span>
                        <span className="text-[11px] text-muted-foreground leading-normal mt-1 block">Manage your hostel and residents</span>
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border/40"><h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your details</h3></div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullName">Full Name</Label>
                    <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-fullName" name="fullName" placeholder="John Doe" required value={signupFormData.fullName} onChange={handleSignupChange} className="pl-10 h-11" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-email" name="email" type="email" placeholder="name@example.com" required value={signupFormData.email} onChange={handleSignupChange} className="pl-10 h-11" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone Number</Label>
                    <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-phone" name="phone" placeholder="10-digit number" maxLength={10} value={signupFormData.phone} onChange={handleSignupChange} className="pl-10 h-11" /></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-password" name="password" type={showSignupPassword ? 'text' : 'password'} placeholder="Minimum 6 characters" required minLength={6} value={signupFormData.password} onChange={handleSignupChange} className="pl-10 pr-10 h-11" /><button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirmPassword">Confirm Password</Label>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="signup-confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password" required minLength={6} value={signupFormData.confirmPassword} onChange={handleSignupChange} className="pl-10 pr-10 h-11" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11 rounded-full shadow-lg mt-4 font-semibold">{loading ? 'Sending code...' : 'Send verification code'}</Button>
                </form>
              </>}

              {signupStage === 'verify-code' && <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Verify your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a 6-digit verification code to
                    <br />
                    <span className="font-semibold text-foreground">{signupFormData.email}</span>
                  </p>
                </div>

                <div className="flex justify-center">
                  <OtpInput
                    key={otpAttempt}
                    id="signup-verification-code"
                    length={6}
                    value={verificationCode}
                    onChange={(value) => {
                      setVerificationCode(value);
                      setOtpError(false);
                      setCompletionError(false);
                    }}
                    disabled={loading}
                    error={otpError}
                    autoFocus
                  />
                </div>

                <Button
                  type="button"
                  disabled={loading || verificationCode.length !== 6}
                  onClick={() => void submitVerificationCode(verificationCode)}
                  className="w-full h-11 rounded-full shadow-lg font-semibold"
                >
                  {loading ? 'Verifying code...' : 'Verify code'}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Didn&apos;t receive it?{' '}
                  <button
                    type="button"
                    disabled={resendLoading || resendCountdown > 0}
                    onClick={() => void handleResendCode()}
                    className="font-semibold text-primary hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                  >
                    {resendLoading ? 'Sending...' : resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
                  </button>
                </div>

                <Button type="button" variant="ghost" disabled={loading} onClick={() => setSignupStage('request-code')} className="w-full text-sm">Change details</Button>

                {completionError && (
                  <Button type="button" variant="ghost" disabled={loading} onClick={() => void retrySignupCompletion()} className="w-full text-sm text-primary">Try again</Button>
                )}
              </div>}
            </TabsContent>
          </Tabs>
        </div>

        <AccountAlreadyExistsDialog
          open={accountExistsDialog.open}
          onOpenChange={(open) => setAccountExistsDialog({ ...accountExistsDialog, open })}
          type={accountExistsDialog.type}
          onSignIn={handleAccountExistsSignIn}
        />
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/30 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <AuthContent />
    </Suspense>
  );
}
