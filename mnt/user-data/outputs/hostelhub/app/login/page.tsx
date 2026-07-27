'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/context';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      toast.success('Login successful!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { email: 'owner@test.com', password: 'Test123456', role: 'Hostel Owner' },
    { email: 'student@test.com', password: 'Test123456', role: 'Student' },
    { email: 'parent@test.com', password: 'Test123456', role: 'Parent' },
  ];

  const fillDemo = (email: string, password: string) => {
    setFormData({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-lg mb-4">
            <span className="text-2xl font-bold text-primary-foreground">H</span>
          </div>
          <h1 className="text-3xl font-display font-bold">HostelHub</h1>
          <p className="text-muted-foreground mt-2">Hostel Management Made Simple</p>
        </div>

        {/* Login Form */}
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="input w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="input w-full"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Don't have an account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Accounts */}
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
          <p className="text-sm font-medium mb-3 text-foreground">Demo Accounts</p>
          <div className="space-y-2">
            {demoAccounts.map((account, index) => (
              <button
                key={index}
                type="button"
                onClick={() => fillDemo(account.email, account.password)}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent/10 transition-colors"
              >
                <div className="font-medium">{account.role}</div>
                <div className="text-xs text-muted-foreground">{account.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
