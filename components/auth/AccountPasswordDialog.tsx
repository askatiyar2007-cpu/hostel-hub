'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Lock, 
  X, 
  Eye, 
  EyeOff, 
  Check, 
  ArrowLeft, 
  Mail, 
  KeyRound, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface AccountPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  role?: string;
}

type DialogMode = 'change' | 'recover';
type RecoverStep = 'email' | 'otp' | 'new_password' | 'success';

export function AccountPasswordDialog({ isOpen, onClose, userEmail }: AccountPasswordDialogProps) {
  // Mode: normal 'change' with current password, or 'recover' via email OTP
  const [mode, setMode] = useState<DialogMode>('change');
  const [recoverStep, setRecoverStep] = useState<RecoverStep>('email');

  // Change password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Recovery fields
  const [recoveryEmail, setRecoveryEmail] = useState(userEmail || '');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Sync email when prop changes
  useEffect(() => {
    if (userEmail) {
      setRecoveryEmail(userEmail);
    }
  }, [userEmail]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setMode('change');
      setRecoverStep('email');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setResetToken('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }, 200);
  };

  // 1. Normal Change Password Submission
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    const email = userEmail || (await supabase.auth.getUser()).data.user?.email;
    if (!email) {
      toast.error('Unable to verify user session. Please re-login.');
      return;
    }

    setIsUpdating(true);
    try {
      // Verify current password first
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInErr) {
        throw new Error('Current password verification failed. Please check your password.');
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      toast.success('Password updated successfully!');
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password update failed.';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  // 2. Recovery Step 1: Send OTP
  const handleSendRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToUse = recoveryEmail.trim().toLowerCase();
    if (!emailToUse) {
      toast.error('Please enter your email address');
      return;
    }

    setIsRequestingOtp(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Verification code sent to your email.');
        setResendCountdown(60);
        setRecoverStep('otp');
      } else {
        toast.error(data.error || 'Failed to send verification code.');
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // 3. Recovery Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.reset_token) {
        setResetToken(data.reset_token);
        toast.success('Code verified. Set your new password.');
        setRecoverStep('new_password');
      } else {
        toast.error(data.error || 'Invalid or expired verification code.');
      }
    } catch {
      toast.error('Failed to verify code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Recovery Step 3: Reset Password with Token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Password reset successfully!');
        setRecoverStep('success');
      } else {
        toast.error(data.error || 'Failed to reset password.');
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto overscroll-contain animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="relative w-full max-w-lg my-auto bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[min(90vh,620px)] overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shadow-2xs shrink-0">
              {mode === 'recover' ? <KeyRound size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <h3 id="password-dialog-title" className="font-bold text-base text-slate-900 font-display">
                {mode === 'recover' ? 'Password Recovery' : 'Change Password'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'recover'
                  ? 'Verify your identity via email OTP to set a new password'
                  : 'Update your account password securely'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODE 1: Normal Change Password */}
        {mode === 'change' && (
          <>
            <form 
              id="change-password-form"
              onSubmit={handleChangePassword} 
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              {/* Current Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="current_password" className="text-xs font-semibold text-slate-700">
                    Current Password <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recover');
                      setRecoverStep('email');
                    }}
                    className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-semibold p-0 cursor-pointer"
                  >
                    Forgot current password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showOldPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label={showOldPassword ? 'Hide password' : 'Show password'}
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="new_password" className="text-xs font-semibold text-slate-700">
                  New Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className="text-xs font-semibold text-slate-700">
                  Confirm New Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider font-display">
                  Password Requirements
                </p>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-4 w-4 rounded-full flex items-center justify-center text-[10px] transition-colors shrink-0",
                    newPassword.length >= 8 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    <Check size={10} />
                  </div>
                  <span className={newPassword.length >= 8 ? "text-slate-900 font-semibold" : "text-slate-500"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-4 w-4 rounded-full flex items-center justify-center text-[10px] transition-colors shrink-0",
                    newPassword && newPassword === confirmPassword ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    <Check size={10} />
                  </div>
                  <span className={newPassword && newPassword === confirmPassword ? "text-slate-900 font-semibold" : "text-slate-500"}>
                    Passwords match
                  </span>
                </div>
              </div>
            </form>

            {/* Fixed Persistent Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="h-10 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="change-password-form"
                disabled={isUpdating}
                className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </Button>
            </div>
          </>
        )}

        {/* MODE 2: In-Modal Recovery Flow */}
        {mode === 'recover' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Navigation back bar */}
            {recoverStep !== 'success' && (
              <div className="px-6 py-2 bg-teal-50/60 border-b border-teal-100 flex items-center justify-between text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (recoverStep === 'otp') setRecoverStep('email');
                    else if (recoverStep === 'new_password') setRecoverStep('otp');
                    else setMode('change');
                  }}
                  className="inline-flex items-center gap-1.5 text-teal-700 font-semibold hover:underline cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  {recoverStep === 'email' ? 'Back to Change Password' : 'Back'}
                </button>
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                  Step {recoverStep === 'email' ? '1 of 3' : recoverStep === 'otp' ? '2 of 3' : '3 of 3'}
                </span>
              </div>
            )}

            {/* Step 1: Request OTP */}
            {recoverStep === 'email' && (
              <>
                <form id="recover-email-form" onSubmit={handleSendRecoveryOtp} className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      We will send a 6-digit verification code to your registered email address. Use it to securely reset your password.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="recovery_email" className="text-xs font-semibold text-slate-700">
                      Registered Email Address <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="recovery_email"
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white text-sm"
                        placeholder="you@example.com"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    </div>
                  </div>
                </form>

                <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('change')}
                    className="h-10 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="recover-email-form"
                    disabled={isRequestingOtp}
                    className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isRequestingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Enter & Verify OTP */}
            {recoverStep === 'otp' && (
              <>
                <form id="recover-otp-form" onSubmit={handleVerifyOtp} className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-100 text-xs text-teal-900 leading-relaxed">
                    A 6-digit code was sent to <strong className="font-semibold">{recoveryEmail}</strong>. Please enter it below.
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otp-input" className="text-xs font-semibold text-slate-700">
                      Verification Code <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="text-center font-mono text-xl tracking-[0.4em] font-bold h-12 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Didn't get the code?</span>
                    {resendCountdown > 0 ? (
                      <span className="text-slate-400 font-medium">Resend in {resendCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendRecoveryOtp}
                        disabled={isRequestingOtp}
                        className="text-teal-600 font-bold hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </form>

                <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecoverStep('email')}
                    className="h-10 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    form="recover-otp-form"
                    disabled={isVerifyingOtp || otp.length !== 6}
                    className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Enter New Password */}
            {recoverStep === 'new_password' && (
              <>
                <form id="recover-reset-form" onSubmit={handleResetPassword} className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="recover_new_pass" className="text-xs font-semibold text-slate-700">
                      New Password <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="recover_new_pass"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimum 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="recover_confirm_pass" className="text-xs font-semibold text-slate-700">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="recover_confirm_pass"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white focus:border-teal-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Requirements Checklist */}
                  <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                    <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider font-display">
                      Password Requirements
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center text-[10px] transition-colors shrink-0",
                        newPassword.length >= 8 ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                      )}>
                        <Check size={10} />
                      </div>
                      <span className={newPassword.length >= 8 ? "text-slate-900 font-semibold" : "text-slate-500"}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center text-[10px] transition-colors shrink-0",
                        newPassword && newPassword === confirmPassword ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                      )}>
                        <Check size={10} />
                      </div>
                      <span className={newPassword && newPassword === confirmPassword ? "text-slate-900 font-semibold" : "text-slate-500"}>
                        Passwords match
                      </span>
                    </div>
                  </div>
                </form>

                <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecoverStep('otp')}
                    className="h-10 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    form="recover-reset-form"
                    disabled={isResettingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                    className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isResettingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Reset Password</span>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Step 4: Success State */}
            {recoverStep === 'success' && (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-900 font-display">Password Updated!</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Your password has been reset successfully. You can now use your new password across all HostelHub services.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleClose}
                  className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-6 shadow-xs mt-2"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
