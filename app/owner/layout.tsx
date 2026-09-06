'use client';

import React from 'react';
import { OwnerShell } from '@/components/owner/owner-shell';

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerShell>
      {children}
    </OwnerShell>
  );
}
