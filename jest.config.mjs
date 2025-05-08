// root--jest.config.mjs

import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  //preset: 'ts-jest', // Keep if needed, though next/jest might handle TS

  // --- Add this moduleNameMapper section ---
  moduleNameMapper: {
    // Handle CSS imports (optional, uncomment if you import CSS/SCSS/etc. directly into components)
    // '\\.(css|less|sass|scss)$': 'identity-obj-proxy',

    // Handle path aliases based on tsconfig.json (assuming "@/*": ["./*"])
    '^@/(.*)$': '<rootDir>/$1',
  },
  // --- End moduleNameMapper section ---
}

export default createJestConfig(config)