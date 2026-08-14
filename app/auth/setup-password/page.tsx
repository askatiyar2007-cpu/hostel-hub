'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SetupPasswordPage() {
  const { setPassword, user, profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Check if password is already set, redirect to dashboard
  useEffect(() => {
    if (user?.user_metadata?.password_set && profile?.role) {
      const redirectMap: Record<string, string> = {
        'owner': '/owner/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'super_admin': '/admin/dashboard',
      };
      const target = redirectMap[profile.role as string];
      if (target) {
        console.log(`[${new Date().toISOString()}] [SetupPasswordPage] Password already set, redirecting to: ${target}`);
        router.push(target);
      }
    }
  }, [user, profile, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.password) {
      toast.error('Password cannot be empty');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SetupPasswordPage] Initiating password setup...`);

    try {
      // Wait for password setting to complete on Supabase
      await setPassword(formData.password);

      console.log(`[${timestamp}] [SetupPasswordPage] Password saved successfully`);
      toast.success('Password set successfully!');
      setSuccess(true);
      setLoading(false);

      // Delay redirect to show success state
      setTimeout(() => {
        if (profile?.role) {
          const redirectMap: Record<string, string> = {
            'owner': '/owner/dashboard',
            'student': '/student/dashboard',
            'parent': '/parent/dashboard',
            'super_admin': '/admin/dashboard',
          };
          const target = redirectMap[profile.role as string];
          if (target) {
            console.log(`[${timestamp}] [SetupPasswordPage] Redirecting to: ${target}`);
            router.push(target);
          } else {
            console.error(`[${timestamp}] [SetupPasswordPage] Invalid role: ${profile.role}`);
            router.push('/auth/select-role');
          }
        } else {
          console.warn(`[${timestamp}] [SetupPasswordPage] No profile found, redirecting to role selection`);
          router.push('/auth/select-role');
        }
      }, 2000);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to set password';
      toast.error(errMsg);
      console.error(`[${timestamp}] [SetupPasswordPage] Error setting password:`, error);
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center bg-card border border-border p-8 rounded-3xl shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Please log in first to complete your account setup.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full h-11 rounded-full mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-2xl font-semibold tracking-tight font-display text-foreground">HostelHub</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Complete Your Account Setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a password to secure your account for future logins
          </p>
        </div>

        <div className="mt-8 bg-card border border-border p-8 rounded-3xl shadow-sm">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Password Saved!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to role selection...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-11"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 pr-10 h-11"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full shadow-lg"
              >
                {loading ? 'Saving password...' : 'Complete Setup'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
