'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Lock, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Client-side code exchange if redirect contains code parameter
  useEffect(() => {
    const handleCodeExchange = async () => {
      const code = searchParams.get('code');
      if (code) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ResetPassword] Exchanging recovery code for session...`);
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          console.log(`[${timestamp}] [ResetPassword] Recovery code exchange successful`);
        } catch (error) {
          console.error(`[${timestamp}] [ResetPassword] Code exchange error:`, error);
          toast.error('Recovery link is invalid or expired. Please request a new link.');
        }
      }
    };
    handleCodeExchange();
  }, [searchParams]);

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
    console.log(`[${timestamp}] [ResetPassword] Resetting password...`);

    try {
      const { error } = await supabase.auth.updateUser({ password: formData.password });
      if (error) throw error;

      toast.success('Password reset successful! Redirecting to login...');
      console.log(`[${timestamp}] [ResetPassword] Password reset complete`);

      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(errMsg);
      console.error(`[${timestamp}] [ResetPassword] Error resetting password:`, error);
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 bg-[#002b27] rounded-2xl flex items-center justify-center mb-2 ring-1 ring-teal-500/30 text-[#0dbb9c]">
                <Lock className="w-6 h-6 text-[#0dbb9c]" />
              </div>
              <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-white font-display">
                Create New Password
              </h2>
              <p className="text-xs text-teal-100/75">
                Enter your new password to complete the reset
              </p>
            </div>

            <AuthInput
              id="password"
              name="password"
              label="New Password"
              placeholder="At least 6 characters"
              required
              isPassword
              minLength={6}
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              icon={Lock}
              disabled={loading}
            />

            <AuthInput
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Confirm new password"
              required
              isPassword
              minLength={6}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              icon={Lock}
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 px-4 rounded-full bg-gradient-to-r from-[#0dbb9c] to-[#0ab898] hover:from-[#0ec9a8] hover:to-[#0bc7a5] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-[#0bb99a]/35 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0dbb9c] cursor-pointer uppercase"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Resetting password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              disabled={loading}
              className="w-full h-11 px-4 rounded-full border border-teal-700/80 bg-[#002522] hover:bg-[#002f2b] text-teal-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0dbb9c] disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Login</span>
            </button>
          </form>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
