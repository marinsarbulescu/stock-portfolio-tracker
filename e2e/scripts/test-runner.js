#!/usr/bin/env node

// e2e/scripts/test-runner.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Simple JavaScript implementation instead of importing TypeScript
const CONFIG_PATH = path.resolve('e2e/test-suite-config.json');

function loadConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to load test suite configuration from ${CONFIG_PATH}: ${error.message}`);
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error.message}`);
  }
}

function getEnabledTestFiles(config) {
  const enabledFiles = [];
  
  for (const [suiteName, suite] of Object.entries(config.testSuites)) {
    if (!config.globalSettings.runOnlyEnabledSuites || suite.enabled) {
      for (const test of suite.tests) {
        if (!config.globalSettings.runOnlyEnabledTests || test.enabled) {
          enabledFiles.push(test.file);
        }
      }
    }
  }
  
  return enabledFiles;
}

function generatePlaywrightCommand(config, preset = null) {
  let testFiles = [];
  
  if (preset) {
    const presetConfig = config.presets[preset];
    if (!presetConfig) {
      throw new Error(`Preset '${preset}' not found`);
    }
    
    if (presetConfig.enabledTests === 'all') {
      testFiles = getAllTestFiles(config);
    } else if (presetConfig.enabledTests) {
      testFiles = getTestFilesByNames(config, presetConfig.enabledTests);
    } else if (presetConfig.enabledSuites) {
      testFiles = getTestFilesBySuites(config, presetConfig.enabledSuites);
    } else if (presetConfig.filter) {
      testFiles = getTestFilesByFilter(config, presetConfig.filter);
    }
  } else {
    testFiles = getEnabledTestFiles(config);
  }
  
  if (testFiles.length === 0) {
    return 'echo "No tests enabled to run"';
  }

  const settings = config.globalSettings;
  let command = 'npx playwright test';

  // Add test files
  command += ` ${testFiles.join(' ')}`;

  // Add browser
  if (settings.browser && settings.browser !== 'chromium') {
    command += ` --browser=${settings.browser}`;
  }

  // Add headless/headed mode
  if (!settings.headless) {
    command += ' --headed';
  }

  // Add parallel execution and workers
  if (!settings.parallelExecution) {
    command += ' --workers=1';
  } else {
    // Use the number of test files, but cap it at the configured max workers
    const optimalWorkers = Math.min(testFiles.length, settings.workers || 1);
    command += ` --workers=${optimalWorkers}`;
  }

  // Add retries
  if (settings.retries > 0) {
    command += ` --retries=${settings.retries}`;
  }

  return command;
}

function getAllTestFiles(config) {
  const allFiles = [];
  for (const suite of Object.values(config.testSuites)) {
    for (const test of suite.tests) {
      allFiles.push(test.file);
    }
  }
  return allFiles;
}

function getTestFilesByNames(config, testNames) {
  const files = [];
  for (const suite of Object.values(config.testSuites)) {
    for (const test of suite.tests) {
      if (testNames.includes(test.name)) {
        files.push(test.file);
      }
    }
  }
  return files;
}

function getTestFilesBySuites(config, suiteNames) {
  const files = [];
  for (const suiteName of suiteNames) {
    const suite = config.testSuites[suiteName];
    if (suite) {
      for (const test of suite.tests) {
        files.push(test.file);
      }
    }
  }
  return files;
}

function getTestFilesByFilter(config, filter) {
  const files = [];
  for (const suite of Object.values(config.testSuites)) {
    for (const test of suite.tests) {
      let include = true;

      if (filter.priority && test.priority !== filter.priority) {
        include = false;
      }

      if (filter.tags && !filter.tags.some(tag => test.tags.includes(tag))) {
        include = false;
      }

      if (include) {
        files.push(test.file);
      }
    }
  }
  return files;
}

function getTestSummary(config) {
  let totalSuites = 0;
  let enabledSuites = 0;
  let totalTests = 0;
  let enabledTests = 0;
  const testsByPriority = { high: 0, medium: 0, low: 0 };

  for (const [suiteName, suite] of Object.entries(config.testSuites)) {
    totalSuites++;
    if (suite.enabled) {
      enabledSuites++;
    }

    for (const test of suite.tests) {
      totalTests++;
      testsByPriority[test.priority]++;
      
      if (test.enabled && suite.enabled) {
        enabledTests++;
      }
    }
  }

  return {
    totalSuites,
    enabledSuites,
    totalTests,
    enabledTests,
    testsByPriority,
    estimatedTotalDuration: '10-15 minutes'
  };
}

