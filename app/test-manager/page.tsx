// app/test-manager/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import './test-manager.css';
import { useOwnerId } from '../hooks/useOwnerId';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Hardcoded dev owner ID for test-manager access
const DEV_OWNER_ID = 'e10b55e0-9031-70db-23f9-cdf5d997659c::e10b55e0-9031-70db-23f9-cdf5d997659c';

interface TestConfig {
  name: string;
  enabled: boolean;
  file: string;
  description: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: string;
}

interface TestSuite {
  enabled: boolean;
  description: string;
  tests: TestConfig[];
}

interface Preset {
  description: string;
  [key: string]: unknown;
}

interface TestSuiteConfig {
  testSuites: Record<string, TestSuite>;
  globalSettings: {
    runOnlyEnabledSuites: boolean;
    runOnlyEnabledTests: boolean;
    parallelExecution: boolean;
    headless: boolean;
    workers: number;
    retries: number;
    timeout: number;
    browser: string;
  };
  presets: Record<string, Preset>;
}

interface ClearSelections {
  portfolio: boolean;
  transactions: boolean;
  wallets: boolean;
}

interface ClearStatus {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function TestManager() {
  const [config, setConfig] = useState<TestSuiteConfig | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Clear dev tables state
  const [clearSelections, setClearSelections] = useState<ClearSelections>({
    portfolio: false,
    transactions: false,
    wallets: false
  });
  const [clearLoading, setClearLoading] = useState(false);
  const [clearStatus, setClearStatus] = useState<ClearStatus | null>(null);

  // Owner ID check for access control
  const { ownerId, isLoading: ownerLoading } = useOwnerId();

  const loadTestConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/test-config');
      if (!response.ok) {
        throw new Error('Failed to load test configuration');
      }
      const data = await response.json();
      
      // Calculate optimal worker count based on total tests
      const totalTests = calculateTotalTests(data.testSuites);
      const optimalWorkers = totalTests; // No cap, match test count
      
      // Update the config with optimal settings
      const updatedConfig = {
        ...data,
        globalSettings: {
          ...data.globalSettings,
          headless: true, // Default to headless
          workers: optimalWorkers // Set workers to match test count
        }
      };
      
      setConfig(updatedConfig);
      
      // Save the updated config back to the server
      await updateTestConfig(updatedConfig);
    } catch (err) {
      setError('Failed to load test configuration. Make sure the server is running.');
      console.error('Error loading test config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestConfig();
  }, [loadTestConfig]);

  const calculateTotalTests = (testSuites: Record<string, TestSuite>) => {
    let totalTests = 0;
    for (const suite of Object.values(testSuites)) {
      totalTests += suite.tests.length;
    }
    return totalTests;
  };

  const getEnabledTestCount = (testSuites: Record<string, TestSuite>) => {
    let enabledTests = 0;
    for (const suite of Object.values(testSuites)) {
      if (suite.enabled) {
        for (const test of suite.tests) {
          if (test.enabled) {
            enabledTests++;
          }
        }
      }
    }
    return enabledTests;
  };

