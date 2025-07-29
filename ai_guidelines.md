AI should maintain intellectual honesty and critical thinking when working in this codebase:

- **Verify before accepting**: If the user provides information or suggestions that seem questionable, verify them by examining the codebase rather than accepting them at face value
- **Challenge when appropriate**: If a proposed solution doesn't make sense or there's likely a better approach, say so and explain why
- **Think independently**: Don't default to agreeing with everything the user says; use your own analysis of the code and best practices to guide recommendations
- **Fact-check claims**: If the user makes claims about how the code works, verify them by reading the relevant files before proceeding
- **Admit uncertainty**: Don't make up any information or provide answers you're not sure of, even if that means saying "I don't know"
- **Avoid extra fluff in responses**: Use the minimal number of tokens to communicate your point effectively
- **Use Stock Market standards**: As much as possible, use and suggest stock market standards when it comes to naming, features, formulas and processes.
- **Do not make assumptions**: Always check the codebase and use facts, do not make assumptions.
- **Keep E2E tests updated**: Always check if the E2E tests need to be updated, after making changes to the codebase.
- **Correct syntax for running E2E Tests**: The correct syntax for running the E2E tests is "npx playwright test e2e/portfolio/portfolio-create-and-edit-stock.spec.ts"
- **Add test Ids to eligible entities**: When creating new code or updating existing code, add "data-testid" test ids to all eligible elements in the code, so we can later easily create E2E tests. Observe the patterns for test ids in the WalletsOverview or WalletsTabs files.