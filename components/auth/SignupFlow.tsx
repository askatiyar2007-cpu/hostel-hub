'use client';

import React, { useState } from 'react';
import { User, Mail, Phone, Lock, ArrowRight, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { AuthInput } from './AuthInput';
import { GoogleButton } from './GoogleButton';
import { RoleSelector, RoleType } from './RoleSelector';
import { StepIndicator } from './StepIndicator';
import { OtpInput } from '@/components/otp-input';

export interface SignupFormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface SignupFlowProps {
  formData: SignupFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedRole: RoleType | null;
  onSelectRole: (role: RoleType) => void;
  onRequestCode: () => Promise<boolean>;
  onVerifyCode: (code: string) => Promise<void>;
  onResendCode: () => Promise<void>;
  onRetryCompletion: () => Promise<void>;
  onGoogleAuth: () => void;
  onSwitchToLogin: () => void;
  loading: boolean;
  googleLoading: boolean;
  resendLoading: boolean;
  resendCountdown: number;
  otpError: boolean;
  completionError: boolean;
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;
}

export function SignupFlow({
  formData,
  onChange,
  selectedRole,
  onSelectRole,
  onRequestCode,
  onVerifyCode,
  onResendCode,
  onRetryCompletion,
  onGoogleAuth,
  onSwitchToLogin,
  loading,
  googleLoading,
  resendLoading,
  resendCountdown,
  otpError,
  completionError,
  step,
  setStep,
}: SignupFlowProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});

  const goToStep = (newStep: 1 | 2 | 3) => {
    setStep(newStep);
  };

  const handleStep1Next = () => {
    if (!selectedRole) return;
    goToStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<keyof SignupFormData, string>> = {};

    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      errors.phone = 'Phone must be a 10-digit number';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Minimum 6 characters required';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const success = await onRequestCode();
    if (success) {
      goToStep(3);
    }
  };

  const handleStep3Verify = async () => {
    if (verificationCode.length !== 6 || loading) return;
    await onVerifyCode(verificationCode);
  };

  return (
    <div className="space-y-3.5 text-left">
      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* STEP 1: Role Selection */}
      {step === 1 && (
        <div key="step-1" className="space-y-3.5">
          <div className="text-center space-y-0.5">
            <h2 className="text-2xl sm:text-[1.6rem] font-bold tracking-tight text-white font-display">
              Choose Your Role
            </h2>
            <p className="text-xs text-teal-100/75">
              Select your profile type to personalize your experience.
            </p>
          </div>

          {/* Role Cards */}
          <RoleSelector
            selectedRole={selectedRole}
            onSelectRole={onSelectRole}
            disabled={loading || googleLoading}
          />

          {/* Continue to Details Button */}
          <button
            type="button"
            disabled={!selectedRole || loading || googleLoading}
            onClick={handleStep1Next}
            className="w-full h-11 px-4 rounded-full bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-teal-950/20 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E4A] cursor-pointer"
          >
            <span>Continue to Details</span>
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </button>

          {/* Google Option */}
          <div className="pt-0.5">
            <div className="flex items-center gap-3 my-2" aria-hidden="true">
              <div className="flex-1 border-t border-teal-500/20" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-200/60 whitespace-nowrap">
                or sign up with Google
              </span>
              <div className="flex-1 border-t border-teal-500/20" />
            </div>
            <GoogleButton
              onClick={onGoogleAuth}
              loading={googleLoading}
              disabled={loading}
              text="Sign up with Google"
            />
          </div>

          {/* Switch to Login */}
          <div className="text-center pt-2.5 border-t border-teal-500/20">
            <p className="text-xs text-teal-100/70">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                disabled={loading || googleLoading}
                className="font-bold text-teal-200 hover:text-white hover:underline underline-offset-4 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0D9488] rounded cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: Account Details */}
      {step === 2 && (
        <form
          key="step-2"
          onSubmit={handleStep2Submit}
          className="space-y-2.5"
          noValidate
        >
          <div className="text-center space-y-0.5">
            <h2 className="text-2xl sm:text-[1.6rem] font-bold tracking-tight text-white font-display">
              Create Account
            </h2>
            <p className="text-xs text-teal-100/75">
              Joining as a{' '}
              <span className="font-bold text-teal-200 capitalize">
                {selectedRole === 'student' ? 'Student' : 'Hostel Owner'}
              </span>
            </p>
          </div>

          <AuthInput
            id="signup-fullName"
            name="fullName"
            label="Full Name"
            placeholder="Aarav Sharma"
            required
            autoComplete="name"
            value={formData.fullName}
            onChange={(e) => {
              onChange(e);
              if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            icon={User}
            error={fieldErrors.fullName}
            disabled={loading}
          />

          <AuthInput
            id="signup-email"
            name="email"
            type="email"
            label="Email Address"
            placeholder="aarav@example.com"
            required
            autoComplete="email"
            value={formData.email}
            onChange={(e) => {
              onChange(e);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            icon={Mail}
            error={fieldErrors.email}
            disabled={loading}
          />

          <AuthInput
            id="signup-phone"
            name="phone"
            type="tel"
            label="Phone Number"
            placeholder="9876543210"
            maxLength={10}
            autoComplete="tel"
            required
            value={formData.phone}
            onChange={(e) => {
              onChange(e);
              if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            icon={Phone}
            error={fieldErrors.phone}
            disabled={loading}
          />

          <AuthInput
            id="signup-password"
            name="password"
            label="Password"
            placeholder="Enter your password"
            required
            isPassword
            minLength={6}
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => {
              onChange(e);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            icon={Lock}
            error={fieldErrors.password}
            disabled={loading}
          />
          {formData.password && formData.password.length < 6 && (
            <p className="text-xs text-teal-200/60 pl-1">Minimum 6 characters</p>
          )}

          <AuthInput
            id="signup-confirmPassword"
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Confirm your password"
            required
            isPassword
            minLength={6}
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(e) => {
              onChange(e);
              if (fieldErrors.confirmPassword)
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            icon={Lock}
            error={fieldErrors.confirmPassword}
            disabled={loading}
          />

          {/* Buttons: Back and Submit */}
          <div className="flex items-center gap-2 pt-1.5">
            <button
              type="button"
              onClick={() => goToStep(1)}
              disabled={loading}
              className="h-11 px-4 rounded-full border border-teal-400/25 bg-[#075A56] hover:bg-[#08625D] text-teal-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 px-4 rounded-full bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-teal-950/20 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E4A] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Sending code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: OTP Verification */}
      {step === 3 && (
        <div key="step-3" className="space-y-3.5">
          <div className="text-center space-y-0.5">
            <h2 className="text-2xl sm:text-[1.6rem] font-bold tracking-tight text-white font-display">
              Verify Your Email
            </h2>
            <p className="text-xs text-teal-100/80 max-w-xs mx-auto">
              We sent a 6-digit verification code to{' '}
              <span className="font-bold text-white break-all">{formData.email}</span>
            </p>
          </div>

          {/* OtpInput Container */}
          <div className="flex justify-center pt-1.5">
            <OtpInput
              id="signup-verification-code"
              length={6}
              value={verificationCode}
              onChange={(val) => setVerificationCode(val)}
              disabled={loading}
              error={otpError}
              autoFocus
              containerClassName="gap-2 sm:gap-2.5"
              className="border-teal-400/25 bg-[#075A56] text-white font-mono text-xl sm:text-2xl h-10.5 w-10 sm:h-11 sm:w-11 rounded-xl focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/30"
            />
          </div>

          {/* Verify Button */}
          <button
            type="button"
            disabled={loading || verificationCode.length !== 6}
            onClick={handleStep3Verify}
            className="w-full h-11 px-4 mt-1.5 rounded-full bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-teal-950/20 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E4A] cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Verifying code...</span>
              </>
            ) : (
              <>
                <span>Verify &amp; Create Account</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </>
            )}
          </button>

          {/* Resend Code & Controls */}
          <div className="space-y-2 text-center pt-1">
            <p className="text-xs text-teal-100/75">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                disabled={resendLoading || resendCountdown > 0 || loading}
                onClick={onResendCode}
                className="font-bold text-teal-200 hover:text-white hover:underline underline-offset-4 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {resendLoading ? (
                  'Sending...'
                ) : resendCountdown > 0 ? (
                  `Resend in ${resendCountdown}s`
                ) : (
                  'Resend code'
                )}
              </button>
            </p>

            <div className="flex items-center justify-center gap-4 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => goToStep(2)}
                className="text-xs font-semibold text-teal-200 hover:text-white transition-colors focus:outline-none focus-visible:underline cursor-pointer"
              >
                Change details
              </button>

              {completionError && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onRetryCompletion}
                  className="text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
