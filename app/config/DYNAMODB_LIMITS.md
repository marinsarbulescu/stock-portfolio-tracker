# DynamoDB Query Limits Documentation

## Overview
This document explains the purpose and usage of the DynamoDB query limit constants defined in `constants.ts`.

## Why These Limits Are Important

DynamoDB queries with filters work in two phases:
1. **Scan Phase**: DynamoDB scans up to the `limit` number of records
2. **Filter Phase**: DynamoDB applies filters to the scanned records

**Important**: The `limit` affects how many records DynamoDB **scans**, not how many it **returns**.

### Example Problem
If you want to find the "last buy transaction" with `limit: 1`, but the last 3 records in the table are "sell" transactions, you'll get an empty result. You need to set `limit: 5` so DynamoDB scans the last 5 records and can find the buy transaction.

## Constants Defined

### `FETCH_LIMIT_FOR_UNIQUE_WALLET = 1000`
- **Purpose**: Finding specific wallets by price and type
- **Usage**: `walletService.ts`, wallet queries in pages
- **Reason**: Ensures finding wallets even when many exist at different prices

### `FETCH_LIMIT_TRANSACTIONS_PAGINATED = 5000`
- **Purpose**: Large transaction fetches with pagination
- **Usage**: `signals/page.tsx` for fetching all transactions
- **Reason**: Maximizes efficiency for bulk transaction processing

### `FETCH_LIMIT_TRANSACTIONS_STANDARD = 1000`
- **Purpose**: Standard transaction queries
- **Usage**: `wallets/[stockId]/page.tsx`
- **Reason**: Sufficient for most single-stock transaction queries

### `FETCH_LIMIT_STOCKS_STANDARD = 1000`
- **Purpose**: Portfolio stock queries
- **Usage**: `portfolio/page.tsx`, `signals/page.tsx`
- **Reason**: Handles large portfolios efficiently

### `FETCH_LIMIT_WALLETS_GENEROUS = 3000`
- **Purpose**: Wallet queries that need generous limits
- **Usage**: `signals/page.tsx` for comprehensive wallet analysis
- **Reason**: Ensures all wallets are found for portfolio calculations

### `FETCH_LIMIT_WALLETS_CANDIDATES = 500`
- **Purpose**: Wallet candidate searches
- **Usage**: `wallets/[stockId]/page.tsx`
- **Reason**: Sufficient for finding wallet matches with price tolerance

### `FETCH_LIMIT_SMALL_QUERIES = 5000`
- **Purpose**: Paginated queries for single-stock transactions
- **Usage**: `wallets/[stockId]/page.tsx`
- **Reason**: Efficient pagination for single-stock transaction fetching, future-proof for portfolio growth

## Best Practices

1. **Use the appropriate constant** for your use case
2. **Don't use magic numbers** - always use the named constants
3. **Consider the scan vs. return difference** when choosing limits
4. **Monitor performance** - higher limits mean more DynamoDB reads
5. **Document new constants** if you add them

## How to Adjust Limits

If you need to adjust limits:
1. Modify the constant in `constants.ts`
2. The change will apply everywhere the constant is used
3. Consider the performance implications of higher limits
4. Test with real data to ensure the limit is sufficient

## Import Usage

```typescript
import {
  FETCH_LIMIT_FOR_UNIQUE_WALLET,
  FETCH_LIMIT_TRANSACTIONS_STANDARD,
  // ... other constants
} from '@/app/config/constants';
```

## Files Using These Constants

- `app/services/walletService.ts`
- `app/(authed)/signals/page.tsx`
- `app/(authed)/portfolio/page.tsx`
- `app/(authed)/wallets/[stockId]/page.tsx`
