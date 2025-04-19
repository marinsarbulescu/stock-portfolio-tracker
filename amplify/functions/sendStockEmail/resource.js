import { defineFunction } from '@aws-amplify/backend-function';
export const sendStockEmail = defineFunction({
    name: 'sendStockEmailHandler', // Optional: Define a specific name
    entry: './handler.ts',
    environment: {
        // Store sender email and region as environment variables
        SENDER_EMAIL_ADDRESS: "marin.sarbulescu@cj.com", // Replace with your VERIFIED sender email
        SES_REGION: "us-east-2", // Replace with your chosen SES region
    }
});
