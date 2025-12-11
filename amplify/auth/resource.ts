import { defineAuth } from "@aws-amplify/backend";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Admin-creates-users-only: users cannot self-register
  // New users must be created via AWS Console or CLI
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
});
