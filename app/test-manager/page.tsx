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
      setConfig(data);
    } catch (err) {
      setError('Failed to load test configuration. Make sure the server is running.');
      console.error('Error loading test config:', err);
    } finally {
      setLoading(false);
    }
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
    if (!config.globalSettings.headless) {
      command += ' --headed';
    }
    if (!config.globalSettings.parallelExecution) {
      command += ' --workers=1';
    }
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

  const runTests = () => {
    const command = generateCommand();
    alert(`Would run command: ${command}\n\nTo actually run tests, execute this command in your terminal.`);
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
          Generate Command
        </button>
      </div>
    </div>
  );
}
