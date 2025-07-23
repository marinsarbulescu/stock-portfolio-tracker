// e2e/utils/testSuiteManager.ts

import * as fs from 'fs';
import * as path from 'path';

export interface TestConfig {
  name: string;
  enabled: boolean;
  file: string;
  description: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedDuration: string;
}

export interface TestSuite {
  enabled: boolean;
  description: string;
  tests: TestConfig[];
}

export interface GlobalSettings {
  runOnlyEnabledSuites: boolean;
  runOnlyEnabledTests: boolean;
  parallelExecution: boolean;
  headless: boolean;
  retries: number;
  timeout: number;
  browser: string;
}

export interface Preset {
  description: string;
  enabledTests?: string[] | 'all';
  enabledSuites?: string[];
  filter?: {
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
  };
}

export interface TestSuiteConfig {
  testSuites: Record<string, TestSuite>;
  globalSettings: GlobalSettings;
  presets: Record<string, Preset>;
}

export class TestSuiteManager {
  private config!: TestSuiteConfig;
  private configPath: string;

  constructor(configPath: string = 'e2e/test-suite-config.json') {
    this.configPath = path.resolve(configPath);
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load test suite configuration from ${this.configPath}: ${errorMessage}`);
    }
  }

  /**
   * Get all enabled test files based on current configuration
   */
  getEnabledTestFiles(): string[] {
    const enabledFiles: string[] = [];

    for (const [suiteName, suite] of Object.entries(this.config.testSuites)) {
      if (!this.config.globalSettings.runOnlyEnabledSuites || suite.enabled) {
        for (const test of suite.tests) {
          if (!this.config.globalSettings.runOnlyEnabledTests || test.enabled) {
            enabledFiles.push(test.file);
          }
        }
      }
    }

    return enabledFiles;
  }

  /**
   * Get enabled test files for a specific preset
   */
  getTestFilesForPreset(presetName: string): string[] {
    const preset = this.config.presets[presetName];
    if (!preset) {
      throw new Error(`Preset '${presetName}' not found`);
    }

    if (preset.enabledTests === 'all') {
      return this.getAllTestFiles();
    }

    if (preset.enabledTests) {
      return this.getTestFilesByNames(preset.enabledTests);
    }

    if (preset.enabledSuites) {
      return this.getTestFilesBySuites(preset.enabledSuites);
    }

    if (preset.filter) {
      return this.getTestFilesByFilter(preset.filter);
    }

    return [];
  }

  /**
   * Generate Playwright CLI command based on current configuration
   */
  generatePlaywrightCommand(preset?: string): string {
    const testFiles = preset ? this.getTestFilesForPreset(preset) : this.getEnabledTestFiles();
    
    if (testFiles.length === 0) {
      return 'echo "No tests enabled to run"';
    }

    const settings = this.config.globalSettings;
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

    // Add parallel execution
    if (!settings.parallelExecution) {
      command += ' --workers=1';
    }

    // Add retries
    if (settings.retries > 0) {
      command += ` --retries=${settings.retries}`;
    }

    return command;
  }

  /**
   * Get test summary statistics
   */
  getTestSummary(): {
    totalSuites: number;
    enabledSuites: number;
    totalTests: number;
    enabledTests: number;
    testsByPriority: Record<string, number>;
    estimatedTotalDuration: string;
  } {
    let totalSuites = 0;
    let enabledSuites = 0;
    let totalTests = 0;
    let enabledTests = 0;
    const testsByPriority = { high: 0, medium: 0, low: 0 };

    for (const [suiteName, suite] of Object.entries(this.config.testSuites)) {
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
      estimatedTotalDuration: '10-15 minutes' // Could be calculated from individual durations
    };
  }

  /**
   * Enable/disable a specific test
   */
  toggleTest(suiteName: string, testName: string, enabled: boolean): void {
    const suite = this.config.testSuites[suiteName];
    if (!suite) {
      throw new Error(`Suite '${suiteName}' not found`);
    }

    const test = suite.tests.find(t => t.name === testName);
    if (!test) {
      throw new Error(`Test '${testName}' not found in suite '${suiteName}'`);
    }

    test.enabled = enabled;
    this.saveConfig();
  }

  /**
   * Enable/disable a test suite
   */
  toggleSuite(suiteName: string, enabled: boolean): void {
    const suite = this.config.testSuites[suiteName];
    if (!suite) {
      throw new Error(`Suite '${suiteName}' not found`);
    }

    suite.enabled = enabled;
    this.saveConfig();
  }

  /**
   * Save configuration back to file
   */
  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save configuration: ${errorMessage}`);
    }
  }

  private getAllTestFiles(): string[] {
    const allFiles: string[] = [];
    for (const suite of Object.values(this.config.testSuites)) {
      for (const test of suite.tests) {
        allFiles.push(test.file);
      }
    }
    return allFiles;
  }

  private getTestFilesByNames(testNames: string[]): string[] {
    const files: string[] = [];
    for (const suite of Object.values(this.config.testSuites)) {
      for (const test of suite.tests) {
        if (testNames.includes(test.name)) {
          files.push(test.file);
        }
      }
    }
    return files;
  }

  private getTestFilesBySuites(suiteNames: string[]): string[] {
    const files: string[] = [];
    for (const suiteName of suiteNames) {
      const suite = this.config.testSuites[suiteName];
      if (suite) {
        for (const test of suite.tests) {
          files.push(test.file);
        }
      }
    }
    return files;
  }

  private getTestFilesByFilter(filter: Preset['filter']): string[] {
    if (!filter) {
      return [];
    }

    const files: string[] = [];
    for (const suite of Object.values(this.config.testSuites)) {
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

  /**
   * List available presets
   */
  getAvailablePresets(): string[] {
    return Object.keys(this.config.presets);
  }

  /**
   * Get preset description
   */
  getPresetDescription(presetName: string): string {
    const preset = this.config.presets[presetName];
    return preset ? preset.description : '';
  }
}

// Export a default instance
export const testSuiteManager = new TestSuiteManager();
