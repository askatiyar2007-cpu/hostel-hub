import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/context';
import { QueryProvider } from '@/lib/query-provider';
import { ThemeProvider } from '@/lib/theme-context';

import { SiteHeader } from '@/components/site-header'; // Added import for SiteHeader
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

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 5.0,
  viewportFit: 'cover' as const,
};

export const metadata: Metadata = {
  title: 'HostelHub - Hostel Management SaaS',
  description: 'Complete hostel management solution for owners, students, and parents',
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
        <meta name="theme-color" content="#0d9488" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('hostelhub_theme');
                  var theme = stored || 'system';
                  var isDark = false;
                  if (theme === 'dark') {
                    isDark = true;
                  } else if (theme === 'system') {
                    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground overflow-x-hidden">
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <div className="relative flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1">{children}</main>
              </div>
              <Toaster position="top-right" />
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
