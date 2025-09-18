#!/usr/bin/env tsx
/**
 * Backup Script: Export StockWallet data before migration
 * 
 * This script creates a backup of all StockWallet records before the tp→stp migration.
 * The backup can be used to restore data if something goes wrong during migration.
 * 
 * Usage:
 * npx tsx scripts/migrations/backup-wallets.ts
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import amplifyOutputs from '../../amplify_outputs.json';
import * as fs from 'fs';
import * as path from 'path';

// Configure Amplify
Amplify.configure(amplifyOutputs);
const client = generateClient<Schema>({
  authMode: 'apiKey' // Use API key for backup script
});

async function backupWallets() {
  console.log('💾 Starting StockWallet backup...');
  
  try {
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `stockwallets-backup-${timestamp}.json`);
    
    console.log('📊 Fetching all StockWallet records...');
    
    // Query to fetch all wallets with both old and new fields
    const listQuery = /* GraphQL */ `
      query BackupStockWallets {
        listStockWallets {
          items {
            id
            portfolioStockId
            walletType
            buyPrice
            totalSharesQty
            totalInvestment
            sharesSold
            remainingShares
            realizedPl
            tpValue
            tpPercent
            stpValue
            stpPercent
            realizedPlPercent
            sellTxnCount
            owner
            createdAt
            updatedAt
          }
          nextToken
        }
      }
    `;
    
    let allWallets: any[] = [];
    let nextToken: string | null = null;
    
    do {
      const variables: { nextToken?: string } = nextToken ? { nextToken } : {};
      
      const response: any = await (client as any).graphql({
        query: listQuery,
        variables
      });
      
      if (response.errors) {
        console.error('❌ Error fetching wallets:', response.errors);
        throw new Error('Failed to fetch wallet records');
      }
      
      const items = response.data?.listStockWallets?.items || [];
      allWallets = allWallets.concat(items);
      nextToken = response.data?.listStockWallets?.nextToken || null;
      
      console.log(`📦 Fetched ${items.length} wallets (total: ${allWallets.length})`);
      
    } while (nextToken);
    
    // Create backup object with metadata
    const backup = {
      metadata: {
        backupDate: new Date().toISOString(),
        totalRecords: allWallets.length,
        purpose: 'Post-schema-change backup with stpValue/stpPercent fields',
        version: '1.0',
        schemaState: 'after-tp-to-stp-rename'
      },
      wallets: allWallets
    };
    
    // Write backup to file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup completed successfully!`);
    console.log(`📁 Backup saved to: ${backupFile}`);
    console.log(`📊 Total records backed up: ${allWallets.length}`);
    
    return backupFile;
    
  } catch (error) {
    console.error('💥 Backup failed:', error);
    throw error;
  }
}

// Run the backup
if (require.main === module) {
  backupWallets()
    .then((backupFile) => {
      console.log('🏁 Backup script completed successfully.');
      console.log(`💾 Backup file: ${backupFile}`);
    })
    .catch((error) => {
      console.error('💥 Backup script failed:', error);
      process.exit(1);
    });
}

export { backupWallets };