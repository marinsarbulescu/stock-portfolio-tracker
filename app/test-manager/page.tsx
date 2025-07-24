// app/test-manager/page.tsx
'use client';

import { useState, useEffect } from 'react';
import './test-manager.css';

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
  presets: Record<string, any>;
}

export default function TestManager() {
  const [config, setConfig] = useState<TestSuiteConfig | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTestConfig();
  }, []);

  const loadTestConfig = async () => {
    try {
      const response = await fetch('/api/test-config');
      if (!response.ok) {
        throw new Error('Failed to load test configuration');
      }
      const data = await response.json();
      
      // Calculate optimal worker count based on total tests
      const totalTests = calculateTotalTests(data.testSuites);
      const optimalWorkers = Math.min(totalTests, 8); // Cap at 8 workers
      
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
  };

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
    newConfig.globalSettings.workers = Math.min(Math.max(enabledTestCount, 1), 8);
    
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
    newConfig.globalSettings.workers = Math.min(Math.max(enabledTestCount, 1), 8);
    
    updateTestConfig(newConfig);
  };

  const updateGlobalSetting = (key: keyof typeof config.globalSettings, value: any) => {
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
    for (const [suiteName, suite] of Object.entries(config.testSuites)) {
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

    for (const [suiteName, suite] of Object.entries(config.testSuites)) {
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
              <span>Workers ({config.globalSettings.workers}) {config ? `(Auto: ${Math.min(Math.max(getEnabledTestCount(config.testSuites), 1), 8)})` : ''}</span>
              <div className="workers-control">
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={config.globalSettings.workers}
                  onChange={(e) => updateGlobalSetting('workers', parseInt(e.target.value))}
                  className="workers-slider"
                />
                <button
                  onClick={() => updateGlobalSetting('workers', Math.min(Math.max(getEnabledTestCount(config.testSuites), 1), 8))}
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
    </div>
  );
}
