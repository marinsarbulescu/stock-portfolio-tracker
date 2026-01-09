"use client";

import { useState, useMemo } from "react";

interface TestItem {
  id: string;
  name: string;
  specFile: string;
  describeName: string;
}

const tests: TestItem[] = [
  {
    id: "auth-1",
    name: "authentication flow - redirect, form display, and successful login",
    specFile: "login.spec.ts",
    describeName: "Authentication",
  },
  {
    id: "crud-1",
    name: "AssetCRUD - Create, Edit, and Delete asset",
    specFile: "assets/asset-crud.spec.ts",
    describeName: "Assets - CRUD Operations",
  },
  {
    id: "targets-1",
    name: "AssetTargets - Entry Target and Profit Target CRUD",
    specFile: "assets/asset-targets-crud.spec.ts",
    describeName: "Assets - ET/PT CRUD",
  },
  {
    id: "buy-1",
    name: "TransactionBuyCRUD - Create BUY transaction and verify",
    specFile: "transactions/transaction-buy-crud.spec.ts",
    describeName: "Transactions - BUY CRUD",
  },
  {
    id: "sell-1",
    name: "TransactionSellCRUD - SELL transaction CRUD",
    specFile: "transactions/transaction-sell-crud.spec.ts",
    describeName: "Transactions - SELL CRUD",
  },
  {
    id: "dashboard-signals-1",
    name: "DashboardSignals - Verify %2PT colors in Dashboard and Wallets tables",
    specFile: "dashboard/dashboard-signals.spec.ts",
    describeName: "Dashboard Signals - %2PT Color Logic",
  },
  {
    id: "asset-roi-1",
    name: "ROI Calculation - ROI calculation verification",
    specFile: "assets/asset-roi.spec.ts",
    describeName: "Assets - ROI Calculation",
  },
  {
    id: "asset-pt-crud-1",
    name: "AssetPTCRUD - PT Delete Protection and Allocation Redistribution",
    specFile: "assets/asset-pt-crud.spec.ts",
    describeName: "Assets - PT CRUD",
  },
  {
    id: "transaction-split-1",
    name: "TransactionSplit - BUY, SELL, SPLIT with verification",
    specFile: "transactions/transaction-split.spec.ts",
    describeName: "Transactions - Split",
  },
  {
    id: "transaction-historical-reversal-1",
    name: "TransactionHistoricalReversal - Create and delete in reverse",
    specFile: "transactions/transaction-historical-reversal.spec.ts",
    describeName: "Transactions - Historical Reversal",
  },
];

// Group tests by describeName
function groupTestsByDescribe(testList: TestItem[]) {
  const groups: Record<string, TestItem[]> = {};
  for (const test of testList) {
    if (!groups[test.describeName]) {
      groups[test.describeName] = [];
    }
    groups[test.describeName].push(test);
  }
  return groups;
}

export default function E2EManagerPage() {
  const [selectedTests, setSelectedTests] = useState<Set<string>>(
    new Set(tests.map((t) => t.id))
  );
  const [headedMode, setHeadedMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const groupedTests = useMemo(() => groupTestsByDescribe(tests), []);

  const selectedCount = selectedTests.size;
  const allSelected = selectedCount === tests.length;
  const noneSelected = selectedCount === 0;

  function toggleTest(id: string) {
    const newSet = new Set(selectedTests);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTests(newSet);
  }

  function selectAll() {
    setSelectedTests(new Set(tests.map((t) => t.id)));
  }

  function deselectAll() {
    setSelectedTests(new Set());
  }

  // Generate the CLI command
  const command = useMemo(() => {
    if (noneSelected) return "# No tests selected";

    const parts = ["npx playwright test"];

    // If not all tests selected, use --grep
    if (!allSelected) {
      const selectedTestNames = tests
        .filter((t) => selectedTests.has(t.id))
        .map((t) => t.name);
      // Escape special regex characters and join with |
      const grepPattern = selectedTestNames
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      parts.push(`--grep "${grepPattern}"`);
    }

    // Workers = number of selected tests
    parts.push(`--workers=${selectedCount}`);

    // Headed mode
    if (headedMode) {
      parts.push("--headed");
    }

    return parts.join(" ");
  }, [selectedTests, selectedCount, allSelected, noneSelected, headedMode]);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">E2E Test Manager</h2>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={selectAll}
          disabled={allSelected}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select All
        </button>
        <button
          onClick={deselectAll}
          disabled={noneSelected}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Deselect All
        </button>
      </div>

      {/* Test Groups */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        {Object.entries(groupedTests).map(([describeName, groupTests]) => (
          <div key={describeName} className="mb-4 last:mb-0">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {describeName}{" "}
              <span className="text-xs">({groupTests[0].specFile})</span>
            </div>
            <div className="space-y-2 ml-4">
              {groupTests.map((test) => (
                <label
                  key={test.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.has(test.id)}
                    onChange={() => toggleTest(test.id)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-card-foreground">{test.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Options */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-2">Options</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={headedMode}
            onChange={(e) => setHeadedMode(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm text-card-foreground">Headed mode (show browser)</span>
        </label>
      </div>

      {/* Generated Command */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-muted-foreground">
            Command ({selectedCount} test{selectedCount !== 1 ? "s" : ""}, {selectedCount} worker{selectedCount !== 1 ? "s" : ""})
          </div>
          <button
            onClick={copyCommand}
            disabled={noneSelected}
            className="px-3 py-1 text-xs bg-foreground text-background rounded hover:opacity-90 disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-background border border-border rounded p-3 font-mono text-sm text-foreground overflow-x-auto">
          {command}
        </div>
      </div>
    </div>
  );
}
