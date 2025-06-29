# HTP (Hold Take Profit) Implementation Summary

## Overview
Successfully implemented the HTP sell signal feature for Hold wallets in the stock portfolio tracker.

## Changes Made

### 1. Database Schema Updates (`amplify/data/resource.ts`)
- Added `htp: a.float().default(0)` field to the PortfolioStock model
- Field is required with default value of 0
- Represents HTP percentage (e.g., 5 = 5%)

### 2. Add Stock Modal (`PortfolioAddStockModal.tsx`)
- Added HTP state with default value '0'
- Added HTP form input field with validation (>= 0)
- Added HTP to data payload when creating stocks
- Form resets HTP to '0' when modal opens

### 3. Edit Stock Modal (`PortfolioEditStockModal.tsx`)
- Added HTP state management
- Added HTP form input field with validation (>= 0)
- Added HTP to update payload
- Form populates HTP from existing stock data

### 4. Portfolio Page (`portfolio/page.tsx`)
- Updated stock fetch query to include 'htp' field in selection set
- HTP value is now available for all stock operations

### 5. Wallet Page (`wallets/[stockId]/page.tsx`)
- Added `stockHtp` state variable
- Updated stock fetch query to include 'htp' field
- Added HTP state management (set/reset to null on error/not found)
- Pass HTP and commission props to WalletsSection component

### 6. WalletsSection Component (`WalletsSection.tsx`)
- Updated interface to accept `stockHtp` and `stockCommission` props
- Implemented `getHtpCellStyle()` function with HTP sell signal logic
- Applied HTP styling to `remainingShares` cell for Hold wallets only

## HTP Sell Signal Logic

### Formula
```
Current Price >= TP Value + (TP Value × HTP%) + ((TP Value + HTP Amount) × Commission%)
```

### Implementation Details
- **Only applies to Hold wallets** (`wallet.walletType === 'Hold'`)
- **Requires valid values** for:
  - `remainingShares > SHARE_EPSILON`
  - `tpValue` (number)
  - `currentStockPrice` (number) 
  - `htp` (number > 0)
- **Commission is optional** - if not provided or 0, commission calculation is skipped
- **Visual indicator**: Green background (`backgroundColor: 'green'`) with white text when signal triggers

### Calculation Steps
1. Calculate HTP Amount: `TP Value × (HTP% / 100)`
2. Calculate TP + HTP Amount: `TP Value + HTP Amount`
3. Calculate Commission Amount: `(TP + HTP Amount) × (Commission% / 100)` (if commission > 0)
4. Calculate HTP Trigger Price: `TP Value + HTP Amount + Commission Amount`
5. Compare: `Current Price >= HTP Trigger Price`

## Test Cases

### Test Case 1: Basic HTP without Commission
- TP Value: $100, HTP: 5%, Commission: 0%, Current Price: $105.50
- HTP Trigger Price: $100 + $5 + $0 = $105
- Result: $105.50 >= $105 ✓ (Signal triggers - green background)

### Test Case 2: HTP with Commission
- TP Value: $100, HTP: 5%, Commission: 1%, Current Price: $106.10
- HTP Trigger Price: $100 + $5 + $1.05 = $106.05
- Result: $106.10 >= $106.05 ✓ (Signal triggers - green background)

### Test Case 3: HTP not triggered
- TP Value: $100, HTP: 5%, Commission: 1%, Current Price: $106.00
- HTP Trigger Price: $100 + $5 + $1.05 = $106.05
- Result: $106.00 < $106.05 ✗ (Signal does NOT trigger - normal styling)

## Edge Cases Handled
- **Zero HTP**: No signal triggers (condition: `htp > 0`)
- **Missing values**: No signal triggers if any required value is null/undefined
- **Swing wallets**: HTP logic not applied (only for Hold wallets)
- **Empty wallets**: No signal triggers if `remainingShares <= SHARE_EPSILON`
- **Invalid numbers**: No signal triggers if any value is NaN

## UI Behavior
- **Hold Tab Active**: HTP signals visible on Hold wallets in the remainingShares column
- **Swing Tab Active**: No HTP signals (feature only applies to Hold wallets)
- **Signal Active**: Cell shows green background with white text
- **Signal Inactive**: Cell shows normal styling

## Data Flow
1. User creates/edits stock with HTP value via modals
2. HTP stored in database with stock record
3. Wallet page fetches stock data including HTP and commission
4. WalletsSection receives HTP/commission props
5. For each Hold wallet, HTP calculation performed
6. Visual indicator applied to remainingShares cell if signal triggers

## Files Modified
1. `amplify/data/resource.ts` - Schema
2. `app/(authed)/portfolio/components/PortfolioAddStockModal.tsx` - Add modal
3. `app/(authed)/portfolio/components/PortfolioEditStockModal.tsx` - Edit modal  
4. `app/(authed)/portfolio/page.tsx` - Portfolio query
5. `app/(authed)/wallets/[stockId]/page.tsx` - Wallet page
6. `app/(authed)/wallets/[stockId]/components/WalletsSection.tsx` - Wallet display

## Testing Status
- ✅ Database schema deployed successfully
- ✅ Add/Edit modals working with HTP field
- ✅ HTP logic implemented in WalletsSection
- ✅ No compilation errors
- ✅ Development server running successfully
- 🔄 End-to-end testing in progress

## Next Steps for Testing
1. Create a stock with HTP value (e.g., 5%)
2. Create Hold wallet with TP value (e.g., $100)
3. Set current price to trigger HTP signal (e.g., $105.50)
4. Verify green background appears on remainingShares cell in Hold tab
5. Test edge cases (zero HTP, missing values, Swing wallets)
