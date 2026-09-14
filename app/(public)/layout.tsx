// app/(public)/layout.tsx
import React from 'react';
import PublicHeader from '@/components/public/PublicHeader';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
    </>
  );
}
