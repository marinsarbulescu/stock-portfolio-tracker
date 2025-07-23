// app/api/test-config/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.resolve(process.cwd(), 'e2e/test-suite-config.json');

export async function GET() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error reading test config:', error);
    return NextResponse.json(
      { error: 'Failed to read test configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    
    // Validate the config structure
    if (!config.testSuites || !config.globalSettings || !config.presets) {
      return NextResponse.json(
        { error: 'Invalid configuration structure' },
        { status: 400 }
      );
    }
    
    // Write the updated config back to file
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating test config:', error);
    return NextResponse.json(
      { error: 'Failed to update test configuration' },
      { status: 500 }
    );
  }
}
