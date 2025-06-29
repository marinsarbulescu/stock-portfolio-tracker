# HTP Logic Test

## Formula
Current Price >= TP Value + (TP Value × HTP%) + ((TP Value + HTP Amount) × Commission%)

## Test Case 1: Basic HTP without Commission
- TP Value: $100
- HTP: 5%
- Commission: 0%
- Current Price: $105.50

Calculation:
- HTP Amount = $100 × 5% = $5
- TP + HTP Amount = $100 + $5 = $105
- Commission Amount = $105 × 0% = $0
- HTP Trigger Price = $100 + $5 + $0 = $105

Result: $105.50 >= $105 ✓ (Signal should trigger - green background)

## Test Case 2: HTP with Commission
- TP Value: $100
- HTP: 5%
- Commission: 1%
- Current Price: $106.10

Calculation:
- HTP Amount = $100 × 5% = $5
- TP + HTP Amount = $100 + $5 = $105
- Commission Amount = $105 × 1% = $1.05
- HTP Trigger Price = $100 + $5 + $1.05 = $106.05

Result: $106.10 >= $106.05 ✓ (Signal should trigger - green background)

## Test Case 3: HTP not triggered
- TP Value: $100
- HTP: 5%
- Commission: 1%
- Current Price: $106.00

Calculation:
- HTP Amount = $100 × 5% = $5
- TP + HTP Amount = $100 + $5 = $105
- Commission Amount = $105 × 1% = $1.05
- HTP Trigger Price = $100 + $5 + $1.05 = $106.05

Result: $106.00 < $106.05 ✗ (Signal should NOT trigger - normal styling)

## Expected Behavior
- Only applies to Hold wallets (activeTab === 'Hold')
- Only applies when wallet has remaining shares > SHARE_EPSILON
- Only applies when all required values are valid numbers
- When triggered: backgroundColor: 'green', color: 'white' on remainingShares cell
