import { defineFunction } from '@aws-amplify/backend-function';

export const getHistoricalData = defineFunction({
  name: 'getHistoricalDataHandler',
  entry: './handler.ts',
  timeoutSeconds: 30,
});
