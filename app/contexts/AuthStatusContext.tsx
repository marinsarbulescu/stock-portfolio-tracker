// app/contexts/AuthStatusContext.tsx
'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils'; // Import Hub

type AccessStatus = 'loading' | 'approved' | 'denied';

interface AuthStatusContextType {
  accessStatus: AccessStatus;
  checkAuthStatus: () => Promise<void>; // Function to potentially re-check
}

const AuthStatusContext = createContext<AuthStatusContextType | undefined>(undefined);

interface AuthStatusProviderProps {
  children: ReactNode;
}

export const AuthStatusProvider: React.FC<AuthStatusProviderProps> = ({ children }) => {
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');

  const checkAuthStatus = async () => {
    //console.log('[AuthStatusContext] Checking auth status...');
    setAccessStatus('loading'); // Set loading on check
    try {
      const session = await fetchAuthSession(); // Throws if not authenticated
      const accessToken = session.tokens?.accessToken;
      const groups = accessToken?.payload['cognito:groups'] as string[] | undefined;

      //console.log('[AuthStatusContext] User groups:', groups);

      if (groups && groups.includes('ApprovedUsers')) {
        setAccessStatus('approved');
      } else {
         // User is authenticated but not in the group
        setAccessStatus('denied');
      }
    } catch {
      // Error likely means user is not authenticated
      //console.log('[AuthStatusContext] User not authenticated or error fetching session:', error);
      setAccessStatus('denied'); // Treat non-authenticated as denied for protected routes
    }
  };

  useEffect(() => {
    // Initial check on mount
    checkAuthStatus();

    // Listen for auth events (sign in, sign out) using Amplify Hub
    const hubListenerCancel = Hub.listen('auth', ({ payload }) => {
        switch (payload.event) {
            case 'signedIn':
                //console.log('[AuthStatusContext] Hub: User signed in, re-checking status.');
                checkAuthStatus();
                break;
            case 'signedOut':
                 //console.log('[AuthStatusContext] Hub: User signed out.');
                setAccessStatus('denied'); // Set to denied on sign out
                break;
            // Add other cases like tokenRefresh if needed
        }
    });

    // Cleanup listener on unmount
    return () => {
        hubListenerCancel();
    };
  }, []); // Run only once on initial mount

  return (
    <AuthStatusContext.Provider value={{ accessStatus, checkAuthStatus }}>
      {children}
    </AuthStatusContext.Provider>
  );
};

// Custom hook to easily consume the context
export const useAuthStatus = (): AuthStatusContextType => {
  const context = useContext(AuthStatusContext);
  if (context === undefined) {
    throw new Error('useAuthStatus must be used within an AuthStatusProvider');
  }
  return context;
};