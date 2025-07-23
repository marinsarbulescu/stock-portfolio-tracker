# E2E Test Suite Manager

A comprehensive system for managing and running your end-to-end test suites with fine-grained control over which tests to execute.

## 🚀 Quick Start

```bash
# List all available tests and their status
npm run e2e:list

# Show test summary statistics
npm run e2e:summary

# Run all enabled tests
npm run e2e:run

# Run a specific preset
npm run e2e:smoke    # Quick smoke tests
npm run e2e:full     # Complete test suite
```

## 📁 Files Structure

```
e2e/
├── test-suite-config.json     # Main configuration file
├── utils/
│   └── testSuiteManager.ts    # TypeScript utility class
├── scripts/
│   └── test-runner.js         # CLI script for test management
└── test-manager.html          # Visual web interface
```

## ⚙️ Configuration

### Main Config File: `e2e/test-suite-config.json`

The configuration is organized into test suites, with each suite containing multiple tests:

```json
{
  "testSuites": {
    "portfolio": {
      "enabled": true,
      "description": "Portfolio management tests",
      "tests": [
        {
          "name": "portfolio-create-and-edit-stock",
          "enabled": true,
          "file": "e2e/portfolio/portfolio-create-and-edit-stock.spec.ts",
          "description": "Test creating and editing portfolio stocks",
          "tags": ["portfolio", "crud", "stocks"],
          "priority": "high",
          "estimatedDuration": "2-3 minutes"
        }
      ]
    }
  },
  "globalSettings": {
    "runOnlyEnabledSuites": true,
    "runOnlyEnabledTests": true,
    "parallelExecution": false,
    "headless": false,
    "retries": 0,
    "timeout": 60000,
    "browser": "chromium"
  },
  "presets": {
    "smoke": {
      "description": "Quick smoke test suite",
      "enabledTests": [
        "portfolio-create-and-edit-stock",
        "wallet-add-transaction",
        "signals-price-fetch"
      ]
    }
  }
}
```

### Test Properties

Each test can have the following properties:

- **name**: Unique identifier for the test
- **enabled**: Boolean to enable/disable the test
- **file**: Path to the test spec file
- **description**: Human-readable description
- **tags**: Array of tags for categorization
- **priority**: `high`, `medium`, or `low`
- **estimatedDuration**: Expected runtime

## 🎯 Presets

Presets allow you to define common test configurations:

- **smoke**: Quick essential tests
- **full**: All available tests
- **wallet-focused**: Only wallet-related tests
- **critical**: High priority tests only

### Using Presets

```bash
# Run specific preset
npm run e2e:config run smoke
npm run e2e:config run full
npm run e2e:config run wallet-focused
npm run e2e:config run critical
```

## 🛠️ Available Commands

### Basic Commands

```bash
# Show help
npm run e2e:config help

# List all tests and their status
npm run e2e:list

# Show summary statistics
npm run e2e:summary

# List available presets
npm run e2e:config presets
```

### Running Tests

```bash
# Run all enabled tests
npm run e2e:run

# Run specific preset
npm run e2e:smoke
npm run e2e:full

# Run with custom preset
npm run e2e:config run wallet-focused
```

### Managing Test State

```bash
# Enable/disable entire test suite
npm run e2e:config enable wallets
npm run e2e:config disable wallets

# Enable/disable individual test
npm run e2e:config toggle wallets wallet-add-transaction false
npm run e2e:config toggle portfolio portfolio-create-and-edit-stock true
```

## 🖥️ Visual Interface

Open `e2e/test-manager.html` in your browser for a visual interface to:

- View all test suites and individual tests
- Toggle tests on/off with switches
- See test priorities and estimated durations
- Select presets
- Generate Playwright commands
- View test statistics

## 🔧 Programmatic Usage

```typescript
import { TestSuiteManager } from './e2e/utils/testSuiteManager';

const manager = new TestSuiteManager();

// Get enabled test files
const enabledTests = manager.getEnabledTestFiles();

// Generate Playwright command
const command = manager.generatePlaywrightCommand('smoke');

// Get test summary
const summary = manager.getTestSummary();

// Toggle tests
manager.toggleTest('wallets', 'wallet-add-transaction', false);
manager.toggleSuite('portfolio', true);
```

## 📊 Benefits

### 1. **Flexible Test Selection**
- Enable/disable individual tests or entire suites
- Use presets for common scenarios
- Filter by priority or tags

### 2. **Better CI/CD Integration**
- Run different test sets based on branch or environment
- Skip time-consuming tests during development
- Focus on critical tests for hotfixes

### 3. **Development Workflow**
- Run only tests related to current feature
- Quick smoke tests during development
- Full regression testing before release

### 4. **Maintenance**
- Easily identify test priorities and coverage
- Track estimated execution times
- Organize tests by functionality

## 🎨 Customization

### Adding New Tests

1. Add the test spec file to the appropriate e2e subfolder
2. Update `test-suite-config.json` to include the new test
3. Set appropriate priority, tags, and duration

### Creating Custom Presets

Add new presets to the `presets` section in the config file:

```json
{
  "presets": {
    "my-custom-preset": {
      "description": "My custom test selection",
      "enabledTests": ["test1", "test2"],
      "filter": {
        "priority": "high",
        "tags": ["api"]
      }
    }
  }
}
```

### Integration with CI/CD

```yaml
# Example GitHub Actions usage
- name: Run E2E Tests
  run: |
    if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      npm run e2e:full
    else
      npm run e2e:smoke
    fi
```

## 🚦 Example Workflows

### Development Workflow
1. `npm run e2e:list` - See what tests are available
2. `npm run e2e:config disable wallets` - Disable slow wallet tests
3. `npm run e2e:run` - Run remaining tests
4. Work on features...
5. `npm run e2e:smoke` - Quick validation

### Release Workflow
1. `npm run e2e:config enable all` - Enable all tests
2. `npm run e2e:full` - Run complete test suite
3. Deploy if all tests pass

### Debugging Workflow
1. `npm run e2e:config toggle portfolio portfolio-create-and-edit-stock true` - Enable specific failing test
2. `npm run e2e:config disable wallets signals` - Disable other suites
3. `npm run e2e:run` - Run only the problematic test

This system provides maximum flexibility while maintaining simplicity for common use cases!
