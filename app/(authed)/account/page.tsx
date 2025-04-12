// app/account/page.tsx (or wherever AccountPage is defined)
'use client'; // Make sure it's a client component

import React, { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth'; // Import functions
import { useRouter } from 'next/navigation'; // To redirect after sign out

// Define a type for user data if needed
type UserAttributes = {
  sub?: string;
  email?: string;
  // Add other attributes you expect
};

export default function AccountPage() {
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // You can use getCurrentUser for basic info or fetchUserAttributes for more details
        // const currentUser = await getCurrentUser(); // Gets userId, username, signInDetails
        const attributes = await fetchUserAttributes(); // Gets attributes like email, sub, etc.
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
  }, []); // Empty dependency array ensures this runs once on mount

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to login page or home page after sign out
      router.push('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  // Render based on loading/error/user state
  if (isLoading) {
    return <p>Loading account information...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div>
      <h1>Account Details</h1>
      {user ? (
        <>
          <p>Welcome!</p>
          {/* Display user details safely */}
          <p>Email: {user.email ?? 'N/A'}</p>
          <p>Sub ID: {user.sub ?? 'N/A'}</p>
          {/* Add other details */}
          <button onClick={handleSignOut} style={{ marginTop: '20px' }}>Sign Out</button>
        </>
      ) : (
        <p>Could not load user information.</p>
      )}
    </div>
  );
}