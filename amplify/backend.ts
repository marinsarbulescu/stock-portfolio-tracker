import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';

const backend = defineBackend({
  auth,
  data,
});

// Disable self-registration in Cognito User Pool
const userPool = backend.auth.resources.userPool.node.defaultChild as any;
userPool.addPropertyOverride('AdminCreateUserConfig.AllowAdminCreateUserOnly', true);
