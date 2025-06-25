// app/(authed)/page.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to signals page when home page loads
    router.push('/signals');
  }, [router]);

  // Show a loading message while redirecting
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Redirecting to Signals...</h2>
      <p>If you are not redirected automatically, <Link href="/signals">click here</Link>.</p>
    </div>
  );
}