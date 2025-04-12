// app/login/page.tsx
'use client';

import React, { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useRouter } from 'next/navigation';

// Define the inner component that uses the hook
function LoginHandler() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const router = useRouter();

  // Effect to redirect signed-in users away from login page
  useEffect(() => {
    if (authStatus === 'authenticated') {
      // Redirect to the homepage or a dashboard page after login
      router.push('/'); // Or router.push('/dashboard'); etc.
    }
  }, [authStatus, router]);

  // This component doesn't render anything itself,
  // it just handles the redirect logic based on context.
  // It could render loading state if needed.
  return null;
}

// Main LoginPage component now just renders the Authenticator
// with LoginHandler as a child
export default function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Authenticator>
        {/*
          Render LoginHandler as a child function component.
          This ensures LoginHandler is rendered *within* the Authenticator's context.
          We don't need the user/signOut props here, but this pattern works.
        */}
        {() => <LoginHandler />}
      </Authenticator>
    </div>
  );
}