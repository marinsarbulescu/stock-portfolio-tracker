# TP to STP Field Migration

This directory contains migration scripts to rename `tpValue` and `tpPercent` fields to `stpValue` and `stpPercent` in the StockWallet model for consistency with the UI terminology.

## Overview

The migration renames these fields in the `StockWallet` model:
- `tpValue` → `stpValue` (Target/Take Profit Value in dollars)
- `tpPercent` → `stpPercent` (Target/Take Profit Percentage)

This ensures consistency with:
- UI terminology (everything shows "STP" in the interface)
- `PortfolioStock.stp` field naming convention

## Files

### Migration Scripts
- `backup-wallets.ts` - Creates a backup of all StockWallet records before migration
- `migrate-tp-to-stp.ts` - Performs the actual field migration

### Generated Files
- `backups/` - Directory containing backup files (auto-created)

## Migration Process

### Step 1: Prerequisites
Ensure you have the necessary dependencies and access:
```bash
# Install tsx if not already installed
npm install -g tsx

# Verify you have API key access configured in amplify_outputs.json
# The migration uses apiKey auth mode for administrative access
```

### Step 2: Create Backup
**IMPORTANT**: Always create a backup before running migrations.

```bash
# Create backup of current data
npx tsx scripts/migrations/backup-wallets.ts
```

This will create a timestamped backup file in the `backups/` directory.

### Step 3: Deploy Schema Changes
The schema has already been updated in `amplify/data/resource.ts`:
```typescript
// Old fields
tpValue: a.float(),
tpPercent: a.float(),

// New fields  
stpValue: a.float(),
stpPercent: a.float(),
```

Deploy the schema changes:
```bash
npx ampx sandbox
# or for production
npx ampx pipeline-deploy
```

### Step 4: Run Migration
After schema deployment, run the migration:
```bash
npx tsx scripts/migrations/migrate-tp-to-stp.ts
```

The migration will:
1. Fetch all existing StockWallet records
2. Copy `tpValue` → `stpValue` and `tpPercent` → `stpPercent`
3. Update each record with the new field values
4. Report progress and summary

### Step 5: Update Application Code
After successful migration, update the application code:
1. Update service layer (`walletService.ts`)
2. Update React components 
3. Update TypeScript interfaces
4. Update E2E tests
5. Update documentation

### Step 6: Remove Old Fields (Optional)
Once all code is updated and tested, you can remove the old fields from the schema:
```typescript
// Remove these lines from amplify/data/resource.ts
// tpValue: a.float(),
// tpPercent: a.float(),
```

## Recovery Process

If something goes wrong during migration, you can restore from backup:

1. Find your backup file in the `backups/` directory
2. Use the AWS Amplify console or AWS CLI to restore records
3. Or write a custom restore script using the backup JSON data

## Verification

After migration, verify the data integrity:

1. Check that all wallets have `stpValue`/`stpPercent` populated correctly
2. Verify calculations still work in the UI
3. Run E2E tests to ensure functionality is intact
4. Compare a few records manually against the backup

## Rollback Strategy

If issues are discovered after deployment:

1. **Immediate**: Revert application code to use old field names
2. **Short-term**: Use backup data to restore original values
3. **Long-term**: Fix issues and re-run migration

## Safety Features

The migration script includes:
- ✅ Comprehensive error handling
- ✅ Progress reporting
- ✅ Detailed logging
- ✅ Dry-run capabilities (can be added)
- ✅ Backup verification
- ✅ Rollback preparation

## Troubleshooting

### Common Issues

**Permission Denied**
- Ensure API key is properly configured in `amplify_outputs.json`
- Check that API key has the necessary permissions

**Schema Not Found**
- Make sure schema changes are deployed before running migration
- Verify the new fields exist in the deployed schema

**Partial Migration**
- Check the error logs for specific record failures
- Re-run migration (it will skip already migrated records)
- Use backup to restore if needed

### Support
If you encounter issues during migration, refer to:
1. Error logs from the migration script
2. Amplify console logs
3. AWS CloudWatch logs for the backend
4. The backup files for data verification

---

**⚠️ IMPORTANT REMINDER**: Always run the backup script before performing any migration!