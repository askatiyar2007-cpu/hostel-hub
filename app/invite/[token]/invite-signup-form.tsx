'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface InviteSignupFormProps {
  email: string;
  token: string;
}

export default function InviteSignupForm({ email, token }: InviteSignupFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('Password is required');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // 1. Submit signup request to the secure server API route
      const response = await fetch('/api/invite/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sign up');
      }

      toast.success(result.message || 'Account created successfully!');

      // 2. Automatically log the student in using their email and new password
      // This will establish the browser session and set Next.js auth cookies.
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.error('Auto login error:', loginError);
        toast.error('Account created, but automatic login failed. Please log in manually.');
        router.push('/auth/login');
        return;
      }

      // 3. Redirect to the student dashboard
      toast.success('Logging in...');
      router.push('/student/dashboard');

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Email input - Locked / Read Only */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Email Address (Locked)</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Lock size={16} />
          </div>
          <input
            readOnly
            type="email"
            value={email}
            className="w-full pl-9 pr-4 py-2.5 bg-muted border border-input rounded-xl text-sm text-muted-foreground cursor-not-allowed font-semibold outline-none"
          />
        </div>
      </div>

      {/* Password input */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Create Password *</label>
        <div className="relative">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Confirm Password input */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Confirm Password *</label>
        <input
          required
          type={showPassword ? 'text' : 'password'}
          placeholder="Repeat password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm text-foreground"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 bg-primary hover:bg-primary/95 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Creating Account...</span>
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
