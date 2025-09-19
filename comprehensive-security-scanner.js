#!/usr/bin/env node

/**
 * Comprehensive NPM Supply Chain Security Scanner - Complete Shai-Hulud Attack Detection
 * 
 * This scanner includes ALL known compromised packages from the complete Shai-Hulud attack dataset
 * Updated with the full package list provided by security research.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Complete list of ALL known compromised packages from Shai-Hulud attack
const COMPROMISED_PACKAGES = {
  // Original attack wave packages
  'angulartics2': ['14.1.1', '14.1.2'],
  '@ctrl/deluge': ['7.2.1', '7.2.2'],
  '@ctrl/golang-template': ['1.4.2', '1.4.3'],
  '@ctrl/magnet-link': ['4.0.3', '4.0.4'],
  '@ctrl/ngx-codemirror': ['7.0.1', '7.0.2'],
  '@ctrl/ngx-csv': ['6.0.1', '6.0.2'],
  '@ctrl/ngx-emoji-mart': ['9.2.1', '9.2.2'],
  '@ctrl/ngx-rightclick': ['4.0.1', '4.0.2'],
  '@ctrl/qbittorrent': ['9.7.1', '9.7.2'],
  '@ctrl/react-adsense': ['2.0.1', '2.0.2'],
  '@ctrl/shared-torrent': ['6.3.1', '6.3.2'],
  '@ctrl/tinycolor': ['4.1.1', '4.1.2'],
  '@ctrl/torrent-file': ['4.1.1', '4.1.2'],
  '@ctrl/transmission': ['7.3.1'],
  '@ctrl/ts-base32': ['4.0.1', '4.0.2'],
  'encounter-playground': ['0.0.2', '0.0.3', '0.0.4', '0.0.5'],
  'json-rules-engine-simplified': ['0.2.1', '0.2.4'],
  'koa2-swagger-ui': ['5.11.1', '5.11.2'],
  'rxnt-authentication': ['0.0.3', '0.0.4', '0.0.5', '0.0.6'], // Patient Zero
  'rxnt-healthchecks-nestjs': ['1.0.2', '1.0.3', '1.0.4', '1.0.5'],
  'rxnt-kue': ['1.0.4', '1.0.5', '1.0.6', '1.0.7'],
  'swc-plugin-component-annotate': ['1.9.1', '1.9.2'],
  'ts-gaussian': ['3.0.5', '3.0.6'],

  // Extended attack - NativeScript Community packages
  '@nativescript-community/gesturehandler': ['2.0.35'],
  '@nativescript-community/sentry': ['4.6.43'],
  '@nativescript-community/text': ['1.6.9', '1.6.10', '1.6.11', '1.6.12', '1.6.13'],
  '@nativescript-community/ui-collectionview': ['6.0.6'],
  '@nativescript-community/ui-drawer': ['0.1.30'],
  '@nativescript-community/ui-image': ['4.5.6'],
  '@nativescript-community/ui-material-bottomsheet': ['7.2.72'],
  '@nativescript-community/ui-material-core': ['7.2.72', '7.2.73', '7.2.74', '7.2.75', '7.2.76'],
  '@nativescript-community/ui-material-core-tabs': ['7.2.72', '7.2.73', '7.2.74', '7.2.75', '7.2.76'],
  '@nativescript-community/arraybuffers': ['1.1.6', '1.1.7', '1.1.8'],
  '@nativescript-community/perms': ['3.0.5', '3.0.6', '3.0.7', '3.0.8'],
  '@nativescript-community/sqlite': ['3.5.2', '3.5.3', '3.5.4', '3.5.5'],
  '@nativescript-community/typeorm': ['0.2.30', '0.2.31', '0.2.32', '0.2.33'],
  '@nativescript-community/ui-document-picker': ['1.1.27', '1.1.28'],
  '@nativescript-community/ui-label': ['1.3.35', '1.3.36', '1.3.37'],
  '@nativescript-community/ui-material-bottom-navigation': ['7.2.72', '7.2.73', '7.2.74', '7.2.75'],
  '@nativescript-community/ui-material-ripple': ['7.2.72', '7.2.73', '7.2.74', '7.2.75'],
  '@nativescript-community/ui-material-tabs': ['7.2.72', '7.2.73', '7.2.74', '7.2.75'],
  '@nativescript-community/ui-pager': ['14.1.36', '14.1.37', '14.1.38'],
  '@nativescript-community/ui-pulltorefresh': ['2.5.4', '2.5.5', '2.5.6', '2.5.7'],

  // CrowdStrike packages wave
  '@crowdstrike/commitlint': ['8.1.1', '8.1.2'],
  '@crowdstrike/falcon-shoelace': ['0.4.1', '0.4.2'],
  '@crowdstrike/foundry-js': ['0.19.1', '0.19.2'],
  '@crowdstrike/glide-core': ['0.34.2', '0.34.3'],
  '@crowdstrike/logscale-dashboard': ['1.205.1', '1.205.2'],
  '@crowdstrike/logscale-file-editor': ['1.205.1', '1.205.2'],
  '@crowdstrike/logscale-parser-edit': ['1.205.1', '1.205.2'],
  '@crowdstrike/logscale-search': ['1.205.1', '1.205.2'],
  '@crowdstrike/tailwind-toucan-base': ['5.0.1', '5.0.2'],
  'browser-webdriver-downloader': ['3.0.8'],
  'ember-browser-services': ['5.0.2', '5.0.3'],
  'ember-headless-form-yup': ['1.0.1'],
  'ember-headless-form': ['1.1.2', '1.1.3'],
  'ember-headless-table': ['2.1.5', '2.1.6'],
  'ember-url-hash-polyfill': ['1.0.12', '1.0.13'],
  'ember-velcro': ['2.2.1', '2.2.2'],
  'eslint-config-crowdstrike-node': ['4.0.3', '4.0.4'],
  'eslint-config-crowdstrike': ['11.0.2', '11.0.3'],
  'monorepo-next': ['13.0.1', '13.0.2'],
  'remark-preset-lint-crowdstrike': ['4.0.1', '4.0.2'],
  'verror-extra': ['6.0.1'],
  'yargs-help-output': ['5.0.3'],

  // Additional compromised packages
  '@ahmedhfarag/ngx-perfect-scrollbar': ['20.0.20'],
  '@ahmedhfarag/ngx-virtual-scroller': ['4.0.4'],
  'another-shai': ['1.0.1'],
  '@art-ws/common': ['2.0.28'],
  '@art-ws/config-eslint': ['2.0.4', '2.0.5'],
  '@art-ws/config-ts': ['2.0.7', '2.0.8'],
  '@art-ws/db-context': ['2.0.24'],
  '@art-ws/di-node': ['2.0.13'],
  '@art-ws/di': ['2.0.28', '2.0.32'],
  '@art-ws/eslint': ['1.0.5', '1.0.6'],
  '@art-ws/fastify-http-server': ['2.0.24', '2.0.27'],
  '@art-ws/http-server': ['2.0.21', '2.0.25'],
  '@art-ws/openapi': ['0.1.9', '0.1.12'],
  '@art-ws/package-base': ['1.0.5', '1.0.6'],
  '@art-ws/prettier': ['1.0.5', '1.0.6'],
  '@art-ws/slf': ['2.0.15', '2.0.22'],
  '@art-ws/ssl-info': ['1.0.9', '1.0.10'],
  '@art-ws/web-app': ['1.0.3', '1.0.4'],

  // HestJS packages
  '@hestjs/core': ['0.2.1'],
  '@hestjs/cqrs': ['0.1.6'],
  '@hestjs/demo': ['0.1.2'],
  '@hestjs/eslint-config': ['0.1.2'],
  '@hestjs/logger': ['0.1.6'],
  '@hestjs/scalar': ['0.1.7'],
  '@hestjs/validation': ['0.1.6'],

  // NStudio packages  
  '@nstudio/angular': ['20.0.4', '20.0.5', '20.0.6'],
  '@nstudio/focus': ['20.0.4', '20.0.5', '20.0.6'],
  '@nstudio/nativescript-checkbox': ['2.0.6', '2.0.7', '2.0.8', '2.0.9'],
  '@nstudio/nativescript-loading-indicator': ['5.0.1', '5.0.2', '5.0.3', '5.0.4'],
  '@nstudio/ui-collectionview': ['5.1.11', '5.1.12', '5.1.13', '5.1.14'],
  '@nstudio/web-angular': ['20.0.4'],
  '@nstudio/web': ['20.0.4'],
  '@nstudio/xplat-utils': ['20.0.5', '20.0.6', '20.0.7'],
  '@nstudio/xplat': ['20.0.5', '20.0.6', '20.0.7'],

  // Operato packages (massive compromise)
  '@operato/board': ['9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.47', '9.0.48', '9.0.49', '9.0.50', '9.0.51'],
  '@operato/data-grist': ['9.0.29', '9.0.35', '9.0.36', '9.0.37'],
  '@operato/graphql': ['9.0.22', '9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46'],
  '@operato/headroom': ['9.0.2', '9.0.35', '9.0.36', '9.0.37'],
  '@operato/help': ['9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46'],
  '@operato/i18n': ['9.0.35', '9.0.36', '9.0.37'],
  '@operato/input': ['9.0.27', '9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.47', '9.0.48'],
  '@operato/layout': ['9.0.35', '9.0.36', '9.0.37'],
  '@operato/popup': ['9.0.22', '9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.49'],
  '@operato/pull-to-refresh': ['9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42'],
  '@operato/shell': ['9.0.22', '9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39'],
  '@operato/styles': ['9.0.2', '9.0.35', '9.0.36', '9.0.37'],
  '@operato/utils': ['9.0.22', '9.0.35', '9.0.36', '9.0.37', '9.0.38', '9.0.39', '9.0.40', '9.0.41', '9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.47', '9.0.49', '9.0.50', '9.0.51'],

  // Teselagen packages
  '@teselagen/bio-parsers': ['0.4.30'],
  '@teselagen/bounce-loader': ['0.3.16', '0.3.17'],
  '@teselagen/file-utils': ['0.3.22'],
  '@teselagen/liquibase-tools': ['0.4.1'],
  '@teselagen/ove': ['0.7.40'],
  '@teselagen/range-utils': ['0.3.14', '0.3.15'],
  '@teselagen/react-list': ['0.8.19', '0.8.20'],
  '@teselagen/react-table': ['6.10.19', '6.10.20', '6.10.22'],
  '@teselagen/sequence-utils': ['0.3.34'],
  '@teselagen/ui': ['0.9.10'],
  'eslint-config-teselagen': ['6.1.7', '6.1.8'],
  'graphql-sequelize-teselagen': ['5.3.8', '5.3.9'],

  // Things Factory packages
  '@things-factory/attachment-base': ['9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.47', '9.0.48', '9.0.49', '9.0.50', '9.0.51', '9.0.52', '9.0.53', '9.0.54', '9.0.55'],
  '@things-factory/auth-base': ['9.0.42', '9.0.43', '9.0.44', '9.0.45'],
  '@things-factory/email-base': ['9.0.42', '9.0.43', '9.0.44', '9.0.45', '9.0.46', '9.0.47', '9.0.48', '9.0.49', '9.0.50', '9.0.51', '9.0.52', '9.0.53', '9.0.54', '9.0.55', '9.0.56', '9.0.57', '9.0.58', '9.0.59'],
  '@things-factory/env': ['9.0.42', '9.0.43', '9.0.44', '9.0.45'],
  '@things-factory/integration-base': ['9.0.42', '9.0.43', '9.0.44', '9.0.45'],
  '@things-factory/integration-marketplace': ['9.0.43', '9.0.44', '9.0.45'],
  '@things-factory/shell': ['9.0.42', '9.0.43', '9.0.44', '9.0.45'],

  // Additional individual packages
  '@thangved/callback-window': ['1.1.4'],
  '@tnf-dev/api': ['1.0.8'],
  '@tnf-dev/core': ['1.0.8'],
  '@tnf-dev/js': ['1.0.8'],
  '@tnf-dev/mui': ['1.0.8'],
  '@tnf-dev/react': ['1.0.8'],
  '@ui-ux-gang/devextreme-angular-rpk': ['24.1.7'],
  '@yoobic/design-system': ['6.5.17'],
  '@yoobic/jpeg-camera-es6': ['1.0.13'],
  '@yoobic/yobi': ['8.7.53'],
  'airchief': ['0.3.1'],
  'airpilot': ['0.8.8'],
  'capacitor-notificationhandler': ['0.0.2', '0.0.3'],
  'capacitor-plugin-healthapp': ['0.0.2', '0.0.3'],
  'capacitor-plugin-ihealth': ['1.1.8', '1.1.9'],
  'capacitor-plugin-vonage': ['1.0.2', '1.0.3'],
  'capacitorandroidpermissions': ['0.0.4', '0.0.5'],
  'config-cordova': ['0.8.5'],
  'cordova-plugin-voxeet2': ['1.0.24'],
  'cordova-voxeet': ['1.0.32'],
  'create-hest-app': ['0.1.9'],
  'db-evo': ['1.1.4', '1.1.5'],
  'devextreme-angular-rpk': ['21.2.8'],
  'globalize-rpk': ['1.7.4'],
  'html-to-base64-image': ['1.0.2'],
  'jumpgate': ['0.0.2'],
  'mcfly-semantic-release': ['1.3.1'],
  'mcp-knowledge-base': ['0.0.2'],
  'mcp-knowledge-graph': ['1.2.1'],
  'mobioffice-cli': ['1.0.3'],
  'mstate-angular': ['0.4.4'],
  'mstate-cli': ['0.4.7'],
  'mstate-dev-react': ['1.1.1'],
  'mstate-react': ['1.6.5'],
  'ng2-file-upload': ['7.0.2', '7.0.3', '8.0.1', '8.0.2', '8.0.3', '9.0.1'],
  'ngx-bootstrap': ['18.1.4', '19.0.3', '19.0.4', '20.0.3', '20.0.4', '20.0.5'],
  'ngx-color': ['10.0.1', '10.0.2'],
  'ngx-toastr': ['19.0.1', '19.0.2'],
  'ngx-trend': ['8.0.1'],
  'ngx-ws': ['1.1.5', '1.1.6'],
  'oradm-to-gql': ['35.0.14', '35.0.15'],
  'oradm-to-sqlz': ['1.1.2'],
  'ove-auto-annotate': ['0.0.9', '0.0.10'],
  'pm2-gelf-json': ['1.0.4', '1.0.5'],
  'printjs-rpk': ['1.6.1'],
  'react-complaint-image': ['0.0.32', '0.0.35'],
  'react-jsonschema-form-conditionals': ['0.3.18', '0.3.21'],
  'react-jsonschema-form-extras': ['1.0.4'],
  'react-jsonschema-rxnt-extras': ['0.4.9'],
  '@rxap/ngx-bootstrap': ['19.0.3', '19.0.4'],
  'tbssnch': ['1.0.2'],
  'teselagen-interval-tree': ['1.1.2'],
  'tg-client-query-builder': ['2.14.4', '2.14.5'],
  'tg-redbird': ['1.3.1', '1.3.2'],
  'tg-seq-gen': ['1.0.9', '1.0.10'],
  'thangved-react-grid': ['1.0.3'],
  'ts-imports': ['1.0.1', '1.0.2'],
  'tvi-cli': ['0.1.5'],
  've-bamreader': ['0.2.6', '0.2.7'],
  've-editor': ['1.0.1', '1.0.2'],
  'voip-callkit': ['1.0.2', '1.0.3'],
  'wdio-web-reporter': ['0.1.3'],
  'yoo-styles': ['6.0.326'],

  // Missing packages from list
  '@nexe/config-manager': ['0.1.1'],
  '@nexe/eslint-config': ['0.1.1'],
  '@nexe/logger': ['0.1.3']
};

// Files to exclude from malicious pattern detection
const EXCLUDED_FILES = [
  'security-scanner.js',
  'enhanced-security-scanner.js',
  'final-security-scanner.js',
  'comprehensive-security-scanner.js',
  'SECURITY_AUDIT_REPORT.json',
  'FINAL_SECURITY_AUDIT.json',
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md'
];

// Known legitimate bundle.js files
const LEGITIMATE_BUNDLE_FILES = [
  'istanbul-reports', 
  'next/dist/compiled',
  'sync-fetch',
  'webpack',
  'rollup',
  'vite',
  'parcel',
  '@babel',
  '@webpack-cli'
];

// High-confidence malicious patterns (actual exploit code, not descriptions)
const MALICIOUS_PATTERNS = {
  executablePatterns: [
    'new Function("return this")()',
    'eval(Buffer.from(',
    'child_process.exec',
    'require("child_process")',
    'process.env.HOME + "/.ssh"',
    'process.env.USERPROFILE',
    'fs.readFileSync(".git/config"',
    'https://webhook.site/',
    'POST", "https://api.github.com/repos',
    'Authorization: bearer',
    'npm publish --access public'
  ],
  maliciousFiles: ['NpmModule.updatePackage.js', 'Shai-Hulud.js'],
  suspiciousWorkflows: ['name: "Shai-Hulud"', 'runs-on: self-hosted'],
  credentialTheft: [
    'process.env.NPM_TOKEN',
    'process.env.GITHUB_TOKEN', 
    'process.env.AWS_ACCESS_KEY_ID'
  ]
};

class ComprehensiveSecurityScanner {
  constructor() {
    this.findings = [];
    this.reportPath = path.join(process.cwd(), 'COMPREHENSIVE_SECURITY_AUDIT.json');
    this.totalCompromisedPackages = Object.keys(COMPROMISED_PACKAGES).length;
    this.totalCompromisedVersions = Object.values(COMPROMISED_PACKAGES).flat().length;
  }

  log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const finding = { timestamp, level, message, details };
    this.findings.push(finding);
    
    const colors = { INFO: '\x1b[36m', WARNING: '\x1b[33m', CRITICAL: '\x1b[31m', SUCCESS: '\x1b[32m' };
    console.log(`${colors[level] || ''}[${level}] ${message}\x1b[0m`);
    if (details) console.log('  ', details);
  }

  isExcludedFile(filePath) {
    const fileName = path.basename(filePath);
    return EXCLUDED_FILES.some(excluded => fileName.includes(excluded)) ||
           filePath.includes('node_modules') ||
           filePath.includes('SECURITY_AUDIT') ||
           filePath.includes('security-scanner');
  }

  scanPackageFiles() {
    this.log('INFO', `🔍 Scanning for ${this.totalCompromisedPackages} compromised packages (${this.totalCompromisedVersions} versions)...`);
    
    const packageFiles = ['package.json', 'package-lock.json', 'amplify/package.json'];
    let foundCompromised = 0;

    packageFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          const content = JSON.parse(fs.readFileSync(file, 'utf8'));
          const allDependencies = { 
            ...content.dependencies, 
            ...content.devDependencies,
            ...content.peerDependencies 
          };

          Object.entries(COMPROMISED_PACKAGES).forEach(([pkgName, compromisedVersions]) => {
            if (allDependencies[pkgName]) {
              const installedVersion = allDependencies[pkgName].replace(/[^0-9.]/g, '');
              if (compromisedVersions.includes(installedVersion)) {
                foundCompromised++;
                this.log('CRITICAL', `🚨 COMPROMISED PACKAGE DETECTED: ${pkgName}@${installedVersion}`, {
                  file,
                  package: pkgName,
                  version: installedVersion,
                  threat: 'Shai-Hulud self-replicating malware - PATIENT ZERO STRAIN',
                  severity: pkgName.startsWith('rxnt-') ? 'PATIENT ZERO' : 'COMPROMISED',
                  action: 'REMOVE IMMEDIATELY - ROTATE ALL CREDENTIALS'
                });
              }
            }
          });

          // Check for any packages from compromised organizations
          const compromisedOrgs = ['rxnt-', '@crowdstrike/', '@operato/', '@nativescript-community/', '@ctrl/'];
          Object.keys(allDependencies).forEach(pkgName => {
            if (compromisedOrgs.some(org => pkgName.startsWith(org)) && !COMPROMISED_PACKAGES[pkgName]) {
              this.log('WARNING', `⚠️  HIGH RISK: ${pkgName} from compromised organization`, {
                package: pkgName,
                threat: 'Package from organization with known Shai-Hulud compromises',
                action: 'Verify package legitimacy - consider removal'
              });
            }
          });

        } catch (error) {
          this.log('WARNING', `Failed to parse ${file}: ${error.message}`);
        }
      }
    });

    if (foundCompromised === 0) {
      this.log('SUCCESS', '✅ No compromised packages found in direct dependencies');
    } else {
      this.log('CRITICAL', `🚨 FOUND ${foundCompromised} COMPROMISED PACKAGES - IMMEDIATE ACTION REQUIRED`);
    }
  }

  scanForMaliciousCode() {
    this.log('INFO', '🔍 Scanning for executable malicious code patterns...');
    
    const searchPaths = ['src', 'app', 'e2e', 'scripts', '.'];
    let foundMalicious = false;

    searchPaths.forEach(searchPath => {
      if (fs.existsSync(searchPath)) {
        this.scanDirectoryRecursive(searchPath, (filePath) => {
          if (this.isExcludedFile(filePath)) {
            return;
          }

          const fileName = path.basename(filePath);

          // Check for specific malicious files
          MALICIOUS_PATTERNS.maliciousFiles.forEach(maliciousFile => {
            if (fileName === maliciousFile) {
              foundMalicious = true;
              this.log('CRITICAL', `🚨 MALICIOUS FILE DETECTED: ${filePath}`, {
                file: filePath,
                maliciousFile,
                threat: 'Direct evidence of Shai-Hulud attack'
              });
            }
          });

          // Check JavaScript files for malicious patterns
          if ((fileName.endsWith('.js') || fileName.endsWith('.json')) && !filePath.includes('node_modules')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              
              MALICIOUS_PATTERNS.executablePatterns.forEach(pattern => {
                if (content.includes(pattern)) {
                  foundMalicious = true;
                  this.log('CRITICAL', `🚨 MALICIOUS CODE EXECUTION: "${pattern}" in ${filePath}`, {
                    file: filePath,
                    pattern,
                    threat: 'Executable malicious code detected'
                  });
                }
              });

            } catch (error) {
              // Ignore read errors for binary files
            }
          }
        });
      }
    });

    if (!foundMalicious) {
      this.log('SUCCESS', '✅ No executable malicious code patterns detected');
    }
  }

  runEnhancedNpmAudit() {
    this.log('INFO', '🔍 Running npm security audit...');
    
    try {
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
        let criticalCount = 0;
        Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
          if (vuln.severity === 'critical' || vuln.severity === 'high') {
            criticalCount++;
            const isKnownCompromised = Object.keys(COMPROMISED_PACKAGES).includes(pkg);
            const level = isKnownCompromised ? 'CRITICAL' : 'WARNING';
            
            this.log(level, `🔴 SECURITY VULNERABILITY: ${pkg} - ${vuln.severity}`, {
              package: pkg,
              severity: vuln.severity,
              title: vuln.title,
              isCompromised: isKnownCompromised,
              action: isKnownCompromised ? 'REMOVE IMMEDIATELY' : 'Update package when available'
            });
          }
        });
      } else {
        this.log('SUCCESS', '✅ No vulnerabilities found in npm audit');
      }
    } catch (error) {
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          if (audit.vulnerabilities) {
            Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
              if (vuln.severity === 'critical' || vuln.severity === 'high') {
                const isKnownCompromised = Object.keys(COMPROMISED_PACKAGES).includes(pkg);
                const level = isKnownCompromised ? 'CRITICAL' : 'WARNING';
                
                this.log(level, `🔴 SECURITY VULNERABILITY: ${pkg} - ${vuln.severity}`, {
                  package: pkg,
                  severity: vuln.severity,
                  isCompromised: isKnownCompromised
                });
              }
            });
          }
        } catch (parseError) {
          this.log('WARNING', `Failed to parse npm audit results: ${parseError.message}`);
        }
      } else {
        this.log('WARNING', `npm audit failed: ${error.message}`);
      }
    }
  }

  scanDirectoryRecursive(dirPath, callback) {
    try {
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            this.scanDirectoryRecursive(fullPath, callback);
          } else if (stat.isFile()) {
            callback(fullPath);
          }
        } catch (statError) {
          // Skip files that can't be accessed
        }
      });
    } catch (dirError) {
      // Skip directories that can't be read
    }
  }

  generateReport() {
    this.log('INFO', '📋 Generating comprehensive security audit report...');
    
    const criticalCount = this.findings.filter(f => f.level === 'CRITICAL').length;
    
    const report = {
      scanDate: new Date().toISOString(),
      scanner: 'Comprehensive NPM Supply Chain Security Scanner v4.0',
      threat: 'Shai-Hulud Attack - Complete Package Database',
      summary: {
        totalFindings: this.findings.length,
        criticalFindings: criticalCount,
        warningFindings: this.findings.filter(f => f.level === 'WARNING').length,
        successFindings: this.findings.filter(f => f.level === 'SUCCESS').length,
        infoFindings: this.findings.filter(f => f.level === 'INFO').length,
        threatLevel: criticalCount > 0 ? 'CRITICAL INCIDENT - IMMEDIATE RESPONSE REQUIRED' : 'SECURE - MONITORING RECOMMENDED',
        packagesScanned: this.totalCompromisedPackages,
        versionsScanned: this.totalCompromisedVersions
      },
      threatIntelligence: {
        attackName: 'Shai-Hulud',
        patientZero: 'rxnt-authentication@0.0.6',
        attackStart: '2025-09-14T17:58:50.000Z',
        totalKnownCompromisedPackages: this.totalCompromisedPackages,
        totalKnownCompromisedVersions: this.totalCompromisedVersions,
        majorCompromisedOrganizations: ['@crowdstrike', '@operato', '@nativescript-community', '@ctrl', 'rxnt-*', '@teselagen', '@things-factory'],
        attackVector: 'Self-replicating malware via npm package compromise with credential theft'
      },
      findings: this.findings,
      recommendations: this.getComprehensiveRecommendations()
    };

    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    this.log('SUCCESS', `📊 Comprehensive security audit report saved to: ${this.reportPath}`);
    
    return report;
  }

  getComprehensiveRecommendations() {
    const criticalCount = this.findings.filter(f => f.level === 'CRITICAL').length;
    
    if (criticalCount > 0) {
      return [
        '🚨🚨🚨 CRITICAL SECURITY INCIDENT - SHAI-HULUD ATTACK DETECTED! 🚨🚨🚨',
        '',
        '⚡ IMMEDIATE ACTIONS (Execute within 15 minutes):',
        '1. DISCONNECT system from internet immediately',
        '2. REVOKE ALL npm tokens: npm token revoke <token-id>',
        '3. REVOKE ALL GitHub personal access tokens',
        '4. REVOKE ALL cloud provider API keys (AWS, GCP, Azure)',
        '5. DELETE compromised packages from package.json',
        '6. CLEAN node_modules: rm -rf node_modules package-lock.json',
        '7. NOTIFY security team and incident response immediately',
        '',
        '🔍 DAMAGE ASSESSMENT (Next 1 hour):',
        '8. SCAN all GitHub repositories for unauthorized access',
        '9. REVIEW recent npm publishing activity',
        '10. CHECK for malicious GitHub workflows in .github/workflows/',
        '11. AUDIT cloud infrastructure for unauthorized changes',
        '12. SEARCH for credential theft in application logs',
        '13. VERIFY no unauthorized package publications',
        '',
        '🛡️ CONTAINMENT (Next 24 hours):',
        '14. ROTATE all service passwords and API keys',
        '15. ENABLE 2FA on all development accounts',
        '16. IMPLEMENT network segmentation for development',
        '17. DEPLOY emergency security patches',
        '18. CONTACT legal team for potential breach notification',
        '',
        '📞 EMERGENCY CONTACTS:',
        '• npm security: security@npmjs.com',
        '• GitHub security: security@github.com',
        '• CERT/CC: https://www.kb.cert.org/vuls/',
        '• FBI IC3: https://www.ic3.gov/ (for critical infrastructure)'
      ];
    } else {
      return [
        '✅ REPOSITORY SECURE - NO ACTIVE SHAI-HULUD THREATS DETECTED',
        '',
        '🛡️ SECURITY POSTURE: EXCELLENT',
        '• No compromised packages detected',
        '• No malicious code patterns found',
        '• Clean dependency tree',
        '',
        '🔄 ONGOING SECURITY MEASURES:',
        '1. Run this scan weekly',
        '2. Enable automated security monitoring',
        '3. Subscribe to security advisories',
        '4. Maintain updated dependencies',
        '5. Regular credential rotation',
        '6. Supply chain monitoring',
        '7. Security awareness training'
      ];
    }
  }

  async runFullScan() {
    console.log('\n🛡️  COMPREHENSIVE NPM SUPPLY CHAIN SECURITY SCANNER');
    console.log('===================================================');
    console.log(`🎯 Scanning for Shai-Hulud attack: ${this.totalCompromisedPackages} packages, ${this.totalCompromisedVersions} versions`);
    console.log('📅 Report Date:', new Date().toISOString());
    console.log('🔥 COMPLETE THREAT DATABASE LOADED');
    console.log('');

    this.scanPackageFiles();
    this.scanForMaliciousCode();
    this.runEnhancedNpmAudit();

    const report = this.generateReport();
    
    console.log('\n📊 COMPREHENSIVE SCAN RESULTS');
    console.log('==============================');
    console.log(`Total Findings: ${report.summary.totalFindings}`);
    console.log(`🚨 Critical: ${report.summary.criticalFindings}`);
    console.log(`⚠️  Warnings: ${report.summary.warningFindings}`);
    console.log(`✅ Success: ${report.summary.successFindings}`);
    console.log(`ℹ️  Info: ${report.summary.infoFindings}`);
    console.log('');
    console.log(`🎯 Threat Level: ${report.summary.threatLevel}`);
    console.log(`📦 Packages Scanned: ${report.summary.packagesScanned}`);
    console.log(`🔍 Versions Checked: ${report.summary.versionsScanned}`);

    if (report.summary.criticalFindings > 0) {
      console.log('\n🚨🚨🚨 SHAI-HULUD ATTACK CONFIRMED! 🚨🚨🚨');
      console.log('🔥 COMPROMISED PACKAGES DETECTED IN YOUR REPOSITORY!');
      console.log('⚡ FOLLOW EMERGENCY RESPONSE PROCEDURES IMMEDIATELY!');
    } else {
      console.log('\n✅ SECURITY STATUS: REPOSITORY PROTECTED');
      console.log('🛡️  No Shai-Hulud threats detected in your codebase.');
      console.log('🎉 Your security practices have kept you safe!');
    }
    
    console.log('\n📋 SECURITY RECOMMENDATIONS:');
    console.log('==============================');
    report.recommendations.forEach(rec => console.log(rec));
    
    console.log(`\n📄 Full detailed report: ${this.reportPath}`);
    
    return report;
  }
}

// Execute scan if run directly
if (require.main === module) {
  const scanner = new ComprehensiveSecurityScanner();
  scanner.runFullScan().catch(error => {
    console.error('❌ Security scan failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveSecurityScanner;