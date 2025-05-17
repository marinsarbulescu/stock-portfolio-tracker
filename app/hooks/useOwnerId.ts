// src/hooks/useOwnerId.ts
import { useState, useEffect } from 'react';
import { fetchAuthSession, AuthSession } from 'aws-amplify/auth';

interface UseOwnerIdReturn {
    ownerId: string | null; // Will be in 'sub::sub' format or null
    isLoading: boolean;
    error: Error | null;
}

export function useOwnerId(): UseOwnerIdReturn {
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true; // Prevent state update on unmounted component

        const getOwner = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const session: AuthSession = await fetchAuthSession();
                
                // In Amplify JS v6, session.userSub is often the direct way to get the sub.
                // Fallback to checking tokens if userSub is not directly available or you prefer token claims.
                const sub = session.userSub || session.tokens?.accessToken?.payload?.sub;

                if (isMounted) {
                    if (sub) {
                        setOwnerId(`${sub}::${sub}`); // Format as sub::sub
                    } else {
                        console.warn("useOwnerId: User sub not found in session. User might not be authenticated or session is incomplete.");
                        setOwnerId(null); 
                        // You could set an error here if an ownerId is strictly required by all consumers
                        // setError(new Error("User sub not found in session."));
                    }
                }
            } catch (e: any) {
                if (isMounted) {
                    console.error("useOwnerId: Error fetching auth session:", e);
                    setError(e);
                    setOwnerId(null);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        getOwner();

        return () => {
            isMounted = false; // Cleanup function to set isMounted to false when the component unmounts
        };
    }, []); // Empty dependency array ensures this effect runs only once when the hook is first used

    return { ownerId, isLoading, error };
}