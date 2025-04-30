// app/components/SignOutButton.tsx
'use client';

import React from 'react';
import { signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation'; // Use App Router's router

export default function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            // Use global sign out to invalidate tokens everywhere
            await signOut({ global: true });
            // Redirect to login page after sign out
            router.push('/login'); // Or '/' if you prefer redirecting to home
            router.refresh(); // Force refresh to clear any cached layout state
        } catch (error) {
            console.error('Error signing out: ', error);
            // Maybe show an error message to the user?
        }
    };

    // Add any desired button styling here or via CSS classes
    const buttonStyle: React.CSSProperties = {
         padding: '8px 15px',
         cursor: 'pointer',
         backgroundColor: '#555',
         color: 'white',
         border: 'none',
         borderRadius: '4px'
    };


    return (
        <button onClick={handleSignOut} style={buttonStyle}>
            Sign Out
        </button>
    );
}