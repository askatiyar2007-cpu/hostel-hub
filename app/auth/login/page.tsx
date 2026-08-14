'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User, Phone, Building2, GraduationCap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function AuthContent() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    isAuthenticated,
    profile,
    existingGoogleSignupRejected,
    resetRejectionState,
    rejectedGoogleSignupRef,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'owner' | null>(null);

  // Get initial tab from URL
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);

  // Sync tab parameter changes from URL
  useEffect(() => {
    const tab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    resetRejectionState();
    setActiveTab(value as 'login' | 'signup');
    router.replace(`/auth/login?tab=${value}`);
  };

  useEffect(() => {
    // Check googleAuthIntent synchronously from sessionStorage
    const googleAuthIntent = typeof window !== 'undefined' ? sessionStorage.getItem('googleAuthIntent') : null;
    const isGoogleSigningUp = googleAuthIntent === 'signup';

    if (
      isAuthenticated &&
      profile &&
      !existingGoogleSignupRejected &&
      !rejectedGoogleSignupRef.current &&
      !isGoogleSigningUp
    ) {
      const redirectMap: Record<string, string> = {
        'owner': '/owner/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'super_admin': '/admin/dashboard',
      };
      const redirectPath = redirectMap[profile.role as string];
      if (!redirectPath) {
        console.error(`Invalid role: ${profile.role}. Redirecting to role selection.`);
        router.push('/auth/select-role');
        return;
      }
      router.push(redirectPath);
    }
  }, [isAuthenticated, profile, router, existingGoogleSignupRejected, rejectedGoogleSignupRef]);



  // Handle error from OAuth callback
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(error);
      // Clear error from URL
      router.replace('/auth/login');
    }
  }, [searchParams, router]);

  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: '',
  });

  const [signupFormData, setSignupFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(loginFormData.email, loginFormData.password);
      toast.success('Welcome back!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      await signUp(
        signupFormData.email,
        signupFormData.password,
        signupFormData.fullName,
        signupFormData.phone,
        selectedRole
      );
      toast.success('Account created successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(false); // false = login intent
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google sign-in could not be completed. Please try again.';
      toast.error(msg);
      console.error('Google login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(true); // true = signup intent
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in could not be completed. Please try again.';
      toast.error(errorMessage);
    } finally {
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
          {existingGoogleSignupRejected && (
            <div className="bg-destructive/5 border border-destructive/20 p-5 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <h3 className="font-bold text-destructive text-lg">Account already exists</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Google account is already registered. Sign in to continue.
              </p>
              <Button
                variant="outline"
                className="w-full h-10 rounded-full border-destructive/30 hover:bg-destructive/5 font-semibold text-destructive hover:text-destructive shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center"
                onClick={() => {
                  resetRejectionState();
                  handleTabChange('login');
                }}
              >
                Go to Sign In
              </Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/60 rounded-xl mb-6">
              <TabsTrigger value="login" className="rounded-lg h-9 font-medium transition-all">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg h-9 font-medium transition-all">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight font-display text-foreground">Welcome to HostelHub</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to manage your accommodation
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 rounded-full border-border/60 hover:bg-muted/50 font-semibold shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-foreground"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Connecting to Google...' : 'Continue with Google'}
              </Button>

              <div className="relative flex items-center justify-center my-4">
                <span className="absolute w-full border-t border-border" />
                <span className="relative bg-card px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Or continue with email
                </span>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={loginFormData.email}
                      onChange={handleLoginChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <Link href="/auth/forgot-password" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      value={loginFormData.password}
                      onChange={handleLoginChange}
                      className="pl-10 pr-10 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-full shadow-lg mt-2 font-semibold"
                >
                  {loading ? 'Signing in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight font-display text-foreground">Find your place at HostelHub</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your HostelHub account to get started.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 rounded-full border-border/60 hover:bg-muted/50 font-semibold shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-foreground"
                onClick={handleGoogleSignup}
                disabled={loading}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Connecting to Google...' : 'Continue with Google'}
              </Button>

              <div className="relative flex items-center justify-center my-4">
                <span className="absolute w-full border-t border-border" />
                <span className="relative bg-card px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Or continue with email
                </span>
              </div>

              <form onSubmit={handleSignupSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-foreground">Choose your role</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Student Card */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('student')}
                      className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden group ${
                        selectedRole === 'student'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <GraduationCap className={`h-5 w-5 ${selectedRole === 'student' ? 'text-primary' : 'text-muted-foreground'}`} />
                        {selectedRole === 'student' && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm text-foreground">Student</span>
                      <span className="text-[11px] text-muted-foreground leading-normal mt-1 block">
                        Find and manage your accommodation
                      </span>
                    </button>

                    {/* Hostel Owner Card */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('owner')}
                      className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden group ${
                        selectedRole === 'owner'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Building2 className={`h-5 w-5 ${selectedRole === 'owner' ? 'text-primary' : 'text-muted-foreground'}`} />
                        {selectedRole === 'owner' && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-sm text-foreground">Hostel Owner</span>
                      <span className="text-[11px] text-muted-foreground leading-normal mt-1 block">
                        Manage your hostel and residents
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your details</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-fullName"
                      name="fullName"
                      placeholder="John Doe"
                      required
                      value={signupFormData.fullName}
                      onChange={handleSignupChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={signupFormData.email}
                      onChange={handleSignupChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      name="phone"
                      placeholder="10-digit number"
                      maxLength={10}
                      value={signupFormData.phone}
                      onChange={handleSignupChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      name="password"
                      type={showSignupPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      value={signupFormData.password}
                      onChange={handleSignupChange}
                      className="pl-10 pr-10 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      required
                      minLength={6}
                      value={signupFormData.confirmPassword}
                      onChange={handleSignupChange}
                      className="pl-10 pr-10 h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-full shadow-lg mt-4 font-semibold"
                >
                  {loading ? 'Creating account...' : 'Create my account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/30 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>}>
      <AuthContent />
    </Suspense>
  );
}
