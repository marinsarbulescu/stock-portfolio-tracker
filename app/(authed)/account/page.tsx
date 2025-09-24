// app/account/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
// Removed signOut from here, kept others
import { fetchUserAttributes } from 'aws-amplify/auth';
// --- Import the new button ---
import SignOutButton from '@/app/components/SignOutButton'; // Adjust path if needed

type UserAttributes = {
  sub?: string;
  email?: string;
  // Add other attributes you expect
};

export default function AccountPage() {
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Remove router if only used for sign out, as SignOutButton handles it now
  // const router = useRouter(); // Keep if used for other navigation

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const attributes = await fetchUserAttributes();
        setUser(attributes);
        console.log('User attributes:', attributes);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data.');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, []);

  // --- Remove the local handleSignOut function ---
  // const handleSignOut = async () => { ... };

  if (isLoading) {
    return <p>Loading account information...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div>
      <h2>Account Details</h2>
      {user ? (
        <>
          <p>Welcome!</p>
          <p>Email: {user.email ?? 'N/A'}</p>
          <p>Sub ID: {user.sub ?? 'N/A'}</p>
          {/* Add other details */}

          {/* --- Use the SignOutButton component --- */}
          <div style={{ marginTop: '20px' }}>
             <SignOutButton />
          </div>
        </>
      ) : (
        <p>Could not load user information.</p>
      )}
    </div>
  );
}