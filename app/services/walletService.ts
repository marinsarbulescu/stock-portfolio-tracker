// app/services/walletService.ts

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    CURRENCY_EPSILON,
    FETCH_LIMIT_FOR_UNIQUE_WALLET
} from '@/app/config/constants'; // Adjust path if needed

// Define client type based on your generateClient call
type AmplifyClient = ReturnType<typeof generateClient<Schema>>;

// Define the structure for stock-specific data needed (e.g., for TP calculation)
interface StockInfoForTp {
    owner: string;
    stp?: number | null; // Swing Take Profit percentage
    pdp?: number | null; // Add PDP for base TP calculation (still used for LBD)
    stockCommission?: number | null; // Add commission for TP adjustment
    // Add any other fields needed for TP calculation (e.g., specific overrides?)
}

// Define the return type for TP calculation (customize as needed)
interface TpCalculationResult {
    stpValue: number | null;
}

// --- Define a type representing ONLY the fields fetched by the internal query ---
// List only the fields present in the selectionSet below
type QueriedWalletData = Pick<Schema['StockWallet']['type'],
    'id' |
    'portfolioStockId' | // Keep FK if needed, but not the related object
    'walletType' |
    'buyPrice' |
    'totalSharesQty' |
    'totalInvestment' |
    'remainingShares' |
    'sharesSold' |
    'sellTxnCount' |
    'stpValue' |
    'createdAt' |
    'updatedAt'
>;
// --- End type definition ---

// --- Placeholder for TP Calculation Logic ---
// Commission-adjusted TP calculation function
function calculateTpForWallet(
    totalInvestment: number,
    totalShares: number,
    stockInfo: StockInfoForTp
): TpCalculationResult {
    const stp = stockInfo.stp;
    const stockCommission = stockInfo.stockCommission;

    let stpValue: number | null = null;
    
    if (typeof stp === 'number' && stp > 0 && 
        totalShares > SHARE_EPSILON && totalInvestment > CURRENCY_EPSILON) {
        
        const buyPrice = totalInvestment / totalShares;
        
        // Calculate base TP using the new STP formula
        const baseTP = buyPrice + (buyPrice * (stp / 100));
        // Apply commission adjustment if commission is available and > 0
        
        if (typeof stockCommission === 'number' && stockCommission > 0) {
            const commissionRate = stockCommission / 100;
            
            // Prevent division by zero or negative values
            if (commissionRate >= 1) {
                console.warn(`Commission rate (${stockCommission}%) is too high for wallet TP calculation, using base TP`);
                stpValue = baseTP;
            } else {
                // Commission-adjusted TP: baseTP / (1 - commissionRate)
                stpValue = baseTP / (1 - commissionRate);
            }
        } else {
            // No commission or invalid commission, use base TP
            stpValue = baseTP;
        }
    }

    return {
        stpValue: stpValue !== null ? parseFloat(stpValue.toFixed(4)) : null, // Use 4 decimal places for TP precision
    };
}
// --- End TP Calculation Placeholder ---


/**
 * Adjusts wallet totals based on a transaction's contribution.
 * Can handle adding (positive delta) or subtracting (negative delta).
 * Will create/delete wallets as needed based on the adjustment result.
 * Includes validation to prevent invalid states (e.g., negative remaining shares with sales).
 *
 * @param client Initialized Amplify GraphQL client instance
 * @param stockId The ID of the PortfolioStock
 * @param buyPrice The buy price associated with the wallet
 * @param type Wallet type ('Swing' or 'Hold')
 * @param sharesDelta Change in shares (+ve to add, -ve to subtract)
 * @param investmentDelta Change in investment (+ve to add, -ve to subtract)
 * @param stockInfo Stock-specific data needed for calculations (e.g., TP)
 */
