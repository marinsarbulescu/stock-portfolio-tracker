# E2E Test Stability Report
**Date:** 2026-01-04
**Test Runs:** 10 iterations per test
**Method:** Sequential runs with `--workers=1`

## Executive Summary

Out of 7 e2e test suites, 6 showed **100% stability** across 10 runs. One test suite (**AssetSellCRUD**) encountered a **timeout failure** on the first run and did not complete the remaining 9 iterations.

---

## Test Results Overview

| Test Name | Runs Completed | Passed | Failed | Success Rate | Avg Duration |
|-----------|----------------|--------|--------|--------------|--------------|
| AssetBuyCRUD | 10 | 10 | 0 | 100% | ~57-58s |
| AssetCRUD | 10 | 10 | 0 | 100% | ~12s |
| ROI Calculation | 10 | 10 | 0 | 100% | ~55s |
| **AssetSellCRUD** | **1** | **0** | **1** | **0%** | **240s (timeout)** |
| AssetTargets | 10 | 10 | 0 | 100% | ~19s |
| DashboardSignals | 10 | 10 | 0 | 100% | ~54s |
| Authentication | 10 | 10 | 0 | 100% | ~4s |

---

## Detailed Findings

### ✅ Stable Tests (100% Pass Rate)

#### 1. AssetBuyCRUD - BUY Transaction CRUD
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~57-58 seconds per run
- **Notes:** Consistent performance, no errors

#### 2. AssetCRUD - Create, Edit, and Delete asset
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~12 seconds per run
- **Notes:** Fast and reliable

#### 3. ROI Calculation - ROI calculation verification
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~55 seconds per run
- **Notes:** Consistent performance

#### 4. AssetTargets - Entry Target and Profit Target CRUD
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~19 seconds per run
- **Notes:** No issues detected

#### 5. DashboardSignals - Verify %2PT colors
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~54 seconds per run
- **Notes:** Reliable performance

#### 6. Authentication - authentication flow
- **Status:** ✅ Stable
- **Runs:** 10/10 passed
- **Duration:** ~4 seconds per run
- **Notes:** Fastest test, very stable

---

### ❌ Unstable Tests

#### AssetSellCRUD - SELL Transaction CRUD

**Status:** ❌ **UNSTABLE - Timeout on first run**

**Error Details:**
```
Test timeout of 240000ms exceeded.

Error: page.waitForTimeout: Target page, context or browser has been closed

Location: utils/assetHelper.ts:111
Function: fillAllocationInput()
Context: createBuyTransaction()
```

**Error Location:**
```typescript
// assetHelper.ts:109-114
if (attempt < maxRetries) {
  await page.waitForTimeout(200); // Allow React to settle
}
```

**Failure Point:**
- The test was attempting to create a BUY transaction as part of the SELL CRUD test setup
- The browser/page/context closed unexpectedly during the `fillAllocationInput` function
- This happened while waiting for React to settle after an allocation input attempt

**Impact:**
- The test suite did not complete any of the 10 planned iterations
- Failed on the first run with a timeout (exceeded 240-second limit)
- This prevented the loop from continuing to subsequent runs

**Root Cause Hypothesis:**
The timeout suggests one of the following scenarios:
1. **Browser crash:** The browser process may have crashed during the test
2. **Memory issue:** Long-running test may have hit a memory limit
3. **Network/Backend timeout:** If the sandbox backend became unresponsive
4. **Race condition:** A timing issue in the allocation input filling logic that only manifests under certain conditions

---

## Pattern Analysis

### No Repeating Patterns Detected

Since only one test failed and only on the first attempt, there are **no repeating error patterns** to analyze across multiple failures.

### Key Observations:

1. **Timeout Duration:** The 240-second timeout suggests the test hung completely rather than failing fast
2. **Location Consistency:** Error occurred in a retry loop (`fillAllocationInput`) which suggests the retry mechanism itself may have issues
3. **Browser Closure:** "Target page, context or browser has been closed" indicates an unexpected browser termination
4. **Test Complexity:** The SELL CRUD test requires creating BUY transactions first (setup), making it more complex than standalone tests

---

## Recommendations

### For AssetSellCRUD Test:

1. **Investigate Browser Stability**
   - Check system resources during test execution
   - Review browser console logs if available
   - Consider adding browser crash detection/logging

2. **Review fillAllocationInput Function**
   - The retry logic at `assetHelper.ts:111` may need improvement
   - Consider adding timeout limits to individual retry attempts
   - Add more detailed logging to understand which retry attempt fails

3. **Add Defensive Checks**
   - Before calling `page.waitForTimeout()`, verify the page is still valid
   - Use `page.isClosed()` checks before operations
   - Consider wrapping the retry logic in a try-catch with better error context

4. **Rerun Test Multiple Times**
   - Since this is a single failure, it could be a fluke
   - Recommend running the SELL CRUD test 20-30 more times in isolation
   - If it only fails occasionally, it's a flaky test that needs stabilization

5. **Resource Monitoring**
   - The SELL CRUD test may be resource-intensive
   - Monitor memory usage during test execution
   - Consider adding delays between test runs if running multiple iterations

### General Test Suite Health:

✅ **Overall test suite is very stable** (85.7% of tests are 100% reliable)
⚠️ **One test requires attention** (AssetSellCRUD needs investigation)
📊 **Total test coverage:** 7 test suites covering authentication, CRUD operations, calculations, and UI verification

---

## Next Steps

1. **Immediate:** Run AssetSellCRUD test 10 more times in isolation to determine if this is a consistent failure or a one-time occurrence
2. **Short-term:** Add better error handling and logging to `fillAllocationInput` function
3. **Long-term:** Consider adding test retry logic at the Playwright configuration level for handling transient failures

---

## Appendix: Technical Details

### Test Execution Environment
- **Workers:** 1 (sequential execution)
- **Browser:** Chromium (Playwright)
- **Test Runner:** Playwright Test
- **Timeout:** 240,000ms (4 minutes)

### Error Stack Trace
```
Error: page.waitForTimeout: Target page, context or browser has been closed
  at utils/assetHelper.ts:111
  at fillAllocationInput (/Users/marsarbu/Coding/stock-portfolio-tracker/e2e/utils/assetHelper.ts:111:18)
  at createBuyTransaction (/Users/marsarbu/Coding/stock-portfolio-tracker/e2e/utils/assetHelper.ts:674:5)
  at /Users/marsarbu/Coding/stock-portfolio-tracker/e2e/assets/asset-sell-crud.spec.ts:114:11
```
