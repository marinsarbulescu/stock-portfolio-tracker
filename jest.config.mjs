// root--jest.config.mjs

import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  '^aws-amplify/data$': '<rootDir>/__mocks__/aws-amplify/data.ts',
  //preset: 'ts-jest', // Keep if needed, though next/jest might handle TS

  moduleNameMapper: {
    // Handle CSS imports (optional, uncomment if you import CSS/SCSS/etc. directly into components)
    // '\\.(css|less|sass|scss)$': 'identity-obj-proxy',

    // Handle path aliases based on tsconfig.json (assuming "@/*": ["./*"])
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/' // Add the directory where your Playwright tests reside
  ],
}

export default createJestConfig(config)