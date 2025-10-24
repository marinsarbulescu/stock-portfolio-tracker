// app/(authed)/layout.tsx
'use client';

import React from 'react';
// --- Step 1: Import AuthStatusProvider and useAuthStatus ---
import { AuthStatusProvider, useAuthStatus } from '@/app/contexts/AuthStatusContext'; // Adjust path if needed
import NavBar from '@/app/components/NavBar'; // Was NavBar, changed to NavBar to match import
import { PriceProvider } from '@/app/contexts/PriceContext'; // Keep PriceProvider
import { DipAnalysisProvider } from '@/app/contexts/DipAnalysisContext'; // Add DipAnalysisProvider
import SignOutButton from '@/app/components/SignOutButton'; // Assuming you create/have this

// --- Step 2: Create Inner Component to Consume Context ---
function AuthedLayoutContent({ children }: { children: React.ReactNode }) {
  const { accessStatus } = useAuthStatus(); // Get status from context

  return (
    <div>
      {/* Pass status to Navbar */}
      <NavBar accessStatus={accessStatus} />

      <main style={{ padding: '1rem' }}> {/* Example padding */}
        {/* Show loading state */}
        {accessStatus === 'loading' && <p>Verifying access...</p>}

        {/* Show denied message */}
        {accessStatus === 'denied' && (
          <div style={{ padding: '2rem', border: '1px solid orange', borderRadius: '5px', textAlign: 'center' }}>
            <h2>Access Denied</h2>
            <p>Your account requires approval from an administrator.</p>
            <p>Please contact support or wait for approval.</p>
             <div style={{marginTop: '20px'}}>
                {/* Ensure Sign Out is available here */}
                <SignOutButton />
             </div>
          </div>
        )}

        {/* Show page content ONLY if approved */}
        {accessStatus === 'approved' && children}
      </main>
    </div>
  );
}

// --- Step 3: Wrap export default with Providers ---
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    // PriceProvider should likely wrap AuthStatusProvider or vice-versa
    // depending on whether auth status depends on prices or not.
    // Let's assume PriceProvider is more general for now.
    <PriceProvider>
      <DipAnalysisProvider>
        <AuthStatusProvider>
             <AuthedLayoutContent>
                {children}
             </AuthedLayoutContent>
        </AuthStatusProvider>
      </DipAnalysisProvider>
    </PriceProvider>
  );
}