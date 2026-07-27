'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export default function HomePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) {
      const redirectMap: Record<string, string> = {
        hostel_owner: '/owner/dashboard',
        student: '/student/dashboard',
        parent: '/parent/dashboard',
        super_admin: '/admin/dashboard',
      };
      const path = redirectMap[profile.role] ?? '/student/dashboard';
      router.push(path);
    }
  }, [profile, loading, router]);

  if (loading || profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Zap className="h-3.5 w-3.5 text-primary" /> Trusted by hostels across India
            </span>
            <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl font-display">
              Find your next <span className="text-primary">home away</span> from home.
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg">
              Discover verified hostels near you and manage rooms, bills, complaints and parents in one premium platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="rounded-full shadow-lg h-12 px-8" asChild>
                <Link href="/signup">
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full h-12 px-8" asChild>
                <Link href="/marketplace">
                  Browse Hostels
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative aspect-square lg:aspect-auto lg:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 mix-blend-overlay z-10" />
            <div className="grid grid-cols-2 gap-4 h-full p-4 bg-muted">
              <div className="bg-background rounded-xl shadow-elegant flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="font-semibold">Manage Hostels</span>
              </div>
              <div className="bg-background rounded-xl shadow-elegant flex flex-col items-center justify-center p-6 text-center space-y-3 mt-8">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Users className="w-6 h-6" />
                </div>
                <span className="font-semibold">For Students</span>
              </div>
              <div className="bg-background rounded-xl shadow-elegant flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="font-semibold">Analytics</span>
              </div>
              <div className="bg-background rounded-xl shadow-elegant flex flex-col items-center justify-center p-6 text-center space-y-3 mt-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="font-semibold">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-3xl font-display font-bold text-center mb-4">
            Powerful Features for Hostel Owners
          </h3>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Manage everything from one platform
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                title: 'Hostel Management',
                description: 'Create, update, and manage multiple hostels with ease',
              },
              {
                icon: Users,
                title: 'Student & Parent Management',
                description: 'Track students, manage parents, and keep everyone informed',
              },
              {
                icon: BarChart3,
                title: 'Analytics & Reports',
                description: 'Get insights into occupancy, revenue, and performance',
              },
              {
                icon: DollarSign,
                title: 'Billing System',
                description: 'Automate rent, electricity, and mess billing',
              },
              {
                icon: Zap,
                title: 'Smart Complaints',
                description: 'Track and resolve complaints with priority management',
              },
              {
                icon: Shield,
                title: 'Secure & Reliable',
                description: 'Enterprise-grade security for your data',
              },
            ].map((feature, idx) => (
              <div key={idx} className="card">
                <feature.icon size={32} className="text-primary mb-4" />
                <h4 className="font-bold text-lg mb-2">{feature.title}</h4>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h3 className="text-3xl font-display font-bold text-center mb-4">How It Works</h3>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Get started in 4 simple steps
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '1', title: 'Sign Up', desc: 'Create your account as owner, student, or parent' },
            { step: '2', title: 'Setup', desc: 'Add your hostel information and details' },
            { step: '3', title: 'Manage', desc: 'Manage students, bills, and complaints' },
            { step: '4', title: 'Grow', desc: 'Track analytics and improve operations' },
          ].map((item, idx) => (
            <div key={idx} className="card text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                {item.step}
              </div>
              <h4 className="font-bold text-lg mb-2">{item.title}</h4>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h3 className="text-3xl font-display font-bold text-center mb-4">Simple Pricing</h3>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Choose the plan that works for you
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Starter', price: '₹999', features: ['1 Hostel', '50 Students', 'Basic Reports'] },
              { name: 'Pro', price: '₹4,999', features: ['5 Hostels', '500 Students', 'Advanced Analytics', 'Priority Support'] },
              { name: 'Enterprise', price: 'Custom', features: ['Unlimited Hostels', 'Unlimited Users', 'API Access', 'Dedicated Support'] },
            ].map((plan, idx) => (
              <div
                key={idx}
                className={`card text-center ${idx === 1 ? 'border-primary border-2 transform scale-105' : ''}`}
              >
                <h4 className="text-2xl font-bold mb-2">{plan.name}</h4>
                <p className="text-4xl font-bold text-primary mb-6">{plan.price}</p>
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, fidx) => (
                    <div key={fidx} className="flex items-center space-x-2">
                      <CheckCircle size={20} className="text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <button className={idx === 1 ? 'btn-primary w-full' : 'btn-secondary w-full'}>
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-4xl font-display font-bold mb-4">Ready to Transform Your Hostel?</h3>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of hostel owners using HostelHub to streamline their operations
          </p>
          <Link href="/signup" className="bg-primary-foreground text-primary font-bold px-8 py-3 rounded-lg hover:bg-opacity-90 transition-all inline-block">
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">HostelHub</h4>
              <p className="text-muted-foreground text-sm">Hostel management made simple</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-primary">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-primary">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-primary">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-primary">About</Link></li>
                <li><Link href="/contact" className="hover:text-primary">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-primary">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-primary">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-primary">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-muted-foreground text-sm">
            <p>&copy; 2024 HostelHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DollarSign({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );
}
