// middleware.ts (Revised Structure)
import { type NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';

// --- Import createServerRunner and outputs directly ---
import { createServerRunner } from '@aws-amplify/adapter-nextjs';
// Adjust path to your outputs file if middleware.ts is not at the root
import outputs from './amplify_outputs.json';
// --- End Imports ---

// --- Create the runner directly in this file ---
const { runWithAmplifyServerContext } = createServerRunner({
    config: outputs
});
// --- End Runner Creation ---

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Use the runner defined above
  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => { // No explicit type needed for contextSpec here
      try {
        const session = await fetchAuthSession(contextSpec);
        return session.tokens !== undefined;
      } catch (error) {
        console.log('Auth middleware error:', error);
        return false;
      }
    },
  });

  // Rest of the logic remains the same
  if (authenticated) {
    return response;
  }
  if (request.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}

// Matcher config remains the same
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|amplify_outputs.json).*)',
    '/',
  ],
};