function toggleTest(config, suiteName, testName, enabled) {
  const suite = config.testSuites[suiteName];
  if (!suite) {
    throw new Error(`Suite '${suiteName}' not found`);
  }

  const test = suite.tests.find(t => t.name === testName);
  if (!test) {
    throw new Error(`Test '${testName}' not found in suite '${suiteName}'`);
  }

  test.enabled = enabled;
  saveConfig(config);
}

function toggleSuite(config, suiteName, enabled) {
  const suite = config.testSuites[suiteName];
  if (!suite) {
    throw new Error(`Suite '${suiteName}' not found`);
  }

  suite.enabled = enabled;
  saveConfig(config);
}

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
E2E Test Runner

Usage:
  npm run e2e:config [command] [options]

Commands:
  run [preset]     - Run tests (optionally with preset)
  list             - List all test suites and tests
  summary          - Show test summary statistics
  presets          - List available presets
  enable <suite>   - Enable a test suite
  disable <suite>  - Disable a test suite
  toggle <suite> <test> <true|false> - Toggle individual test

Examples:
  npm run e2e:config run              # Run all enabled tests
  npm run e2e:config run smoke        # Run smoke test preset
  npm run e2e:config list             # List all tests
  npm run e2e:config summary          # Show statistics
  npm run e2e:config enable wallets   # Enable wallet test suite
  npm run e2e:config toggle wallets wallet-add-transaction false
  `);
}

function main() {
  try {
    const config = loadConfig();
    const command = args[0];

    switch (command) {
      case 'run': {
        const preset = args[1];
        const playwrightCommand = generatePlaywrightCommand(config, preset);
        console.log(`Running command: ${playwrightCommand}`);
        execSync(playwrightCommand, { stdio: 'inherit' });
        break;
      }

      case 'list': {
        console.log('\\n📋 Test Suites and Tests:');
        console.log('========================\\n');

        for (const [suiteName, suite] of Object.entries(config.testSuites)) {
          const suiteStatus = suite.enabled ? '✅' : '❌';
          console.log(`${suiteStatus} Suite: ${suiteName} - ${suite.description}`);
          
          for (const test of suite.tests) {
            const testStatus = test.enabled ? '✅' : '❌';
            const priority = test.priority.toUpperCase().padEnd(6);
            console.log(`    ${testStatus} [${priority}] ${test.name} - ${test.description}`);
          }
          console.log('');
        }
        break;
      }

      case 'summary': {
        const summary = getTestSummary(config);
        console.log('\\n📊 Test Summary:');
        console.log('================\\n');
        console.log(`Total Suites: ${summary.totalSuites} (${summary.enabledSuites} enabled)`);
        console.log(`Total Tests: ${summary.totalTests} (${summary.enabledTests} enabled)`);
        console.log(`\\nBy Priority:`);
        console.log(`  High: ${summary.testsByPriority.high}`);
        console.log(`  Medium: ${summary.testsByPriority.medium}`);
        console.log(`  Low: ${summary.testsByPriority.low}`);
        console.log(`\\nEstimated Duration: ${summary.estimatedTotalDuration}`);
        break;
      }

      case 'presets': {
        const presets = Object.keys(config.presets);
        console.log('\\n🎯 Available Presets:');
        console.log('=====================\\n');
        
        for (const preset of presets) {
          const description = config.presets[preset].description;
          console.log(`${preset.padEnd(15)} - ${description}`);
        }
        console.log('\\nUsage: npm run e2e:config run <preset-name>');
        break;
      }

      case 'enable': {
        const suiteName = args[1];
        if (!suiteName) {
          console.error('❌ Please specify a suite name');
          process.exit(1);
        }
        toggleSuite(config, suiteName, true);
        console.log(`✅ Enabled suite: ${suiteName}`);
        break;
      }

      case 'disable': {
        const suiteName = args[1];
        if (!suiteName) {
          console.error('❌ Please specify a suite name');
          process.exit(1);
        }
        toggleSuite(config, suiteName, false);
        console.log(`❌ Disabled suite: ${suiteName}`);
        break;
      }

      case 'toggle': {
        const suiteName = args[1];
        const testName = args[2];
        const enabled = args[3] === 'true';
        
        if (!suiteName || !testName || args[3] === undefined) {
          console.error('❌ Usage: toggle <suite> <test> <true|false>');
          process.exit(1);
        }
        
        toggleTest(config, suiteName, testName, enabled);
        console.log(`${enabled ? '✅' : '❌'} ${enabled ? 'Enabled' : 'Disabled'} test: ${testName} in suite: ${suiteName}`);
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
