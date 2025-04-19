// amplify/functions/walletMigrationScript/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const walletMigrationScript = defineFunction({
    name: 'walletMigrationScript',
    entry: './src/index.ts',
    timeoutSeconds: 300,
    memoryMB: 512,
});