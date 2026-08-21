'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordVerifyPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/auth/forgot-password');
  }, [router]);

  return null;
}
