import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  // Placeholder model - will be replaced with actual models
  UserSettings: a
    .model({
      theme: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
