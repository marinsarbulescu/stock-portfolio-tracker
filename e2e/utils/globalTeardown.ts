/**
 * Global teardown for Playwright tests
 * Ensures clean exit after all tests complete
 */
async function globalTeardown() {
  console.log('🎭 All Playwright tests completed. Cleaning up...');
  
  // Small delay to ensure all processes are properly closed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Force exit to prevent hanging
  process.exit(0);
}

export default globalTeardown;
