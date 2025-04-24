// __mocks__/aws-amplify/data.ts

// Define the mock functions that tests will use
export const mockCreate = jest.fn();
export const mockUpdate = jest.fn();
// Add other mock functions if needed (e.g., mockGet, mockList)

// Define and export the mock generateClient function
export const generateClient = jest.fn(() => ({
  models: {
    PortfolioStock: {
      create: mockCreate,
      update: mockUpdate,
      // get: mockGet, // Add if needed
      // list: mockList, // Add if needed
    },
    // Add other models if needed by other tests
  },
}));

// If the original module has other named exports your code uses,
// you might need to mock them here too.
// Example:
// export const Amplify = jest.requireActual('aws-amplify/data').Amplify;