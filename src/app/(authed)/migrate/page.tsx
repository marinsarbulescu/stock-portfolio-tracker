"use client";

import { useState } from "react";
import Link from "next/link";
import { migrateWallets } from "@/utils/migrate-wallets";

interface MigrationResult {
  assetId: string;
  symbol: string;
  oldWalletCount: number;
  newWalletCount: number;
  totalInvestmentBefore: number;
  totalInvestmentAfter: number;
}

export default function MigratePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMigrate() {
    if (!confirm("This will rebuild all wallets based on transaction allocations. Continue?")) {
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const migrationResults = await migrateWallets();
      setResults(migrationResults);
    } catch (err) {
      console.error("Migration error:", err);
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/assets"
          className="text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Assets
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">
        Wallet Migration
      </h2>

      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">What this does:</h3>
        <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
          <li>Rebuilds all wallets based on transaction allocations</li>
          <li>Each wallet will now be linked to a specific profit target</li>
          <li>Total investment amounts should remain the same</li>
        </ul>

        <button
          onClick={handleMigrate}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? "Running Migration..." : "Run Migration"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 p-4 rounded-lg mb-6">
          Error: {error}
        </div>
      )}

      {results && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Migration Results</h3>
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-2">Asset</th>
                <th className="pb-2">Old Wallets</th>
                <th className="pb-2">New Wallets</th>
                <th className="pb-2">Investment Before</th>
                <th className="pb-2">Investment After</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const match = Math.abs(r.totalInvestmentBefore - r.totalInvestmentAfter) < 0.01;
                return (
                  <tr key={r.assetId} className="border-b border-border/50">
                    <td className="py-2 font-medium">{r.symbol}</td>
                    <td className="py-2">{r.oldWalletCount}</td>
                    <td className="py-2">{r.newWalletCount}</td>
                    <td className="py-2">${r.totalInvestmentBefore.toFixed(2)}</td>
                    <td className="py-2">${r.totalInvestmentAfter.toFixed(2)}</td>
                    <td className="py-2">
                      {match ? (
                        <span className="text-green-400">OK</span>
                      ) : (
                        <span className="text-yellow-400">Mismatch</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
