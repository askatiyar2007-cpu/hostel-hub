'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import { toast } from 'sonner';
import { Mail, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email address is required');
      return;
    }

    setLoading(true);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ForgotPasswordPage] Sending reset email request for: ${email}`);

    try {
      await forgotPassword(email);
      toast.success('Reset email sent successfully!');
      setSubmitted(true);
      console.log(`[${timestamp}] [ForgotPasswordPage] Reset request complete`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to send reset link';
      toast.error(errMsg);
      console.error(`[${timestamp}] [ForgotPasswordPage] Error sending reset link:`, error);
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
          <h2 className="text-3xl font-bold tracking-tight font-display">Forgot Password?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send you a reset link
          </p>
        </div>

        <div className="mt-8 bg-card border border-border p-8 rounded-3xl shadow-sm">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full shadow-lg"
              >
                {loading ? 'Sending link...' : 'Send Reset Email'}
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="bg-primary/10 text-primary rounded-2xl p-4 inline-flex items-center justify-center mb-2">
                <Mail className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold">Check your email</h3>
              <p className="text-sm text-muted-foreground px-2">
                We have sent a password reset link to <strong className="text-foreground">{email}</strong>. The link will expire in 24 hours.
              </p>
              <div className="pt-4 border-t border-border">
                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4">
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
