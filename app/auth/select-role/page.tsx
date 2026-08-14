'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { GraduationCap, Building2, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/types/database';

export default function SelectRolePage() {
  const { updateUserRole, user } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  const roles = [
    {
      id: 'student' as UserRole,
      title: 'Student',
      description: 'Book hostel rooms, pay billing invoices, manage complaints, and view hostel announcements.',
      icon: GraduationCap,
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
      hoverColor: 'hover:border-blue-500 dark:hover:border-blue-400',
      activeColor: 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/30'
    },
    {
      id: 'owner' as UserRole,
      title: 'Hostel Owner',
      description: 'List hostels, manage room layouts, allocate students, verify billing payments, and check requests.',
      icon: Building2,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
      hoverColor: 'hover:border-emerald-500 dark:hover:border-emerald-400',
      activeColor: 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30'
    }
  ];

  const handleSelectRole = async () => {
    if (!selectedRole) {
      toast.error('Please choose a role to proceed');
      return;
    }

    setLoading(true);
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SelectRolePage] Selected role: ${selectedRole}. Initiating sync...`);

    try {
      // 1. Save role in database (profiles + user_roles)
      await updateUserRole(selectedRole);

      // 2. Save role_selected flag to user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { role_selected: true }
      });

      if (metadataError) throw metadataError;

      console.log(`[${timestamp}] [SelectRolePage] Role saved and metadata flags sync completed successfully`);
      toast.success('Role saved successfully!');

      // Redirect to password setup
      console.log(`[${timestamp}] [SelectRolePage] Redirecting to /auth/setup-password`);
      router.push('/auth/setup-password');
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to update user role';
      toast.error(errMsg);
      console.error(`[${timestamp}] [SelectRolePage] Role update error:`, error);
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
            Please log in first to select your account role.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full h-11 rounded-full mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-2xl font-semibold tracking-tight font-display text-foreground">HostelHub</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-foreground">
            What is your role?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Are you a Hostel Owner or Student? Choose your profile role to unlock the specialized dashboards, permissions, and management tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl mx-auto">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                disabled={loading}
                className={`relative flex flex-col items-center text-center p-8 bg-card border rounded-3xl transition-all duration-300 shadow-sm ${role.hoverColor} ${
                  isSelected ? role.activeColor : 'border-border hover:shadow-md hover:-translate-y-1'
                }`}
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${role.color} mb-6 shadow-sm`}>
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">{role.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {role.description}
                </p>

                {isSelected && (
                  <div className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center mt-10">
          <Button
            onClick={handleSelectRole}
            disabled={!selectedRole || loading}
            size="lg"
            className="h-12 px-8 rounded-full shadow-lg gap-2 text-base font-semibold transition-all hover:scale-105"
          >
            {loading ? 'Setting up your profile...' : 'Continue'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
