// app/components/NavBar.tsx
'use client';

import Link from 'next/link';
import React from 'react';
import { usePrices } from '@/app/contexts/PriceContext';
import SignOutButton from './SignOutButton'; // Import SignOutButton if you have it

// Define the type for the prop
type AccessStatus = 'loading' | 'approved' | 'denied';
interface NavBarProps {
    accessStatus: AccessStatus; // Add prop to receive status
}

const navStyles: React.CSSProperties = {
    backgroundColor: '#333',
    padding: '1rem',
    marginBottom: '1rem',
    display: 'flex',        // Use flexbox for layout
    justifyContent: 'space-between', // Space out left/right groups
    alignItems: 'center',  // Vertically align items
};

const linkGroupStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
};

const linkStyles: React.CSSProperties = {
    color: 'white',
    margin: '0 1rem',
    textDecoration: 'none',
};

const buttonStyles: React.CSSProperties = {
    marginLeft: '20px',
    cursor: 'pointer',
    padding: '8px 16px', // Example padding
};


// Accept accessStatus prop
export default function NavBar({ accessStatus }: NavBarProps) {

    const {
        fetchLatestPricesForAllStocks,
        pricesLoading
    } = usePrices();

    const isApproved = accessStatus === 'approved';

    return (
        <nav style={navStyles}>
            {/* Left Group: Conditional Links */}
            <div style={linkGroupStyles}>
                {/* Show navigation links only if approved */}
                {isApproved && (
                    <>
                        <Link href="/signals" style={linkStyles} data-testid="nav-home-link">Home</Link>
                        <Link href="/portfolio" style={linkStyles} data-testid="nav-portfolio-link">Portfolio</Link>
                        <Link href="/goals" style={linkStyles} data-testid="nav-goals-link">Goals</Link>
                    </>
                )}
                {/* Optional: Show something minimal if not approved */}
                {!isApproved && accessStatus !== 'loading' && (
                     <span style={{ color: '#888', marginLeft: '1rem'}}>Awaiting Approval</span>
                 )}
            </div>

            {/* Right Group: Always Visible Items */}
            <div style={linkGroupStyles}>
                <Link href="/account" style={linkStyles}>Account</Link>
                {/* Development-only test manager link */}
                {process.env.NODE_ENV === 'development' && (
                    <Link href="/test-manager" style={{...linkStyles, color: '#ffa500'}}>Test Manager</Link>
                )}
                {isApproved && (
                  <button
                      onClick={() => {
                        // console.log('[NavBar.tsx] - Fetch Prices button clicked!');
                        fetchLatestPricesForAllStocks();
                      }}
                      disabled={pricesLoading}
                      style={{
                        padding: '8px 16px',
                        background: '#557100',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                  >
                      {pricesLoading ? 'Fetching...' : 'Fetch Prices'}
                  </button>
                )}
                {/* Add SignOutButton here */}
                {/* <div 
                    style={{marginLeft: '0.5rem', padding: '8px 16px'}}
                >
                    <SignOutButton />
                 </div> */}
            </div>
        </nav>
    );
}