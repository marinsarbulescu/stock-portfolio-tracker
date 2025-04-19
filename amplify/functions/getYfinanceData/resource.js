import { defineFunction } from '@aws-amplify/backend-function';
export const getYfinanceData = defineFunction({
    // Provide a name for your function
    name: 'getYfinanceDataHandler',
    // Specify the entry point for the function code
    entry: './handler.ts',
    // Define environment variables if needed (e.g., for API keys, not required for basic yahoo-finance2)
    // environment: {
    //   API_KEY: 'YOUR_API_KEY'
    // },
    // Set memory and timeout if needed (defaults are usually okay to start)
    // memoryMb: 128,
    // timeoutSeconds: 10,
});
