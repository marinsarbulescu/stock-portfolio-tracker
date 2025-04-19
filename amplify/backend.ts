// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'; // <-- Import defineBackend
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
// Add .js if needed based on your setup
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { sendStockEmail } from './functions/sendStockEmail/resource.js';
import { getYfinanceData } from './functions/getYfinanceData/resource.js';
import { walletMigrationScript } from './functions/walletMigrationScript/resource.js';

// Use defineBackend function instead of 'new'
const backend = defineBackend({ // <-- Call defineBackend here
  auth,
  data,
  getYfinanceData,
  sendStockEmail,
  walletMigrationScript,
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

// --- Define the Policy Statement ---
// Replace placeholders with your actual API ID and Env Name!
const apiId = 'l5ngx5jw55c3fm6fvsnd36wsly'; // Find in amplify_outputs.json -> resources.graphqlApi.apiId
const envName = 'NONE'; // e.g., 'main', 'prod'

const migrationFunctionPolicy = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
    ],
    // Construct the ARNs for the tables
    resources: [
        `arn:aws:dynamodb:*:*:table/PortfolioStock-${apiId}-${envName}`,
        `arn:aws:dynamodb:*:*:table/Transaction-${apiId}-${envName}`,
        `arn:aws:dynamodb:*:*:table/StockWallet-${apiId}-${envName}`,
        // Add index ARNs if needed
        `arn:aws:dynamodb:*:*:table/PortfolioStock-${apiId}-${envName}/index/*`,
        `arn:aws:dynamodb:*:*:table/Transaction-${apiId}-${envName}/index/*`,
        `arn:aws:dynamodb:*:*:table/StockWallet-${apiId}-${envName}/index/*`,
    ]
});
// --- End Policy Statement ---

// --- Attach Policy to the Function's Role ---
// Try accessing the underlying lambda execution role via the backend object
// This syntax accesses the CDK L2 construct for the function.
try {
    backend.walletMigrationScript.resources.lambda.addToRolePolicy(migrationFunctionPolicy);
    console.log("Successfully added policy to walletMigrationScript role.");
} catch (e) {
     console.error("Failed to attach policy using backend.walletMigrationScript.resources.lambda.addToRolePolicy:", e);
     // If this fails, it means accessing the role this way is still not correct for your setup.
     // Further investigation into CDK context/construct tree or Amplify documentation specific to your versions would be needed.
}
// --- End Attach Policy ---