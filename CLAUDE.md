# Claude Development Guidelines - Project Context

> **Note**: Core development principles and build verification sequences are in `.github/copilot-instructions.md` and automatically applied to all conversations. This file contains project-specific context and advanced guidelines.

## Project Architecture Overview

### Stock Portfolio Tracker Structure
- **Frontend**: Next.js 14 with TypeScript, React components
- **Backend**: AWS Amplify Gen 2 with GraphQL, DynamoDB
- **Key Entities**: Portfolios → Stocks → Wallets → Transactions
- **Financial Calculations**: Real-time P&L, ROIC, budget tracking
- **Price Data**: Yahoo Finance integration via AWS Lambda

### Critical Business Logic
- **Wallet Types**: Swing (short-term) vs Hold (long-term) strategies
- **Transaction Flow**: Buy → Hold/Swing Wallets → Sell → P&L Calculation
- **Cash Flow**: Out-of-Pocket (OOP) vs Cash Balance tracking
- **Split Handling**: Stock splits require proportional adjustments across wallets/transactions

## Advanced Development Patterns

### Component Organization
- **Page Level**: `/app/(authed)/[feature]/page.tsx` - Main orchestration
- **Components**: `/components/` - Reusable UI components  
- **Feature Components**: `/[feature]/components/` - Feature-specific components
- **Types**: Centralized in `/types.ts` or feature-specific type files

### State Management Patterns
- **useMemo Dependencies**: Always include all dependencies, especially for financial calculations
- **Error Boundaries**: Handle GraphQL errors gracefully with user-friendly messages
- **Loading States**: Provide clear feedback during data fetching operations

### Testing Strategy
- **E2E Tests**: Playwright tests in `/e2e/` directory
- **Test Data**: Use deterministic test data for reliable E2E runs
- **Test IDs**: Always add `data-testid` attributes for new UI elements

## Financial Domain Expertise

### Key Calculations
- **ROIC**: `(Cash Balance + Market Value - Total OOP) / Total OOP * 100`
- **Tied-Up Investment**: Proportional investment in remaining shares
- **P&L**: Realized (from sales) vs Unrealized (current positions)
- **Budget Management**: Risk Budget vs Budget Used vs Budget Available

### Price Data Integration
- **Real-time Prices**: Yahoo Finance via AWS Lambda functions
- **Test Prices**: Override mechanism for E2E testing
- **Price Context**: Centralized price management with React Context

## Amplify Gen 2 Patterns

### GraphQL Operations
- **Client Generation**: `generateClient<Schema>()` pattern
- **Selection Sets**: Specify exact fields needed to optimize queries
- **Error Handling**: Always check for `errors` in responses
- **Pagination**: Use appropriate limits for data fetching

### Schema Relationships
- **Portfolios**: Top-level container
- **Stocks**: Belong to portfolios, contain metadata (STP, HTP, budgets)
- **Wallets**: Contain shares and track cost basis
- **Transactions**: Historical records of all actions

## Common Pitfalls & Solutions

### TypeScript Issues
- **Type Assertions**: Use `as unknown as Type` pattern for Amplify responses
- **Optional Chaining**: Always use `?.` for potentially undefined properties
- **Number Precision**: Use `parseFloat().toFixed()` for currency/percentage values

### Performance Considerations
- **useMemo Optimization**: Expensive calculations should be memoized
- **Re-render Prevention**: Proper dependency arrays prevent unnecessary calculations
- **Data Fetching**: Minimize GraphQL requests with proper selection sets

### Financial Accuracy
- **Epsilon Comparisons**: Use `SHARE_EPSILON` for floating-point share comparisons
- **Currency Precision**: Round to 2 decimal places for currency values
- **Split Adjustments**: Always verify split ratios before applying adjustments

## Deployment & Environment

### Build Process
- **TypeScript Compilation**: Must pass before deployment
- **Lint Checks**: Address warnings contextually
- **Environment Variables**: Use Amplify environment configuration

### Testing Requirements
- **E2E Coverage**: Critical user flows must have E2E tests
- **Cross-browser**: Test in modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile Responsiveness**: Ensure functionality on mobile devices