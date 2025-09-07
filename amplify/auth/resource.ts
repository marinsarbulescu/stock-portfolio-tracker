import { defineAuth } from "@aws-amplify/backend";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Define user groups within Cognito User Pool
  groups: [
    'ApprovedUsers', // Group for users allowed full access
    // 'Admins' // Optionally add an Admins group if needed later
    ]
});
