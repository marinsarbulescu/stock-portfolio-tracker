// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'; // <-- Import defineBackend
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
// Add .js if needed based on your setup
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { sendStockEmail } from './functions/sendStockEmail/resource.js';

// Use defineBackend function instead of 'new'
const backend = defineBackend({ // <-- Call defineBackend here
  auth,
  data,
  sendStockEmail, // <-- Include ALL resources
});

// --- Grant Permissions AFTER Backend Definition ---

// Access resources using the 'backend' constant returned by defineBackend
const sesLambdaFunction = backend.sendStockEmail.resources.lambda;

// Add the necessary policy statement
if (sesLambdaFunction) {
    sesLambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'],
    }));
} else {
    console.warn("Could not find underlying Lambda function construct for sendStockEmail to attach SES policy.");
}

// --- REMOVE the redundant defineBackend call ---

// --- Optional: Ensure the backend instance is exported if needed ---
// export default backend; // <-- Export the constant returned by defineBackend