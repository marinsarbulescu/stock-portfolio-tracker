/**
 * Import RNMBY transaction history from production to beta
 *
 * Prerequisites:
 * 1. RNMBY asset must exist in beta with commission set
 * 2. Entry Target: -4%
 * 3. Profit Targets: 8% (sortOrder 1), 16% (sortOrder 2)
 * 4. Sandbox must be running (npx ampx sandbox)
 *
 * Usage:
 * EMAIL=your@email.com PASSWORD=yourpassword npx ts-node scripts/import-rnmby.ts
 */

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { signIn, signOut } from "aws-amplify/auth";
import type { Schema } from "../amplify/data/resource";

// Load Amplify config
import outputs from "../amplify_outputs.json";

// Configure Amplify
Amplify.configure(outputs);

const client = generateClient<Schema>();

// Signal mapping from production to beta
const SIGNAL_MAP: Record<string, "REPULL" | "CUSTOM" | "INITIAL" | "EOM" | "ENTAR" | "TP"> = {
  "_5DD": "REPULL",
  "LBD": "ENTAR",
  "Cust": "CUSTOM",
  "Initial": "INITIAL",
  "TP": "TP",
};

// Interfaces
interface OldTransaction {
  id: string;
  action: string;
  date: string;
  signal: string;
  price: string;
  quantity: string;
  investment: string;
  txnType: string;
  completedTxnId: string;
}

interface OldWallet {
  id: string;
  buyPrice: string;
  walletType: string;
}

interface ProfitTargetInfo {
  id: string;
  targetPercent: number;
}

