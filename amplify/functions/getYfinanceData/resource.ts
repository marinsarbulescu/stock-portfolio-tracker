import { defineFunction } from "@aws-amplify/backend";

export const getYfinanceData = defineFunction({
  name: "getYfinanceData",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