export async function adjustWalletContribution(
    client: AmplifyClient,
    stockId: string,
    buyPrice: number,
    type: 'Swing' | 'Hold',
    sharesDelta: number,
    investmentDelta: number,
    stockInfo: StockInfoForTp,
    preFetchedWallet?: QueriedWalletData | null // <-- Add optional parameter
): Promise<void> {
    //const FETCH_LIMIT_FOR_UNIQUE_WALLET = 1000;
    
    if (Math.abs(sharesDelta) < SHARE_EPSILON && Math.abs(investmentDelta) < CURRENCY_EPSILON) {
        console.log(`[WalletService] No significant change for ${type} wallet at price ${buyPrice}. Skipping.`);
        return;
    }
     if (isNaN(buyPrice) || buyPrice < 0) {
         console.error(`[WalletService] Invalid buyPrice (${buyPrice}) provided for adjustment.`);
         throw new Error(`Invalid buy price provided for wallet adjustment.`);
    }

    console.log(`[WalletService] Adjusting ${type} wallet at price ${buyPrice}: SharesDelta ${sharesDelta.toFixed(SHARE_PRECISION)}, InvestmentDelta ${investmentDelta.toFixed(CURRENCY_PRECISION)}`);

    let walletToUpdate: QueriedWalletData | null | undefined = preFetchedWallet;

    // --- Only query if wallet wasn't pre-fetched ---
    if (walletToUpdate === null || typeof walletToUpdate === 'undefined') { // Check if argument was passed
        console.log(`[WalletService] Pre-fetched wallet for Price ${buyPrice} Type ${type} not provided. Querying...`);
        
        if (!stockInfo.owner) { // <--- ADD Guard for owner
            console.error("[WalletService] Owner ID is missing in stockInfo. Cannot query for wallet.");
            throw new Error("Owner ID is required to query for wallets.");
        }
        
        const { data: wallets, errors: findErrors } = await client.models.StockWallet.list({
            filter: {
                and: [
                    { portfolioStockId: { eq: stockId } },
                    { buyPrice: { eq: buyPrice } },
                    { walletType: { eq: type } },
                    { owner: { eq: stockInfo.owner } } // <--- ADDED OWNER FILTER
                ]
            },
            limit: FETCH_LIMIT_FOR_UNIQUE_WALLET,
            selectionSet: [
                'id', 'portfolioStockId', 'walletType', 'buyPrice',
                'totalSharesQty', 'totalInvestment', 'remainingShares',
                'sharesSold', 'sellTxnCount', 'stpValue',
                'createdAt', 'updatedAt', 'owner'
             ]
        });

        console.log(`[WalletService] Find Wallet Result for buyPrice ${buyPrice} walletType ${type} portfolioStockId ${stockId} owner ${stockInfo.owner}:`, { data: wallets, errors: findErrors }); // Keep log

        if (findErrors) {
            console.error(`[WalletService] Error finding ${type} wallet at price ${buyPrice}:`, findErrors);
            throw new Error(`Failed to find ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)} to apply adjustments.`);
        }
        walletToUpdate = wallets?.[0];
    } else {
        console.log(`[WalletService] Using pre-fetched wallet data for Price ${buyPrice} Type ${type}: ${walletToUpdate ? `ID ${walletToUpdate.id}` : 'Not Found'}`);
    }
    // --- End find logic ---

    if (walletToUpdate) {
        // --- Wallet Exists: Adjust ---
        console.log(`[WalletService] Found existing wallet ${walletToUpdate.id}. Proceeding with update.`);
        console.log(`[WalletService] Found existing ${type} wallet ${walletToUpdate.id} at price ${buyPrice}.`);
        const currentTotalShares = walletToUpdate.totalSharesQty ?? 0;
        const currentTotalInv = walletToUpdate.totalInvestment ?? 0;
        const currentRemaining = walletToUpdate.remainingShares ?? 0;
        const hasSales = (walletToUpdate.sharesSold ?? 0) > SHARE_EPSILON || (walletToUpdate.sellTxnCount ?? 0) > 0;

        const newTotalShares = currentTotalShares + sharesDelta;
        
        // *** FIX: Reset investment for empty wallets being reused ***
        // If the wallet has no remaining shares (was previously emptied), 
        // reset the investment to 0 before adding new investment
        const effectiveCurrentInv = (currentRemaining <= SHARE_EPSILON) ? 0 : currentTotalInv;
        if (currentRemaining <= SHARE_EPSILON && currentTotalInv > CURRENCY_EPSILON) {
            console.log(`[WalletService] Resetting investment for empty wallet ${walletToUpdate.id}: ${currentTotalInv.toFixed(CURRENCY_PRECISION)} -> 0 (remaining shares: ${currentRemaining.toFixed(SHARE_PRECISION)})`);
        }
        const newTotalInv = effectiveCurrentInv + investmentDelta;
        
        const newRemaining = currentRemaining + sharesDelta; // Adjust remaining by the same share delta

        // --- Validation ---
        if (newRemaining < -SHARE_EPSILON) {
            if (hasSales && sharesDelta < 0) {
                 console.error(`[WalletService] Validation failed: Subtracting ${Math.abs(sharesDelta)} shares would make remaining shares negative (${newRemaining.toFixed(SHARE_PRECISION)}) for ${type} wallet ${walletToUpdate.id} (Price: ${buyPrice}), which has sales.`);
                throw new Error(`Update Failed: Cannot apply changes. This edit would result in negative remaining shares for the ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)} due to existing sales.`);
            } else {
                 console.warn(`[WalletService] Potential issue: Remaining shares for ${type} wallet ${walletToUpdate.id} (Price: ${buyPrice}) is negative (${newRemaining.toFixed(SHARE_PRECISION)}) after adjustment. HasSales: ${hasSales}`);
            }
        }
        // Add other specific validations here if needed

        // --- Apply Changes ---
        const isZeroingOut = newTotalShares <= SHARE_EPSILON && newTotalInv <= CURRENCY_EPSILON && newRemaining <= SHARE_EPSILON;

        if (isZeroingOut) {
            // Adjustment zeroes out the wallet: Delete it
            console.log(`[WalletService] Deleting zeroed-out ${type} wallet ${walletToUpdate.id} (Price: ${buyPrice})`);
            const { errors: deleteErrors } = await client.models.StockWallet.delete({ id: walletToUpdate.id });
            if (deleteErrors) {
                 console.error(`[WalletService] Error deleting zeroed-out ${type} wallet ${walletToUpdate.id}:`, deleteErrors);
                 throw new Error(`Failed to delete zeroed-out ${type} wallet.`);
            }
        } else if (newTotalShares < -SHARE_EPSILON) {
             // Prevent update if total shares somehow end up significantly negative
             console.error(`[WalletService] Update Aborted: Cannot update ${type} wallet ${walletToUpdate.id} as total shares would become significantly negative (${newTotalShares.toFixed(SHARE_PRECISION)}).`);
             throw new Error(`Update Failed: Calculation resulted in negative total shares for the ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
        } else {
            // Update the existing wallet
            console.log(`[WalletService] Updating existing ${type} wallet ${walletToUpdate.id} (Price: ${buyPrice})`);

            // *** Recalculate TP ***
            const { stpValue } = calculateTpForWallet(newTotalInv, newTotalShares, stockInfo);

            const updatePayload: Partial<Schema['StockWallet']['type']> & { id: string } = {
                id: walletToUpdate.id,
                // Round values for storage consistency
                totalSharesQty: parseFloat(newTotalShares.toFixed(SHARE_PRECISION)),
                totalInvestment: parseFloat(newTotalInv.toFixed(CURRENCY_PRECISION)),
                remainingShares: parseFloat(newRemaining.toFixed(SHARE_PRECISION)),
                stpValue: stpValue,       // Add calculated STP
            };
            
            console.log(`[WalletService] Payload for UPDATE ${type} wallet ${walletToUpdate.id}:`, JSON.stringify(updatePayload)); // Log the payload
            const updateResult = await client.models.StockWallet.update(updatePayload); // Capture result
            console.log(`[WalletService] UPDATE Result for ${type} wallet ${walletToUpdate.id}:`, { data: updateResult.data, errors: updateResult.errors }); // Log result
            
            const { errors: updateErrors } = await client.models.StockWallet.update(updatePayload);
            if (updateErrors) {
                 console.error(`[WalletService] Error updating ${type} wallet ${walletToUpdate.id}:`, updateErrors);
                 throw new Error(`Failed to update ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
            }
        }

    } else if (sharesDelta > SHARE_EPSILON) {
        // --- Wallet Does NOT Exist & Adding Shares: Create ---
        console.log(`[WalletService] Did NOT find existing wallet. Proceeding with CREATE.`); // Log path taken
        console.log(`[WalletService] Creating new ${type} wallet at price ${buyPrice}`);

        // *** Calculate TP for new wallet ***
        const { stpValue } = calculateTpForWallet(investmentDelta, sharesDelta, stockInfo);

        const createPayload = {
            portfolioStockId: stockId,
            buyPrice: buyPrice,
            walletType: type,
            // Round values for storage consistency
            totalSharesQty: parseFloat(sharesDelta.toFixed(SHARE_PRECISION)),
            totalInvestment: parseFloat(investmentDelta.toFixed(CURRENCY_PRECISION)),
            remainingShares: parseFloat(sharesDelta.toFixed(SHARE_PRECISION)), // Initial remaining = total
            sharesSold: 0,
            realizedPl: 0,
            sellTxnCount: 0,
            stpValue: stpValue,       // Add calculated STP
            owner: stockInfo.owner,
        };

        const { data: newWallet, errors: createErrors } = await client.models.StockWallet.create(createPayload);
        if (createErrors) {
            console.error(`[WalletService] Error creating new ${type} wallet at price ${buyPrice}:`, createErrors);
            throw new Error(`Failed to create new ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
        }

        console.log(`[WalletService] Successfully created new wallet:`, newWallet);
    } else {
        // Wallet doesn't exist and not adding positive shares (e.g., subtracting from nothing) - do nothing.
         console.log(`[WalletService] No existing ${type} wallet at price ${buyPrice} to adjust, and not adding shares.`);
    }
}