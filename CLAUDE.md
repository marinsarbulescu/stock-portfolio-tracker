# Stock Portfolio Tracker - Development Guide

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: AWS Amplify Gen 2
- **Auth**: AWS Cognito (admin-creates-users-only)
- **Database**: DynamoDB via Amplify Data
- **API**: GraphQL via AWS AppSync
- **Price Data**: yahoo-finance2 via AWS Lambda
- **Testing**: Jest + Testing Library (unit), Playwright (E2E)

## Project Structure
```
├── amplify/              # Amplify Gen 2 backend
│   ├── auth/             # Cognito authentication config
│   ├── data/             # GraphQL schema and data models
│   ├── functions/        # Lambda functions (e.g., getYfinanceData)
│   └── backend.ts        # Main backend definition
├── e2e/                  # Playwright E2E tests
│   ├── assets/           # Asset-related tests + JSON data
│   ├── dashboard/        # Dashboard tests
│   ├── transactions/     # Transaction tests
│   └── utils/            # Test helpers (assetHelper.ts, jsonHelper.ts)
├── scripts/              # Data import scripts
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── (authed)/     # Protected routes (require login)
│   │   └── login/        # Public login page
│   ├── components/       # React components
│   ├── contexts/         # React contexts (PriceContext)
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utility functions and calculations
```

## Development Commands
```bash
# Start Amplify sandbox (local backend) - REQUIRED before npm run dev
npx ampx sandbox

# Start Next.js dev server (in a separate terminal)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

**Important**: You must run `npx ampx sandbox` before `npm run dev` to generate `amplify_outputs.json`.

## Business Logic

### Core Concepts
- **Entry Target (ET)**: Pullback threshold that triggers BUY signals. Stored as positive (e.g., 4), displayed as negative (e.g., "-4%")
- **Profit Target (PT)**: Sell target percentage. Each BUY allocates shares across PTs based on allocation percentages
- **Wallet**: Holds shares at a specific (buyPrice, profitTargetId) combination. One wallet per unique combo

### Key Formulas
- **Quantity**: `investment / price` (no sell fee deducted at buy)
- **Entry Target Price**: `(buyPrice / (1 + buyFee%/100)) × (1 - ET%/100)` — Buy fee converts execution price to market price for Yahoo Finance signal comparison
- **Profit Target Price**: `buyPrice × (1 + PT%/100) / (1 - sellFee%/100)`
- **Pullback**: `(currentPrice - lastBuyPrice) / lastBuyPrice × 100`
- **ROI**: `(balance + marketValue) / maxOOP × 100`
- **P/L on SELL**: `netProceeds - costBasis` where `costBasis = walletPrice × quantity`
- **Precision**: All monetary and share values use 5 decimal places (e.g., `toFixed(5)`)

### Important Rules
- **One ET per asset** - Add button hidden after first ET created
- **PT allocations must sum to 100%** - Can be auto-distributed if some PTs left empty
- **Sell Fee only affects SELL** - Deducted from gross proceeds, also baked into PT price calculation
- **No transaction editing if subsequent transactions exist** - Protects wallet history integrity
- **Wallet deletion blocked** if PT has remaining shares
- **ET changes cascade** - Updating ET% recalculates all BUY transactions' entryTargetPrice
- **"New Transaction" button hidden** if no ET exists on the asset

### %2PT Color Coding (Dashboard/Wallets)
- **Green**: `≥ -0.005%` (at or above PT)
- **Yellow**: `-1% to -0.005%` (close to PT)
- **Default**: `< -1%` (far from PT)

### Transaction Types
- **BUY**: Creates wallets, allocates shares across PTs
- **SELL**: Reduces wallet shares, records P/L
- **DIVIDEND/SLP**: Cash inflow, no share impact
- **SPLIT**: Multiplies shares, divides prices (investment constant)

### Price Fetching (Yahoo Finance)
- **Lambda function**: `amplify/functions/getYfinanceData/handler.ts` uses yahoo-finance2
- **GraphQL query**: `getLatestPrices(symbols: [String!]!)` → returns current price + 7 days historical
- **Frontend context**: `PriceContext` manages prices, batches requests (5 symbols/batch), caches in localStorage
- **Test price override**: Assets can have `testPrice` field that overrides live price for development/testing
- **Historical data**: Used for 5D Pullback calculation (needs 5 trading days of closes)

## Key Conventions

### Authentication
- All routes under `(authed)/` require authentication
- Users are created manually via AWS Cognito Console
- No self-registration allowed

### Data Models
- All models use owner-based authorization
- Each user only sees their own data
- Use GraphQL selection sets to minimize data transfer

### After Schema Changes
Run sandbox to regenerate types:
```bash
npx ampx sandbox --once
```

### Testing (TDD Required)

**This project follows Test-Driven Development (TDD) as the default workflow.**

#### TDD Cycle
1. **Red**: Write a failing test that describes the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up the code while keeping tests green

#### When to Write Tests First
- **Utility functions**: Always write tests before implementation
- **React components**: Write tests for expected behavior/rendering
- **API handlers**: Test expected inputs/outputs
- **Business logic**: Test all edge cases before coding

#### Test Organization
- Place tests in `__tests__/` directories next to source files
- Name test files: `{filename}.test.ts` or `{filename}.test.tsx`
- Use descriptive test names that explain the expected behavior

#### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

#### Testing Guidelines
- Use `data-testid` attributes for component selection
- Prefer semantic queries (getByRole, getByLabelText) over test IDs when possible
- Mock external dependencies (API calls, Amplify client)
- Keep tests focused and independent

### E2E Testing (Playwright)

#### Running E2E Tests
```bash
# Run all e2e tests headless
npx playwright test --workers=1

