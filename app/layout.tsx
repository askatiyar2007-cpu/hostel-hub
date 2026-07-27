import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/context';
import { QueryProvider } from '@/lib/query-provider';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'HostelHub - Hostel Management SaaS',
  description: 'Complete hostel management solution for owners, students, and parents',
  viewport: 'width=device-width, initial-scale=1.0',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#f97316" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <QueryProvider>
          <AuthProvider>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
