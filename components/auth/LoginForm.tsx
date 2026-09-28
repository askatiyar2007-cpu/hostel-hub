'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Loader2, Check } from 'lucide-react';
import { AuthInput } from './AuthInput';
import { GoogleButton } from './GoogleButton';

interface LoginFormProps {
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  onGoogleAuth: () => void;
  onSwitchToSignup: () => void;
  loading: boolean;
  googleLoading: boolean;
}

export function LoginForm({
  onSubmit,
  onGoogleAuth,
  onSwitchToSignup,
  loading,
  googleLoading,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    await onSubmit(email.trim(), password, rememberMe);
  };

  return (
    <div className="space-y-4 text-left">
      {/* Welcome Heading & Supporting Text */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-white font-display leading-snug flex items-center justify-center gap-1.5">
          <span>Welcome Back</span>
          <span className="inline-block" role="img" aria-label="waving hand">👋</span>
        </h2>
        <p className="text-xs sm:text-[13px] text-teal-100/75 font-normal">
          Sign in to continue to your HostelHub account.
        </p>
      </div>

      {/* Google Sign-in */}
      <div className="pt-1">
        <GoogleButton
          onClick={onGoogleAuth}
          loading={googleLoading}
          disabled={loading}
          text="Continue with Google"
        />
      </div>

      {/* Modern OR Divider */}
      <div className="flex items-center gap-3 my-2" aria-hidden="true">
        <div className="flex-1 border-t border-teal-500/20" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/60 whitespace-nowrap">
          or continue with email
        </span>
        <div className="flex-1 border-t border-teal-500/20" />
      </div>

      {/* Email / Password Form with Comfortable Spacing */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AuthInput
          id="login-email"
          name="email"
          type="email"
          label="Email Address"
          placeholder="name@example.com"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
          }}
          icon={Mail}
          error={formErrors.email}
          disabled={loading || googleLoading}
        />

        <div className="space-y-0">
          <AuthInput
            id="login-password"
            name="password"
            label="Password"
            placeholder="••••••••••••"
            required
            autoComplete="current-password"
            isPassword
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
            }}
            icon={Lock}
            error={formErrors.password}
            disabled={loading || googleLoading}
          />

          {/* 16–20px spacing between password input and remember/forgot row */}
          <div className="flex items-center justify-between pt-4 text-xs sm:text-[13px]">
            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded transition-colors ${
                  rememberMe
                    ? 'bg-[#0D9488] border border-[#0D9488] text-white'
                    : 'border border-teal-400/30 bg-[#032B28] group-hover:border-teal-300'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] cursor-pointer`}
              >
                {rememberMe && <Check className="h-3.5 w-3.5 stroke-[3]" />}
              </button>
              <span className="text-teal-100/80 group-hover:text-white transition-colors font-medium">
                Remember me
              </span>
            </label>

            {/* Forgot Password Link */}
            <Link
              href="/auth/forgot-password"
              className="font-medium text-teal-200/90 hover:text-white hover:underline underline-offset-4 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0D9488] rounded"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Primary Submit Button with arrow slide micro-interaction */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="group w-full h-12 sm:h-[52px] px-5 mt-2 rounded-xl bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] text-white font-bold text-[15px] sm:text-[16px] tracking-wide shadow-md shadow-[#011C1A]/40 hover:shadow-lg hover:shadow-[#011C1A]/50 transition-all duration-200 ease-out flex items-center justify-center gap-2.5 disabled:opacity-65 disabled:pointer-events-none disabled:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07534C] cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="h-4.5 w-4.5 stroke-[2.25] transition-transform duration-200 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Sign Up */}
      <div className="text-center pt-3.5 border-t border-teal-500/20">
        <p className="text-xs sm:text-[13px] text-teal-100/70">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            disabled={loading || googleLoading}
            className="font-bold text-teal-200 hover:text-white hover:underline underline-offset-4 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0D9488] rounded cursor-pointer"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
