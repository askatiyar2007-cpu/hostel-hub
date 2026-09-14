'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, RefreshCw, Lock, CheckCircle2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { OtpInput } from '@/components/otp-input';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [emailSent, setEmailSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  useEffect(() => {
    if (emailSent && !otpVerified && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [emailSent, otpVerified]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('reset_email', email.trim());
        setEmailSent(true);
        setResendCountdown(60);
        toast.success('Verification code sent to your email.', { duration: 8000 });
      } else {
        toast.error(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim() || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() })
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('reset_verified', 'true');
        setOtpVerified(true);
        toast.success('Verification successful!');
      } else {
        toast.error(data.error || 'Invalid verification code');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;

    setResendLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Verification code sent to your email.');
        setResendCountdown(60);
        setOtp('');
      } else {
        toast.error(data.error || 'Failed to resend code');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const resetVerified = sessionStorage.getItem('reset_verified');
    if (!resetVerified) {
      toast.error('Session expired. Please start over.');
      setEmailSent(false);
      setOtpVerified(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Password reset successfully!');
        sessionStorage.removeItem('reset_verified');
        sessionStorage.removeItem('reset_email');
        router.push('/auth/login');
      } else {
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
    { label: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { label: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { label: 'Contains number', test: (pwd: string) => /\d/.test(pwd) },
  ];

  return (
    <AuthShell>
      <AuthCard>
        <div>
          {otpVerified ? (
            /* STEP 3: Reset Password */
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="mx-auto w-12 h-12 bg-[#002b27] rounded-2xl flex items-center justify-center mb-2 ring-1 ring-teal-500/30 text-[#0dbb9c]">
                  <Lock className="w-6 h-6 text-[#0dbb9c]" />
                </div>
                <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-white font-display">
                  Reset Password
                </h2>
                <p className="text-xs text-teal-100/75">
                  Enter your new password below
                </p>
              </div>

              <AuthInput
                id="newPassword"
                name="newPassword"
                label="New Password"
                placeholder="Enter new password"
                required
                isPassword
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={Lock}
                disabled={loading}
              />

              {newPassword && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-teal-200/90 font-medium">Password Requirements:</p>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        {req.test(newPassword) ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-teal-800" />
                        )}
                        <span className={req.test(newPassword) ? 'text-emerald-300 font-medium' : 'text-teal-300/50'}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-rose-300 font-medium">Passwords do not match</p>
              )}

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full h-11 px-4 rounded-full bg-gradient-to-r from-[#0dbb9c] to-[#0ab898] hover:from-[#0ec9a8] hover:to-[#0bc7a5] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-[#0bb99a]/35 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0dbb9c] cursor-pointer uppercase"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Resetting...</span>
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
          ) : emailSent ? (
            /* STEP 2: Verify OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="mx-auto w-12 h-12 bg-[#002b27] rounded-2xl flex items-center justify-center mb-2 ring-1 ring-teal-500/30 text-[#0dbb9c]">
                  <Mail className="w-6 h-6 text-[#0dbb9c]" />
                </div>
                <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-white font-display">
                  Verify Your Email
                </h2>
                <p className="text-xs text-teal-100/75 max-w-xs mx-auto">
                  Enter the 6-digit verification code sent to{' '}
                  <span className="font-bold text-white break-all">{email}</span>
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <OtpInput
                  id="forgot-otp"
                  length={6}
                  value={otp}
                  onChange={(val) => setOtp(val)}
                  disabled={loading}
                  autoFocus
                  containerClassName="gap-2 sm:gap-2.5"
                  className="border-teal-700/80 bg-[#002522] text-white font-mono text-xl sm:text-2xl h-11 w-10 sm:h-12 sm:w-11 rounded-xl focus:border-[#0dbb9c] focus:ring-2 focus:ring-[#0dbb9c]/30"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-11 px-4 rounded-full bg-gradient-to-r from-[#0dbb9c] to-[#0ab898] hover:from-[#0ec9a8] hover:to-[#0bc7a5] active:brightness-95 text-white font-bold text-sm tracking-wide shadow-md shadow-[#0bb99a]/35 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0dbb9c] cursor-pointer uppercase"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  disabled={resendLoading || resendCountdown > 0 || loading}
                  onClick={handleResendOtp}
                  className="text-xs font-bold text-[#0dbb9c] hover:text-[#2dd4bf] flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Sending...' : resendCountdown > 0
                    ? `Resend in ${resendCountdown}s`
                    : 'Resend code'}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmailSent(false);
                    setOtp('');
                  }}
                  className="text-xs font-semibold text-teal-200/80 hover:text-white transition-colors cursor-pointer"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : (
            /* STEP 1: Send Email */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="mx-auto w-12 h-12 bg-[#002b27] rounded-2xl flex items-center justify-center mb-2 ring-1 ring-teal-500/30 text-[#0dbb9c]">
                  <Mail className="w-6 h-6 text-[#0dbb9c]" />
                </div>
                <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-white font-display">
                  Forgot Password?
                </h2>
                <p className="text-xs text-teal-100/75">
                  No worries — we&apos;ll help you get back into your account.
                </p>
              </div>

              <AuthInput
                id="email"
                name="email"
                type="email"
                label="Email Address"
                placeholder="Enter your email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={Mail}
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
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Code</span>
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
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
