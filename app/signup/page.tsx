'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/login?tab=signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center">
      <div className="text-center py-12">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent inline-block" />
        <h2 className="text-xl font-semibold mt-4">
          Redirecting to signup...
        </h2>
      </div>
    </div>
  );
}
