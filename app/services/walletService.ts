// app/services/walletService.ts

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource'; // Adjust path if needed
import {
    SHARE_PRECISION,
    CURRENCY_PRECISION,
    PERCENT_PRECISION,
    SHARE_EPSILON,
    CURRENCY_EPSILON
} from '@/app/config/constants'; // Adjust path if needed

// Define client type based on your generateClient call
type AmplifyClient = ReturnType<typeof generateClient<Schema>>;

// Define the structure for stock-specific data needed (e.g., for TP calculation)
interface StockInfoForTp {
    plr?: number | null;
    // Add any other fields needed for TP calculation (e.g., pdp, specific overrides?)
}

// Define the return type for TP calculation (customize as needed)
interface TpCalculationResult {
    tpValue: number | null;
    tpPercent: number | null;
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
    'tpValue' |
    'tpPercent' |
    'createdAt' |
    'updatedAt'
>;
// --- End type definition ---

// --- Placeholder for TP Calculation Logic ---
// You MUST replace this with your actual TP calculation logic
function calculateTpForWallet(
    totalInvestment: number,
    totalShares: number,
    stockInfo: StockInfoForTp
): TpCalculationResult {
    console.warn("TP Calculation Logic is a placeholder in walletService.ts!");
    const plr = stockInfo.plr;

    // --- Replace with your actual logic ---
    // Example placeholder logic (likely incorrect for your needs):
    let tpValue: number | null = null;
    let tpPercent: number | null = null;
    if (typeof plr === 'number' && plr > 0 && totalShares > SHARE_EPSILON && totalInvestment > CURRENCY_EPSILON) {
        const buyPrice = totalInvestment / totalShares;
        // Example: TP = Buy Price * (1 + (PLR * some_factor?)) - Needs refinement
        tpValue = buyPrice * (1 + (plr * 0.1)); // <<< Placeholder calculation
        tpPercent = ((tpValue - buyPrice) / buyPrice) * 100; // <<< Placeholder calculation
    }
    // --- End Replace ---

    return {
        tpValue: tpValue !== null ? parseFloat(tpValue.toFixed(CURRENCY_PRECISION)) : null,
        tpPercent: tpPercent !== null ? parseFloat(tpPercent.toFixed(PERCENT_PRECISION)) : null,
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
    if (Math.abs(sharesDelta) < SHARE_EPSILON && Math.abs(investmentDelta) < CURRENCY_EPSILON) {
        console.log(`[WalletService] No significant change for ${type} wallet at price ${buyPrice}. Skipping.`);
        return;
    }
     if (isNaN(buyPrice) || buyPrice < 0) {
         console.error(`[WalletService] Invalid buyPrice (${buyPrice}) provided for adjustment.`);
         throw new Error(`Invalid buy price provided for wallet adjustment.`);
    }

    console.log(`[WalletService] Adjusting ${type} wallet at price ${buyPrice}: SharesDelta ${sharesDelta.toFixed(SHARE_PRECISION)}, InvestmentDelta ${investmentDelta.toFixed(CURRENCY_PRECISION)}`);

    let existingWallet: QueriedWalletData | null | undefined = preFetchedWallet;

    // --- Only query if wallet wasn't pre-fetched ---
    if (typeof existingWallet === 'undefined') { // Check if argument was passed
        console.log(`[WalletService] Pre-fetched wallet for Price ${buyPrice} Type ${type} not provided. Querying...`);
        const { data: wallets, errors: findErrors } = await client.models.StockWallet.list({
            filter: { and: [{ portfolioStockId: { eq: stockId } }, { buyPrice: { eq: buyPrice } }, { walletType: { eq: type } }] },
            limit: 1,
            selectionSet: [
                'id', 'portfolioStockId', 'walletType', 'buyPrice',
                'totalSharesQty', 'totalInvestment', 'remainingShares',
                'sharesSold', 'sellTxnCount', 'tpValue', 'tpPercent',
                'createdAt', 'updatedAt'
             ]
        });

        console.log(`[WalletService] Find Wallet Result for Price ${buyPrice} Type ${type}:`, { data: wallets, errors: findErrors }); // Keep log

        if (findErrors) {
            console.error(`[WalletService] Error finding ${type} wallet at price ${buyPrice}:`, findErrors);
            throw new Error(`Failed to find ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)} to apply adjustments.`);
        }
        existingWallet = wallets?.[0];
    } else {
        console.log(`[WalletService] Using pre-fetched wallet data for Price ${buyPrice} Type ${type}: ${existingWallet ? `ID ${existingWallet.id}` : 'Not Found'}`);
    }
    // --- End find logic ---

    if (existingWallet) {
        // --- Wallet Exists: Adjust ---
        console.log(`[WalletService] Found existing wallet ${existingWallet.id}. Proceeding with update.`);
        console.log(`[WalletService] Found existing ${type} wallet ${existingWallet.id} at price ${buyPrice}.`);
        const currentTotalShares = existingWallet.totalSharesQty ?? 0;
        const currentTotalInv = existingWallet.totalInvestment ?? 0;
        const currentRemaining = existingWallet.remainingShares ?? 0;
        const hasSales = (existingWallet.sharesSold ?? 0) > SHARE_EPSILON || (existingWallet.sellTxnCount ?? 0) > 0;

        const newTotalShares = currentTotalShares + sharesDelta;
        const newTotalInv = currentTotalInv + investmentDelta;
        const newRemaining = currentRemaining + sharesDelta; // Adjust remaining by the same share delta

        // --- Validation ---
        if (newRemaining < -SHARE_EPSILON) {
            if (hasSales && sharesDelta < 0) {
                 console.error(`[WalletService] Validation failed: Subtracting ${Math.abs(sharesDelta)} shares would make remaining shares negative (${newRemaining.toFixed(SHARE_PRECISION)}) for ${type} wallet ${existingWallet.id} (Price: ${buyPrice}), which has sales.`);
                throw new Error(`Update Failed: Cannot apply changes. This edit would result in negative remaining shares for the ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)} due to existing sales.`);
            } else {
                 console.warn(`[WalletService] Potential issue: Remaining shares for ${type} wallet ${existingWallet.id} (Price: ${buyPrice}) is negative (${newRemaining.toFixed(SHARE_PRECISION)}) after adjustment. HasSales: ${hasSales}`);
            }
        }
        // Add other specific validations here if needed

        // --- Apply Changes ---
        const isZeroingOut = newTotalShares <= SHARE_EPSILON && newTotalInv <= CURRENCY_EPSILON && newRemaining <= SHARE_EPSILON;

        if (isZeroingOut) {
            // Adjustment zeroes out the wallet: Delete it
            console.log(`[WalletService] Deleting zeroed-out ${type} wallet ${existingWallet.id} (Price: ${buyPrice})`);
            const { errors: deleteErrors } = await client.models.StockWallet.delete({ id: existingWallet.id });
            if (deleteErrors) {
                 console.error(`[WalletService] Error deleting zeroed-out ${type} wallet ${existingWallet.id}:`, deleteErrors);
                 throw new Error(`Failed to delete zeroed-out ${type} wallet.`);
            }
        } else if (newTotalShares < -SHARE_EPSILON) {
             // Prevent update if total shares somehow end up significantly negative
             console.error(`[WalletService] Update Aborted: Cannot update ${type} wallet ${existingWallet.id} as total shares would become significantly negative (${newTotalShares.toFixed(SHARE_PRECISION)}).`);
             throw new Error(`Update Failed: Calculation resulted in negative total shares for the ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
        } else {
            // Update the existing wallet
            console.log(`[WalletService] Updating existing ${type} wallet ${existingWallet.id} (Price: ${buyPrice})`);

            // *** Recalculate TP ***
            const { tpValue, tpPercent } = calculateTpForWallet(newTotalInv, newTotalShares, stockInfo);

            const updatePayload: Partial<Schema['StockWallet']['type']> & { id: string } = {
                id: existingWallet.id,
                // Round values for storage consistency
                totalSharesQty: parseFloat(newTotalShares.toFixed(SHARE_PRECISION)),
                totalInvestment: parseFloat(newTotalInv.toFixed(CURRENCY_PRECISION)),
                remainingShares: parseFloat(newRemaining.toFixed(SHARE_PRECISION)),
                tpValue: tpValue,       // Add calculated TP
                tpPercent: tpPercent,   // Add calculated TP %
            };
            
            console.log(`[WalletService] Payload for UPDATE ${type} wallet ${existingWallet.id}:`, JSON.stringify(updatePayload)); // Log the payload
            const updateResult = await client.models.StockWallet.update(updatePayload); // Capture result
            console.log(`[WalletService] UPDATE Result for ${type} wallet ${existingWallet.id}:`, { data: updateResult.data, errors: updateResult.errors }); // Log result
            
            const { errors: updateErrors } = await client.models.StockWallet.update(updatePayload);
            if (updateErrors) {
                 console.error(`[WalletService] Error updating ${type} wallet ${existingWallet.id}:`, updateErrors);
                 throw new Error(`Failed to update ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
            }
        }

    } else if (sharesDelta > SHARE_EPSILON) {
        // --- Wallet Does NOT Exist & Adding Shares: Create ---
        console.log(`[WalletService] Did NOT find existing wallet. Proceeding with CREATE.`); // Log path taken
        console.log(`[WalletService] Creating new ${type} wallet at price ${buyPrice}`);

        // *** Calculate TP for new wallet ***
        const { tpValue, tpPercent } = calculateTpForWallet(investmentDelta, sharesDelta, stockInfo);

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
            tpValue: tpValue,       // Add calculated TP
            tpPercent: tpPercent,   // Add calculated TP %
        };

        const { errors: createErrors } = await client.models.StockWallet.create(createPayload);
        if (createErrors) {
            console.error(`[WalletService] Error creating new ${type} wallet at price ${buyPrice}:`, createErrors);
            throw new Error(`Failed to create new ${type} wallet at price $${buyPrice.toFixed(CURRENCY_PRECISION)}.`);
        }
    } else {
        // Wallet doesn't exist and not adding positive shares (e.g., subtracting from nothing) - do nothing.
         console.log(`[WalletService] No existing ${type} wallet at price ${buyPrice} to adjust, and not adding shares.`);
    }
}