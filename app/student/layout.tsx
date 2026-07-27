'use client';

import React from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}