  const updateTestConfig = async (newConfig: TestSuiteConfig) => {
    try {
      const response = await fetch('/api/test-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }
      
      setConfig(newConfig);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save configuration');
    }
  };

  const toggleSuite = (suiteName: string, enabled: boolean) => {
    if (!config) return;
    
    const newConfig = {
      ...config,
      testSuites: {
        ...config.testSuites,
        [suiteName]: {
          ...config.testSuites[suiteName],
          enabled
        }
      }
    };
    
    // Auto-adjust workers based on enabled tests
    const enabledTestCount = getEnabledTestCount(newConfig.testSuites);
    newConfig.globalSettings.workers = Math.max(enabledTestCount, 1);
    
    updateTestConfig(newConfig);
  };

  const toggleTest = (suiteName: string, testName: string, enabled: boolean) => {
    if (!config) return;
    
    const suite = config.testSuites[suiteName];
    const updatedTests = suite.tests.map(test =>
      test.name === testName ? { ...test, enabled } : test
    );
    
    const newConfig = {
      ...config,
      testSuites: {
        ...config.testSuites,
        [suiteName]: {
          ...suite,
          tests: updatedTests
        }
      }
    };
    
    // Auto-adjust workers based on enabled tests
    const enabledTestCount = getEnabledTestCount(newConfig.testSuites);
    newConfig.globalSettings.workers = Math.max(enabledTestCount, 1);
    
    updateTestConfig(newConfig);
  };

  const updateGlobalSetting = (key: keyof TestSuiteConfig['globalSettings'], value: unknown) => {
    if (!config) return;
    
    const newConfig = {
      ...config,
      globalSettings: {
        ...config.globalSettings,
        [key]: value
      }
    };
    
    updateTestConfig(newConfig);
  };

  const generateCommand = () => {
    if (!config) return 'npm run e2e:run';
    
    const enabledFiles: string[] = [];
    for (const [, suite] of Object.entries(config.testSuites)) {
      if (suite.enabled) {
        for (const test of suite.tests) {
          if (test.enabled) {
            enabledFiles.push(test.file);
          }
        }
      }
    }

    let command = 'npx playwright test';
    
    // Add headed/headless flag
    if (!config.globalSettings.headless) {
      command += ' --headed';
    }
    
    // Add workers setting
    if (config.globalSettings.workers && config.globalSettings.workers > 0) {
      command += ` --workers=${config.globalSettings.workers}`;
    }
    
    // Add browser setting
    if (config.globalSettings.browser && config.globalSettings.browser !== 'chromium') {
      command += ` --project=${config.globalSettings.browser}`;
    }
    
    // Add retries setting
    if (config.globalSettings.retries && config.globalSettings.retries > 0) {
      command += ` --retries=${config.globalSettings.retries}`;
    }
    
    // Add file list
    if (enabledFiles.length > 0) {
      command += ' ' + enabledFiles.join(' ');
    }

    return command;
  };

  const getStats = () => {
    if (!config) return { totalTests: 0, enabledTests: 0, totalSuites: 0, enabledSuites: 0 };
    
    let totalTests = 0;
    let enabledTests = 0;
    let totalSuites = 0;
    let enabledSuites = 0;

    for (const [, suite] of Object.entries(config.testSuites)) {
      totalSuites++;
      if (suite.enabled) enabledSuites++;
      
      for (const test of suite.tests) {
        totalTests++;
        if (test.enabled && suite.enabled) {
          enabledTests++;
        }
      }
    }

    return { totalTests, enabledTests, totalSuites, enabledSuites };
  };

  const runTests = async () => {
    const command = generateCommand();
    
    try {
      await navigator.clipboard.writeText(command);
      alert(`✅ Command copied to clipboard!\n\n${command}\n\nPaste this command in your terminal to run the tests.`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert(`Command:\n${command}\n\nCopy this command manually and run it in your terminal.`);
    }
  };

  // Clear dev tables functions
  const hasAnySelection = (): boolean => {
    return clearSelections.portfolio || clearSelections.transactions || clearSelections.wallets;
  };

  const clearSelectedTables = async () => {
    if (!hasAnySelection()) {
      setClearStatus({ type: 'error', message: 'Please select at least one table to clear' });
      return;
    }

    setClearLoading(true);
    setClearStatus({ type: 'info', message: 'Clearing selected tables...' });

    try {
      const client = generateClient<Schema>();
      let clearCount = 0;

      // Helper function to delete all records from a table with pagination
      const deleteAllRecords = async (modelType: 'PortfolioStock' | 'Transaction' | 'StockWallet') => {
        let hasMoreRecords = true;
        let deletedCount = 0;
        
        while (hasMoreRecords) {
          let response;
          
          // Fetch records with limit
          switch (modelType) {
            case 'PortfolioStock':
              response = await client.models.PortfolioStock.list({
                selectionSet: ['id', 'symbol'],
                limit: 1000
              });
              break;
            case 'Transaction':
              response = await client.models.Transaction.list({
                selectionSet: ['id'],
                limit: 1000
              });
              break;
            case 'StockWallet':
              response = await client.models.StockWallet.list({
                selectionSet: ['id'],
                limit: 1000
              });
              break;
          }
          
          const { data: records } = response;
          
          if (!records || records.length === 0) {
            hasMoreRecords = false;
            break;
          }
          
          // Delete all records in this batch
          for (const record of records) {
            switch (modelType) {
              case 'PortfolioStock':
                await client.models.PortfolioStock.delete({ id: record.id });
                break;
              case 'Transaction':
                await client.models.Transaction.delete({ id: record.id });
                break;
              case 'StockWallet':
                await client.models.StockWallet.delete({ id: record.id });
                break;
            }
            deletedCount++;
          }
          
          // If we got fewer records than the limit, we're done
          if (records.length < 1000) {
            hasMoreRecords = false;
          }
        }
        
        return deletedCount;
      };

      // Clear portfolio stocks (will cascade to related data)
      if (clearSelections.portfolio) {
        const deletedCount = await deleteAllRecords('PortfolioStock');
        clearCount += deletedCount;
      }

      // Clear transactions (if not already cleared by portfolio cascade)
      if (clearSelections.transactions && !clearSelections.portfolio) {
        const deletedCount = await deleteAllRecords('Transaction');
        clearCount += deletedCount;
      }

      // Clear wallets (if not already cleared by portfolio cascade)
      if (clearSelections.wallets && !clearSelections.portfolio) {
        const deletedCount = await deleteAllRecords('StockWallet');
        clearCount += deletedCount;
      }

      setClearStatus({
        type: 'success',
        message: `Successfully cleared selected tables. Deleted ${clearCount} records.`
      });

      // Reset selections
      setClearSelections({ portfolio: false, transactions: false, wallets: false });
    } catch (error) {
      console.error('Error clearing tables:', error);
      setClearStatus({
        type: 'error',
        message: `Failed to clear tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setClearLoading(false);
    }
  };

  // Owner-based access control
  if (ownerLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading authentication...
      </div>
    );
  }

  if (!ownerId || ownerId !== DEV_OWNER_ID) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>🚫 Access Denied</h1>
        <h2 style={{ color: '#666', marginBottom: '10px' }}>Test Manager Not Available</h2>
        <p style={{ color: '#999', maxWidth: '500px', lineHeight: '1.5' }}>
          The Test Manager is only accessible to authorized development users. 
          This page includes database migration tools and testing utilities that require special permissions.
        </p>
        <div style={{ marginTop: '30px' }}>
          <Link 
            href="/"
            style={{
              padding: '12px 24px',
              backgroundColor: '#007cba',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            Return to Portfolio
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading test configuration...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="container">
        <div className="error">
          <h2>⚠️ Error Loading Configuration</h2>
          <p>{error}</p>
          <p>Please make sure:</p>
          <ul>
            <li>Your development server is running</li>
            <li>The test configuration API is available</li>
            <li>The test-suite-config.json file exists</li>
          </ul>
          <button onClick={loadTestConfig} className="retry-btn">
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="container">
      <div className="header">
        <h1>🧪 E2E Test Suite Manager</h1>
        <p>Manage and run your end-to-end test suites</p>
      </div>

      <div className="stats">
        <div className="stat-card">
          <h3>Total Tests</h3>
          <div>{stats.totalTests}</div>
        </div>
        <div className="stat-card info">
          <h3>Enabled Tests</h3>
          <div>{stats.enabledTests}</div>
        </div>
        <div className="stat-card warning">
          <h3>Test Suites</h3>
          <div>{stats.enabledSuites} / {stats.totalSuites}</div>
        </div>
      </div>

      <div className="global-settings">
        <h3>⚙️ Global Settings</h3>
        <div className="settings-grid">
          <div className="setting-group">
            <label>
              <span>Headless Mode</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.globalSettings.headless}
                  onChange={(e) => updateGlobalSetting('headless', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </label>
          </div>
          
          <div className="setting-group">
            <label>
              <span>Workers ({config.globalSettings.workers}) {config ? `(Auto: ${Math.max(getEnabledTestCount(config.testSuites), 1)})` : ''}</span>
              <div className="workers-control">
                <input
                  type="range"
                  min="1"
                  max={stats.totalTests}
                  value={config.globalSettings.workers}
                  onChange={(e) => updateGlobalSetting('workers', parseInt(e.target.value))}
                  className="workers-slider"
                />
                <button
                  onClick={() => updateGlobalSetting('workers', Math.max(getEnabledTestCount(config.testSuites), 1))}
                  className="auto-workers-btn"
                  title="Reset to auto-calculated value"
                >
                  Auto
                </button>
              </div>
            </label>
          </div>
          
          <div className="setting-group">
            <label>
              <span>Browser</span>
              <select
                value={config.globalSettings.browser}
                onChange={(e) => updateGlobalSetting('browser', e.target.value)}
                className="browser-select"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </label>
          </div>
          
          <div className="setting-group">
            <label>
              <span>Retries ({config.globalSettings.retries})</span>
              <input
                type="range"
                min="0"
                max="3"
                value={config.globalSettings.retries}
                onChange={(e) => updateGlobalSetting('retries', parseInt(e.target.value))}
                className="retries-slider"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="test-suites">
        {Object.entries(config.testSuites).map(([suiteName, suite]) => (
          <div key={suiteName} className="suite">
            <div className="suite-header">
              <div className="suite-title">📁 {suiteName} - {suite.description}</div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={suite.enabled}
                  onChange={(e) => toggleSuite(suiteName, e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="test-list">
              {suite.tests.map((test) => (
                <div key={test.name} className="test-item">
                  <div className="test-info">
                    <div className="test-name">{test.name}</div>
                    <div className="test-description">{test.description}</div>
                  </div>
                  <div className="test-meta">
                    <span className={`priority-badge priority-${test.priority}`}>
                      {test.priority.toUpperCase()}
                    </span>
                    <span className="duration">{test.estimatedDuration}</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={test.enabled}
                      onChange={(e) => toggleTest(suiteName, test.name, e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="preset-section">
        <h3>🎯 Quick Presets</h3>
        <div className="preset-buttons">
          {Object.entries(config.presets).map(([presetName, preset]) => (
            <button
              key={presetName}
              className={`preset-btn ${selectedPreset === presetName ? 'active' : ''}`}
              onClick={() => setSelectedPreset(presetName)}
            >
              {presetName} - {preset.description}
            </button>
          ))}
        </div>
      </div>

      <div className="run-section">
        <h3>🚀 Run Tests</h3>
        <div className="command-display">
          {generateCommand()}
        </div>
        <button className="run-btn" onClick={runTests}>
          Copy Command to Clipboard
        </button>
      </div>

      <div className="clear-dev-section">
        <h3>🗑️ Clear Dev Tables</h3>
        <p className="clear-dev-warning">⚠️ This will permanently delete data from selected tables in the dev environment</p>
        <div className="clear-dev-controls">
          <div className="clear-checkboxes">
            <label className="clear-checkbox">
              <input
                type="checkbox"
                checked={clearSelections.portfolio}
                onChange={(e) => setClearSelections(prev => ({...prev, portfolio: e.target.checked}))}
              />
              <span>Portfolio Stocks</span>
            </label>
            <label className="clear-checkbox">
              <input
                type="checkbox"
                checked={clearSelections.transactions}
                onChange={(e) => setClearSelections(prev => ({...prev, transactions: e.target.checked}))}
              />
              <span>Transactions</span>
            </label>
            <label className="clear-checkbox">
              <input
                type="checkbox"
                checked={clearSelections.wallets}
                onChange={(e) => setClearSelections(prev => ({...prev, wallets: e.target.checked}))}
              />
              <span>Wallets</span>
            </label>
          </div>
          <button 
            className={`clear-btn ${clearLoading ? 'loading' : ''}`}
            onClick={clearSelectedTables}
            disabled={clearLoading || !hasAnySelection()}
          >
            {clearLoading ? 'Clearing...' : 'Clear Selected'}
          </button>
        </div>
        {clearStatus && (
          <div className={`clear-status ${clearStatus.type}`}>
            {clearStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
