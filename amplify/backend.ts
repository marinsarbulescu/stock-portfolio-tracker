// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js'; // Main data models
import { defineFunction } from '@aws-amplify/backend-function';
//import * as iam from 'aws-cdk-lib/aws-iam';
//import * as cognito from 'aws-cdk-lib/aws-cognito';
// Remove dynamodb/RemovalPolicy imports - table managed by allowlistData now
// import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
// import { RemovalPolicy } from 'aws-cdk-lib';

// Define the backend resources
const backend = defineBackend({
  auth,
  data,                 // Your main data models/API
  getYfinanceData: defineFunction({
      entry: './functions/getYfinanceData/handler.ts' // Verify path
  }),
  // ... other resources ...
});

// --- REMOVE the separate CDK Table definition ---
// const allowlistTable = new dynamodb.Table(...) // DELETE THIS BLOCK

// --- Grant Permissions AFTER defineBackend ---
// Get ARN from the EmailAllowlist model within the 'allowlistData' resource
//const allowlistTableArn = backend.data.resources.tables.EmailAllowlist.tableArn;

// Allow the preSignup function to read from the EmailAllowlist table
// backend.preSignupAllowlistCheck.resources.lambda.grantPrincipal.addToPrincipalPolicy(
//     new iam.PolicyStatement({
//       actions: ['dynamodb:GetItem'],
//       resources: [allowlistTableArn],
//     })
//   );
// NOTE: Amplify should inject AMPLIFY_ALLOWLISTDATA_EMAILALLOWLIST_TABLE_NAME env var