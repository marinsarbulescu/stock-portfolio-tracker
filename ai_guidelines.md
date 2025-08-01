# AI Development Guidelines

## Core Principles
- **Verify before accepting**: If the user provides information or suggestions that seem questionable, verify them by examining the codebase rather than accepting them at face value
- **Challenge when appropriate**: If a proposed solution doesn't make sense or there's likely a better approach, say so and explain why
- **Think independently**: Don't default to agreeing with everything the user says; use your own analysis of the code and best practices to guide recommendations
- **Fact-check claims**: If the user makes claims about how the code works, verify them by reading the relevant files before proceeding
- **Admit uncertainty**: Don't make up any information or provide answers you're not sure of, even if that means saying "I don't know"
- **Do not make assumptions**: Always check the codebase and use facts, do not make assumptions
- **Reuse components**: Always check the codebase for components to reuse, do not just create new components that could duplicate functionality.

## Communication Guidelines
- **Avoid extra fluff in responses**: Use the minimal number of tokens to communicate your point effectively
- **It is ok to ask for browser console logs**: If asking the user to provide a screenshot of the browser console logs, when debugging an issue, it is more efficient than other longer/more resource intensive debugging options, feel free to do just that

## Domain-Specific Standards
- **Use Stock Market standards**: As much as possible, use and suggest stock market standards when it comes to naming, features, formulas and processes

## Testing & E2E Guidelines
- **Keep E2E tests updated**: Always check if the E2E tests need to be updated, after making changes to the codebase
- **Use established patterns for new E2E tests**: When creating new E2E tests, use the patterns established in existing E2E tests like wallet-add-transaction.spec.ts
- **Don't run headed tests unless necessary**
- **Correct syntax for running E2E Tests**: The correct syntax for running the E2E tests is "npx playwright test e2e/portfolio/portfolio-create-and-edit-stock.spec.ts"
- **Add test Ids to eligible entities**: When creating new code or updating existing code, add "data-testid" test ids to all eligible elements in the code, so we can later easily create E2E tests. Observe the patterns for test ids in the WalletsOverview or WalletsTabs files

## Git & Version Control
- **Proper file deletion**: When deleting files, always use `git rm "filename"` instead of `Remove-Item` or `rm`. This ensures git properly tracks the deletion and prevents VS Code from regenerating empty files on restart. Only use `Remove-Item` for untracked files that were never committed
- **Git push workflow**: When user asks to push changes, use a single compound command to minimize VS Code confirmation clicks: `git add . ; git commit -m "descriptive message" ; git push`

## Development Environment
- **Asking to run development server**: There is no need for asking the user to run the dev server, because the dev server is always running, that's how the user is testing the changes in real time. Rather that asking to run the server, you could ask the user to test the changes directly in the browser