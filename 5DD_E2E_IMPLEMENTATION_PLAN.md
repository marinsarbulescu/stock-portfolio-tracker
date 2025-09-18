# 5DD E2E Testing Implementation Plan

## Overview
Implement end-to-end testing for the 5DD (Five Day Dip) functionality in SignalsTable by extending the existing test price infrastructure to support test historical prices.

## Project Goals
- Enable predictable E2E testing of 5DD calculations
- Test both "show 5DD" and "hide 5DD" scenarios based on recent buy logic
- Minimal changes to production code
- Reuse existing test price infrastructure

## Architecture Overview
```
Real YFinance Data → PriceContext → mergeTestPricesWithRealPrices() → 5DD Logic
                                           ↑
                                    Test Historical Data (E2E only)
```

## Implementation Milestones

### 🎯 Phase 1: Database Schema Extension
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Add `testHistoricalCloses` field to PortfolioStock model in `amplify/data/resource.ts`
- [ ] Update TypeScript interfaces to include new field
- [ ] Test schema deployment locally

**Files to Modify:**
- `amplify/data/resource.ts`
- `app/(authed)/portfolio/types.ts` (if needed)
- `app/(authed)/signals/types.ts` (if needed)

**Acceptance Criteria:**
- [ ] New field appears in database schema
- [ ] TypeScript compilation passes
- [ ] Field is optional (doesn't break existing data)

---

### 🎯 Phase 2: Price Utils Enhancement
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Extend `mergeTestPricesWithRealPrices()` to handle test historical data
- [ ] Add type definitions for test historical closes
- [ ] Ensure backward compatibility with existing test price functionality

**Files to Modify:**
- `app/utils/priceUtils.ts`

**Key Code Changes:**
```typescript
// Enhanced merge function
if (stock.symbol) {
  const hasTestPrice = typeof stock.testPrice === 'number' && stock.testPrice > 0;
  const hasTestHistorical = stock.testHistoricalCloses && Array.isArray(stock.testHistoricalCloses);
  
  if (hasTestPrice || hasTestHistorical) {
    mergedPrices[stock.symbol] = {
      symbol: stock.symbol,
      currentPrice: hasTestPrice ? stock.testPrice : realPriceData?.currentPrice || null,
      historicalCloses: hasTestHistorical ? stock.testHistoricalCloses : realPriceData?.historicalCloses || [],
      isTestPrice: hasTestPrice || hasTestHistorical
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Test historical data overrides real YFinance historical data
- [ ] Normal operation unchanged when no test data
- [ ] Existing test price functionality still works
- [ ] TypeScript compilation passes

---

### 🎯 Phase 3: E2E Test Infrastructure
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Create JSON test configuration structure
- [ ] Extend E2E helpers to handle test historical data
- [ ] Create test data creation utilities

**Files to Create/Modify:**
- `e2e/signals/signals-5dd-validation.json`
- `e2e/utils/jsonHelper.ts` (extend existing)
- `e2e/utils/dataHelpers.ts` (extend existing)

**Test Configuration Structure:**
```json
{
  "testCases": [
    {
      "name": "5DD Shows - No Recent Buys",
      "stock": {
        "symbol": "E2E5DD1",
        "pdp": 5,
        "testPrice": 90,
        "testHistoricalCloses": [
          { "date": "2025-09-17", "close": 95 },
          { "date": "2025-09-16", "close": 92 },
          { "date": "2025-09-13", "close": 98 },
          { "date": "2025-09-12", "close": 94 },
          { "date": "2025-09-11", "close": 96 }
        ]
      },
      "transaction": {
        "date": "2025-09-01",
        "price": 100
      },
      "expected": {
        "fiveDayDip": "-8.16%",
        "lastBuyDays": 17
      }
    },
    {
      "name": "5DD Hidden - Recent Buy",
      "stock": {
        "symbol": "E2E5DD2",
        "pdp": 5,
        "testPrice": 90,
        "testHistoricalCloses": [/* same data */]
      },
      "transaction": {
        "date": "2025-09-15",
        "price": 91
      },
      "expected": {
        "fiveDayDip": null,
        "lastBuyDays": 3
      }
    }
  ]
}
```

**Acceptance Criteria:**
- [ ] JSON structure supports both test cases
- [ ] Helper functions can create stocks with test historical data
- [ ] Test data validation works

---

### 🎯 Phase 4: E2E Test Implementation
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Create main E2E test specification
- [ ] Implement test case 1: Show 5DD logic
- [ ] Implement test case 2: Hide 5DD logic
- [ ] Add column visibility and value verification
- [ ] Add proper cleanup logic

**Files to Create:**
- `e2e/signals/signals-5dd-validation.spec.ts`

**Test Structure:**
```typescript
test.describe('5DD Column Validation', () => {
  test('Case 1: Shows 5DD when no recent buys', async ({ page }) => {
    // 1. Create stock with test historical data
    // 2. Add old transaction (17 days ago)
    // 3. Navigate to Signals page
    // 4. Verify L Buy shows "17"
    // 5. Verify 5DD shows "-8.16%" (default color)
    // 6. Verify LBD shows "-10.00%" (default color)
  });

  test('Case 2: Hides 5DD when recent buy exists', async ({ page }) => {
    // 1. Create stock with same historical data
    // 2. Add recent transaction (3 days ago)
    // 3. Navigate to Signals page
    // 4. Verify L Buy shows "3"
    // 5. Verify 5DD shows "-" (threshold met but hidden due to recent buy)
    // 6. Verify LBD shows "-1.10%" (default color)
  });
});
```

**Acceptance Criteria:**
- [ ] Both test cases pass consistently
- [ ] Proper error messages when tests fail
- [ ] Clean test data cleanup after each test
- [ ] Tests run in parallel with other E2E tests
- [ ] 5DD and LBD values display in default color (no color validation needed)

---

### 🎯 Phase 5: Integration Testing & Validation
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Run full E2E test suite to ensure no regressions
- [ ] Test manually in browser to verify behavior
- [ ] Validate that normal operation (non-test) is unchanged
- [ ] Performance testing (ensure no slowdowns)

**Validation Checklist:**
- [ ] All existing E2E tests still pass
- [ ] New 5DD tests pass consistently
- [ ] Manual testing confirms expected behavior
- [ ] No impact on normal SignalsTable performance
- [ ] Production build works correctly

**Acceptance Criteria:**
- [ ] All automated tests green
- [ ] Manual validation successful
- [ ] Performance benchmarks met
- [ ] Ready for production deployment

---

### 🎯 Phase 6: Documentation & Cleanup
**Status**: ⏳ Not Started

**Tasks:**
- [ ] Update README with new test capabilities
- [ ] Add code comments explaining test historical data logic
- [ ] Create developer documentation for future test case additions
- [ ] Clean up any temporary files or debug code

**Files to Update:**
- `README.md`
- `e2e/README.md`
- Code comments in modified files

**Acceptance Criteria:**
- [ ] Documentation is clear and complete
- [ ] Future developers can easily add new test cases
- [ ] All temporary/debug code removed

---

## Risk Mitigation

### Potential Issues:
1. **Schema Changes**: Database migrations might be needed
   - **Mitigation**: Make field optional, test thoroughly
2. **Date Handling**: Date sorting and comparison edge cases
   - **Mitigation**: Use consistent date formats, add validation
3. **Test Data Conflicts**: Real vs test data interference
   - **Mitigation**: Use unique test symbols, proper cleanup
4. **Performance Impact**: Additional data processing
   - **Mitigation**: Only process when test data exists

### Rollback Plan:
- Each phase can be reverted independently
- Schema changes are additive (safe to rollback)
- Feature flag could be added if needed

---

## Success Metrics

### Technical Metrics:
- [ ] 100% test coverage for 5DD display/hide logic scenarios
- [ ] Verification of correct percentage calculations
- [ ] Verification of "-" display when conditions not met
- [ ] <5% increase in test execution time
- [ ] Zero impact on production performance
- [ ] All existing tests remain green

### Business Metrics:
- [ ] Reliable testing of 5DD feature edge cases
- [ ] Reduced manual testing time
- [ ] Faster development cycle for 5DD-related features
- [ ] Improved confidence in 5DD calculations

---

## Timeline Estimate
- **Phase 1**: 2-3 hours (Schema)
- **Phase 2**: 3-4 hours (Price Utils)
- **Phase 3**: 4-5 hours (Test Infrastructure)
- **Phase 4**: 5-6 hours (E2E Implementation)
- **Phase 5**: 2-3 hours (Integration Testing)
- **Phase 6**: 1-2 hours (Documentation)

**Total Estimated Time**: 17-23 hours

---

## Next Steps
1. Begin with Phase 1: Database Schema Extension
2. Test each phase thoroughly before moving to the next
3. Update this document with progress and any discoveries
4. Mark phases as ✅ Complete when finished

---

*Last Updated: September 18, 2025*
*Status: Planning Phase Complete - Ready to Begin Implementation*