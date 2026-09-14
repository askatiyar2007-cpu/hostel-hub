'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthSignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login?tab=signup');
  }, [router]);

  return null;
}