// Load and parse CSVs
function loadCSV<T>(filename: string): T[] {
  const filepath = join(__dirname, "data", filename);
  const content = readFileSync(filepath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

// Main import function
async function importRNMBY() {
  console.log("🚀 Starting RNMBY import...\n");

  // Check credentials
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;

  if (!email || !password) {
    console.error("❌ Missing credentials. Run with:");
    console.error("   EMAIL=your@email.com PASSWORD=yourpassword npx ts-node scripts/import-rnmby.ts");
    process.exit(1);
  }

  // Sign in
  console.log("🔐 Signing in...");
  try {
    await signIn({ username: email, password });
    console.log("✅ Signed in successfully\n");
  } catch (error) {
    console.error("❌ Sign in failed:", error);
    process.exit(1);
  }

  try {
    // Load data
    console.log("📂 Loading CSV files...");
    const transactions = loadCSV<OldTransaction>("RNMBY transactions.csv");
    const wallets = loadCSV<OldWallet>("RNMBY wallets.csv");
    console.log(`   Found ${transactions.length} transactions`);
    console.log(`   Found ${wallets.length} wallets\n`);

    // Build wallet lookup map
    const walletMap = new Map<string, { buyPrice: number; walletType: string }>();
    for (const w of wallets) {
      walletMap.set(w.id, {
        buyPrice: parseFloat(w.buyPrice),
        walletType: w.walletType,
      });
    }

    // Sort transactions by date (oldest first)
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    console.log("📊 Transactions sorted by date\n");

    // Get RNMBY asset
    console.log("🔍 Looking up RNMBY asset...");
    const { data: assets } = await client.models.Asset.list({
      filter: { symbol: { eq: "RNMBY" } },
    });

    if (!assets || assets.length === 0) {
      console.error("❌ RNMBY asset not found. Please create it first.");
      process.exit(1);
    }

    const asset = assets[0];
    console.log(`   Found asset: ${asset.symbol} (${asset.id})`);
    console.log(`   Commission: ${asset.commission}%\n`);

    // Get Profit Targets
    console.log("🎯 Looking up Profit Targets...");
    const { data: profitTargets } = await client.models.ProfitTarget.list({
      filter: { assetId: { eq: asset.id } },
    });

    if (!profitTargets || profitTargets.length < 2) {
      console.error("❌ Need at least 2 Profit Targets (8% and 16%). Please create them first.");
      process.exit(1);
    }

    // Sort by sortOrder and identify PT8 and PT16
    profitTargets.sort((a, b) => a.sortOrder - b.sortOrder);
    const pt8 = profitTargets.find(pt => pt.targetPercent === 8);
    const pt16 = profitTargets.find(pt => pt.targetPercent === 16);

    if (!pt8 || !pt16) {
      console.error("❌ Could not find PT 8% and PT 16%");
      console.log("   Found PTs:", profitTargets.map(pt => `${pt.targetPercent}%`).join(", "));
      process.exit(1);
    }

    console.log(`   PT 8%: ${pt8.id}`);
    console.log(`   PT 16%: ${pt16.id}\n`);

    // Get Entry Target
    console.log("📉 Looking up Entry Target...");
    const { data: entryTargets } = await client.models.EntryTarget.list({
      filter: { assetId: { eq: asset.id } },
    });

    if (!entryTargets || entryTargets.length === 0) {
      console.error("❌ No Entry Target found. Please create ET -4% first.");
      process.exit(1);
    }

    entryTargets.sort((a, b) => a.sortOrder - b.sortOrder);
    const et = entryTargets[0];
    console.log(`   ET: ${et.targetPercent}%\n`);

    // Track created wallets for sell operations
    const betaWallets = new Map<string, { id: string; shares: number }>();

    // Process each transaction
    console.log("⚙️ Processing transactions...\n");
    let buyCount = 0;
    let sellCount = 0;

    for (const txn of transactions) {
      const date = new Date(txn.date).toISOString();

      if (txn.action === "Buy") {
        await processBuy(txn, date, asset, pt8, pt16, et, betaWallets);
        buyCount++;
      } else if (txn.action === "Sell") {
        await processSell(txn, date, asset, pt8, pt16, walletMap, betaWallets);
        sellCount++;
      }
    }

    console.log("\n✅ Import complete!");
    console.log(`   BUY transactions: ${buyCount}`);
    console.log(`   SELL transactions: ${sellCount}`);

  } finally {
    // Sign out
    await signOut();
    console.log("\n🔓 Signed out");
  }
}

async function processBuy(
  txn: OldTransaction,
  date: string,
  asset: { id: string; commission: number | null },
  pt8: ProfitTargetInfo,
  pt16: ProfitTargetInfo,
  et: { targetPercent: number },
  betaWallets: Map<string, { id: string; shares: number }>
) {
  const price = parseFloat(txn.price);
  const quantity = parseFloat(txn.quantity);
  const investment = parseFloat(txn.investment);
  const signal = SIGNAL_MAP[txn.signal] || "CUSTOM";

  // Calculate ET values
  const entryTargetPercent = et.targetPercent;
  const entryTargetPrice = price * (1 - Math.abs(entryTargetPercent) / 100);

  console.log(`📥 BUY ${txn.date}: ${quantity} @ $${price.toFixed(2)} (${txn.signal} → ${signal})`);

  // Create Transaction
  const { data: newTxn } = await client.models.Transaction.create({
    type: "BUY",
    date,
    signal,
    price,
    quantity,
    investment,
    entryTargetPrice,
    entryTargetPercent,
    assetId: asset.id,
  });

  if (!newTxn) {
    console.error("   ❌ Failed to create transaction");
    return;
  }

  // Determine allocation based on txnType
  const allocations = getAllocations(txn.txnType, quantity, pt8, pt16);

  for (const alloc of allocations) {
    // Create or update Wallet FIRST to get wallet ID
    const walletId = await upsertWallet(
      asset.id,
      alloc.ptId,
      price,
      alloc.shares * price, // investment for this allocation
      alloc.shares,
      alloc.targetPercent,
      asset.commission || 0,
      betaWallets
    );

    // Create TransactionAllocation with walletId
    if (walletId) {
      await client.models.TransactionAllocation.create({
        transactionId: newTxn.id,
        profitTargetId: alloc.ptId,
        walletId,
        percentage: alloc.percentage,
        shares: alloc.shares,
      });
    }
  }
}

async function processSell(
  txn: OldTransaction,
  date: string,
  asset: { id: string },
  pt8: ProfitTargetInfo,
  pt16: ProfitTargetInfo,
  walletMap: Map<string, { buyPrice: number; walletType: string }>,
  betaWallets: Map<string, { id: string; shares: number }>
) {
  const sellPrice = parseFloat(txn.price);
  const quantity = parseFloat(txn.quantity);
  const signal = SIGNAL_MAP[txn.signal] || "TP";

  // Look up the original wallet to get buy price
  const oldWallet = walletMap.get(txn.completedTxnId);
  if (!oldWallet) {
    console.error(`   ❌ Could not find wallet ${txn.completedTxnId} for sell`);
    return;
  }

  const buyPrice = oldWallet.buyPrice;

  // Determine PT based on wallet type
  const pt = oldWallet.walletType === "Hold" ? pt16 : pt8;

  console.log(`📤 SELL ${txn.date}: ${quantity} @ $${sellPrice.toFixed(2)} from $${buyPrice.toFixed(2)} wallet (${oldWallet.walletType} → PT ${pt.targetPercent}%)`);

  // Find the beta wallet
  const walletKey = `${asset.id}-${pt.id}-${buyPrice}`;
  const betaWallet = betaWallets.get(walletKey);

  if (!betaWallet) {
    console.error(`   ❌ Could not find beta wallet for key ${walletKey}`);
    return;
  }

  // Calculate sell values
  const costBasis = buyPrice * quantity;
  const amount = sellPrice * quantity;

  // Create SELL transaction
  const { data: newTxn } = await client.models.Transaction.create({
    type: "SELL",
    date,
    signal,
    price: sellPrice,
    quantity,
    amount,
    costBasis,
    assetId: asset.id,
    walletId: betaWallet.id,
  });

  if (!newTxn) {
    console.error("   ❌ Failed to create sell transaction");
    return;
  }

  // Update wallet shares
  const newShares = betaWallet.shares - quantity;

  if (newShares <= 0.0001) {
    // Delete wallet if empty
    await client.models.Wallet.delete({ id: betaWallet.id });
    betaWallets.delete(walletKey);
    console.log(`   🗑️ Wallet deleted (empty)`);
  } else {
    // Update wallet
    await client.models.Wallet.update({
      id: betaWallet.id,
      shares: newShares,
      investment: newShares * buyPrice,
    });
    betaWallet.shares = newShares;
    console.log(`   📊 Wallet updated: ${newShares.toFixed(5)} shares remaining`);
  }
}

function getAllocations(
  txnType: string,
  quantity: number,
  pt8: ProfitTargetInfo,
  pt16: ProfitTargetInfo
): { ptId: string; percentage: number; shares: number; targetPercent: number }[] {
  if (txnType === "Hold") {
    return [{ ptId: pt16.id, percentage: 100, shares: quantity, targetPercent: pt16.targetPercent }];
  } else if (txnType === "Swing") {
    return [{ ptId: pt8.id, percentage: 100, shares: quantity, targetPercent: pt8.targetPercent }];
  } else if (txnType === "Split") {
    const halfShares = quantity / 2;
    return [
      { ptId: pt8.id, percentage: 50, shares: halfShares, targetPercent: pt8.targetPercent },
      { ptId: pt16.id, percentage: 50, shares: halfShares, targetPercent: pt16.targetPercent },
    ];
  }
  // Default to Swing
  return [{ ptId: pt8.id, percentage: 100, shares: quantity, targetPercent: pt8.targetPercent }];
}

async function upsertWallet(
  assetId: string,
  profitTargetId: string,
  price: number,
  investment: number,
  shares: number,
  targetPercent: number,
  commission: number,
  betaWallets: Map<string, { id: string; shares: number }>
): Promise<string | undefined> {
  const walletKey = `${assetId}-${profitTargetId}-${price}`;

  // Calculate profit target price
  const profitTargetPrice = (price * (1 + targetPercent / 100)) / (1 - commission / 100);

  const existing = betaWallets.get(walletKey);

  if (existing) {
    // Update existing wallet
    const newShares = existing.shares + shares;
    await client.models.Wallet.update({
      id: existing.id,
      shares: newShares,
      investment: newShares * price,
    });
    existing.shares = newShares;
    console.log(`   📊 Wallet updated: ${newShares.toFixed(5)} shares @ $${price.toFixed(2)}`);
    return existing.id;
  } else {
    // Create new wallet
    const { data: newWallet } = await client.models.Wallet.create({
      assetId,
      profitTargetId,
      price,
      investment,
      shares,
      profitTargetPrice,
    });

    if (newWallet) {
      betaWallets.set(walletKey, { id: newWallet.id, shares });
      console.log(`   💼 Wallet created: ${shares.toFixed(5)} shares @ $${price.toFixed(2)} (PT: $${profitTargetPrice.toFixed(2)})`);
      return newWallet.id;
    }
  }
  return undefined;
}

// Run
importRNMBY().catch(console.error);
