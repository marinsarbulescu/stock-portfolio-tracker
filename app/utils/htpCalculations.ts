// app/utils/htpCalculations.ts
// Shared HTP (Hold Take Profit) calculation utilities

export interface HtpCalculationParams {
  buyPrice: number;
  htpPercentage: number;
  commissionPercentage?: number | null | undefined;
}

export interface HtpResult {
  triggerPrice: number;
  isTriggered: boolean;
  currentPercentageGain?: number;
}

/**
 * Calculate HTP trigger price and determine if signal is active
 * @param params - HTP calculation parameters
 * @param currentPrice - Current stock price (optional, for signal checking)
 * @returns HTP calculation result
 */
export function calculateHtpSignal(
  params: HtpCalculationParams, 
  currentPrice?: number | null
): HtpResult {
  const { buyPrice, htpPercentage, commissionPercentage } = params;

  // Validate inputs
  if (
    typeof buyPrice !== 'number' || 
    typeof htpPercentage !== 'number' || 
    htpPercentage <= 0 || 
    buyPrice <= 0
  ) {
    throw new Error('Invalid HTP calculation parameters');
  }

  // Calculate HTP trigger price from buy price
  // Formula: Buy Price × (1 + HTP%) + Commission
  const htpTriggerBeforeCommission = buyPrice * (1 + htpPercentage / 100);
  
  // Commission calculation: if commission is provided, calculate commission on HTP trigger price
  const commissionAmount = (typeof commissionPercentage === 'number' && commissionPercentage > 0) 
    ? (htpTriggerBeforeCommission * (commissionPercentage / 100))
    : 0;
  
  const triggerPrice = htpTriggerBeforeCommission + commissionAmount;

  // Check if signal is triggered (only if current price is provided)
  const isTriggered = typeof currentPrice === 'number' && currentPrice >= triggerPrice;

  // Calculate current percentage gain if price is provided
  const currentPercentageGain = typeof currentPrice === 'number' 
    ? ((currentPrice - buyPrice) / buyPrice) * 100
    : undefined;

  return {
    triggerPrice,
    isTriggered,
    currentPercentageGain
  };
}

/**
 * Check if HTP signal is active for a specific wallet
 * @param buyPrice - Wallet buy price
 * @param htpPercentage - Stock-level HTP percentage
 * @param currentPrice - Current stock price
 * @param commissionPercentage - Optional commission percentage
 * @returns boolean indicating if HTP signal is triggered
 */
export function isHtpSignalActive(
  buyPrice: number,
  htpPercentage: number,
  currentPrice: number,
  commissionPercentage?: number | null | undefined
): boolean {
  try {
    const result = calculateHtpSignal(
      { buyPrice, htpPercentage, commissionPercentage },
      currentPrice
    );
    return result.isTriggered;
  } catch {
    return false;
  }
}

/**
 * Get HTP display value (percentage gain) if signal is active
 * @param buyPrice - Wallet buy price
 * @param htpPercentage - Stock-level HTP percentage
 * @param currentPrice - Current stock price
 * @param commissionPercentage - Optional commission percentage
 * @returns Formatted percentage string or '-' if not active
 */
export function getHtpDisplayValue(
  buyPrice: number,
  htpPercentage: number,
  currentPrice: number,
  commissionPercentage?: number | null | undefined
): string {
  try {
    const result = calculateHtpSignal(
      { buyPrice, htpPercentage, commissionPercentage },
      currentPrice
    );
    
    if (result.isTriggered && result.currentPercentageGain !== undefined) {
      return `${result.currentPercentageGain.toFixed(2)}%`;
    }
    
    return '-';
  } catch {
    return '-';
  }
}
