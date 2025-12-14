import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { getYfinanceData } from './functions/getYfinanceData/resource.js';

const backend = defineBackend({
  auth,
  data,
  getYfinanceData,
});

// Disable self-registration in Cognito User Pool
const userPool = backend.auth.resources.userPool.node.defaultChild as any;
userPool.addPropertyOverride('AdminCreateUserConfig.AllowAdminCreateUserOnly', true);
