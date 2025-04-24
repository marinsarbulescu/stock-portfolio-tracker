// jest.setup.js
import '@testing-library/jest-dom';
import { Amplify } from 'aws-amplify'; // Import Amplify

// Add a minimal configuration to prevent generateClient error in tests
// This doesn't need real values since API calls are mocked.
// Provide dummy values for required config parts.
Amplify.configure({
    Auth: { // Include at least one category, Auth is common
        Cognito: {
            userPoolId: 'us-east-1_dummy_pool_id', // Dummy value
            userPoolClientId: 'dummy_client_id',   // Dummy value
            identityPoolId: 'us-east-1:dummy_identity_pool_id', // Dummy value (if using Identity Pools)
        }
    },
    API: { // Add a dummy API config section
         GraphQL: {
             endpoint: 'https://dummy.appsync-api.us-east-1.amazonaws.com/graphql', // Dummy endpoint
             region: 'us-east-1', // Dummy region
             defaultAuthMode: 'userPool' // Or your app's default auth mode
         }
    }
    // Add other categories (Storage, etc.) if generateClient checks for them
}, { ssr: true }); // Add ssr: true as it's common for Next.js

// You can add other global test setup here if needed