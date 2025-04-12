// app/(authed)/layout.tsx
'use client';

import NavBar from '@/app/components/NavBar'; // Adjust path if needed
import { PriceProvider } from '@/app/contexts/PriceContext';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    // Add provider here
    <PriceProvider>
      <NavBar /> {/* NavBar rendered only for authenticated routes */}
      <main>{children}</main> {/* Render the specific authenticated page */}
    </PriceProvider>
  );
}