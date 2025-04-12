// src/components/ConfigureAmplifyClientSide.tsx
'use client'; // Mark this as a Client Component

import { Amplify } from 'aws-amplify';
// Ensure the path to your configuration file is correct
// It's often at the root of your project after running sandbox/deploy
import config from '@/amplify_outputs.json';

// Configure Amplify client-side,
// ssr: true is important for Next.js Server Components support
Amplify.configure(config, { ssr: true });

export default function ConfigureAmplifyClientSide() {
  // This component doesn't render any visual elements
  return null;
}