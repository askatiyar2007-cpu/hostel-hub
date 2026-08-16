'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import InviteSignupForm from './invite-signup-form';
import { Building2, DoorOpen, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

type InvitationStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'error';

interface InvitationData {
  valid: boolean;
  status: 'valid' | 'invalid' | 'expired' | 'used';
  email: string;
  student_name: string;
  hostel_name: string;
  room_number: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<InvitationStatus>('loading');
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateInvitation = async () => {
      const token = params.token as string;
      if (!token) {
        setStatus('invalid');
        setError('No invitation token provided');
        return;
      }

      try {
        const response = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setStatus('invalid');
          setError(data.error || 'Failed to validate invitation');
          return;
        }

        if (data.valid) {
          setStatus('valid');
          setInvitationData(data);
        } else {
          setStatus(data.status);
          setInvitationData(data);
        }
      } catch (err) {
        console.error('Validation error:', err);
        setStatus('error');
        setError('Failed to validate invitation. Please try again later.');
      }
    };

    validateInvitation();
  }, [params.token]);

  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </div>
        );

      case 'valid':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold font-display text-foreground mb-2">You're Invited!</h1>
              <p className="text-muted-foreground">Complete your account setup to access your assigned room</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-muted/50 p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DoorOpen className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student</span>
                </div>
                <p className="font-semibold text-foreground">{invitationData?.student_name}</p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hostel</span>
                </div>
                <p className="font-semibold text-foreground">{invitationData?.hostel_name}</p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DoorOpen className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Room</span>
                </div>
                <p className="font-semibold text-foreground">Room {invitationData?.room_number}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <InviteSignupForm 
                email={invitationData?.email || ''} 
                token={params.token as string} 
              />
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-amber-100 rounded-full mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground mb-6">This invitation has expired. Please contact your hostel owner for a new invitation.</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Go to Login
            </button>
          </div>
        );

      case 'used':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-blue-100 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Invitation Already Used</h2>
            <p className="text-muted-foreground mb-6">This invitation has already been used to create an account. Please log in directly.</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Go to Login
            </button>
          </div>
        );

      case 'invalid':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-red-100 rounded-full mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-6">This invitation is invalid or no longer available. Please contact your hostel owner.</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Go to Login
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Error</h2>
            <p className="text-muted-foreground mb-6">{error || 'An unexpected error occurred'}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-primary hover:bg-primary/95 text-white rounded-xl font-semibold text-sm transition-all"
            >
              Go to Login
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {renderStatus()}
      </div>
    </div>
  );
}