# Run specific test
npx playwright test --workers=1 --grep "BUY Transaction"

# Run headed (visible browser)
npx playwright test --workers=1 --headed
```

#### E2E Test Files
- Tests are in `e2e/` directory
- Test data is in JSON files (e.g., `e2e/assets/asset-buy-crud.json`)
- Shared helpers are in `e2e/utils/assetHelper.ts`
- Type definitions are in `e2e/utils/jsonHelper.ts`

#### Data-Testid Convention
**IMPORTANT**: Always use `data-testid` attributes for element selection in e2e tests. Never locate elements by:
- Position or order (e.g., `.first()`, `.nth()`)
- Text content that might change
- CSS classes or styling
- DOM structure assumptions

Naming convention for `data-testid`:
- Buttons: `btn-{action}` (e.g., `btn-new-asset`, `btn-delete-asset`)
- Form fields: `{form}-form-{field}` (e.g., `asset-form-symbol`)
- Table cells: `{table}-table-{column}-{identifier}` (e.g., `asset-table-symbol-AAPL`)
- Links: `link-{destination}` (e.g., `link-transactions`)
- Actions on items: `{entity}-{action}-{id}` (e.g., `transaction-edit-123`, `transaction-delete-123`)

#### E2E Formulas Spreadsheet
**Important**: Always commit `e2e/e2e-tests-formulas.xlsx` when updating e2e tests. This Excel file contains the formulas used to calculate expected values for test verification. Excel temp files (`~$*.xlsx`) are gitignored.

#### E2E Test Data Values
**IMPORTANT**: Never calculate or derive your own input/expected values for e2e tests. Always use the exact values provided by the user. If the test fails because the UI shows different values than expected, discuss with the user before making changes. Do not assume calculation errors - the discrepancy may reveal a bug in the application.

## Git Workflow

### Commit Frequently
**IMPORTANT**: When the user completes a feature/fix and asks to move to a different topic, prompt them to commit first if there are uncommitted changes. Keep commits atomic and focused on one logical change. Do NOT automatically push — only commit locally unless the user explicitly asks to push.

Before switching topics, ask: "Should we commit these changes before moving on?"

### Commit Message Format
Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `test:` Adding or updating tests

## Deployment
- Push to `beta` branch deploys to beta.mystocs.com
- Amplify Hosting handles CI/CD automatically

## AWS Resources

### Sandbox (Local Development)
- **Cognito User Pool**: `amplifyAuthUserPool4BA7F805-AjKwZ77Os3T6`
- **DynamoDB Table ID**: `yuxh2uw64jgnfon4amqqm7trmu`
- **Region**: us-east-2
- **Admin User ID**: `010b75c0-30c1-7061-dd29-1c5e38c4a042`

### Production (beta.mystocs.com)
- **Cognito User Pool**: `amplifyAuthUserPool4BA7F805-lEKM7HRpFKht`
- **DynamoDB Table ID**: `73xhjaml3jcblg3stg5txx3wge`
- **Region**: us-east-2
- **Admin User ID**: `110b85c0-5021-70b3-22de-f6877bd250af`

## Import Transaction History from Production

Use this to replay transaction history from the old production app (main branch) into beta.

### Prerequisites

1. **Sandbox running**: `npx ampx sandbox`
2. **Asset exists in beta** with:
   - Buy Fee set (e.g., 0.85% for crypto on Robinhood) — affects ET price calculation
   - Sell Fee set (e.g., 0.5%)
   - Entry Target created (e.g., -4%)
   - Profit Targets created (e.g., 8% sortOrder 1, 16% sortOrder 2)

### Step 1: Export Data from Production DynamoDB

1. Go to AWS Console → DynamoDB → Tables → `StockTransaction-73xhjaml3jcblg3stg5txx3wge-NONE`
2. Click "Explore table items"
3. Filter by `portfolioStockId` = the asset's ID in production
4. Select all items → Actions → Download as CSV
5. Save as `scripts/data/{SYMBOL} transactions.csv`

6. Go to table `StockWallet-73xhjaml3jcblg3stg5txx3wge-NONE`
7. Filter by `portfolioStockId` = same asset ID
8. Download as CSV → Save as `scripts/data/{SYMBOL} wallets.csv`

### Step 2: Create Import Script

Copy `scripts/import-rnmby.ts` and modify for your asset:
- Update asset symbol in the filter
- Adjust profit target percentages if different
- Update signal mapping if needed

### Step 3: Run Import

```powershell
# In PowerShell (quotes handle special characters in password)
$env:EMAIL="marin.sarbulescu@gmail.com"; $env:PASSWORD="T5u#PW4&!9wm4SzG"; npx tsx scripts/import-rnmby.ts
```

### Step 4: Verify

1. Check transaction count matches
2. Check wallet balances are correct
3. Dashboard shows correct signals

### Field Mapping Reference

| Production Field | Beta Field | Notes |
|-----------------|------------|-------|
| `date` | `date` | Convert to ISO |
| `signal` | `signal` | Map: `_5DD`→REPULL, `LBD`→ENTAR, `Cust`→CUSTOM, `Initial`→INITIAL, `TP`→TP |
| `quantity` | `quantity` | Direct |
| `price` | `price` | Direct |
| `investment` | `investment` | Direct |
| `txnType` | PT allocation | `Hold`→PT16%, `Swing`→PT8%, `Split`→50/50 |
| `completedTxnId` | Wallet lookup | For SELL: get buyPrice from wallet |

### Clean Up

Use "Delete All" button on Transactions page to clear and re-import if needed.
