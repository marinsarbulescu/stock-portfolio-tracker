# Claude Code Development Guidelines

## Core Principles
- **Verify before accepting**: Always examine the codebase to verify user claims rather than accepting them at face value
- **Use critical thinking**: If a proposed solution doesn't align with best practices or seems suboptimal, suggest better alternatives
- **Be proactive but measured**: Take initiative to complete tasks thoroughly, but avoid making changes beyond what was requested
- **Fact-check with code**: Always read relevant files to understand how the code actually works before making changes
- **Be transparent**: If you're unsure about something, say so clearly rather than guessing
- **No assumptions**: Always check the codebase for facts instead of making assumptions
- **Reuse existing patterns**: Study existing components and patterns in the codebase before creating new ones

## Communication Style
- **Be concise**: Provide clear, direct responses without unnecessary explanation
- **Focus on essentials**: Only include information directly relevant to the task at hand
- **Ask for clarification**: When requirements are ambiguous, ask specific questions to clarify

## Task Management
- **Use TodoWrite tool**: For multi-step tasks, use the TodoWrite tool to track progress and give visibility to the user
- **Mark progress accurately**: Update todo items to 'in_progress' when starting and 'completed' immediately after finishing
- **Break down complex tasks**: Divide large tasks into smaller, manageable todos

## Code Quality & Build Verification
- **Run build after significant changes**: After modifying types, interfaces, or component props, run `npm run build` to catch TypeScript errors. Before running the build, stop the development server. After the build is successful, re-start the dev server.
- **Check lint regularly**: Use `npm run lint` to maintain code quality standards
- **When to verify**:
  - After modifying TypeScript types or interfaces
  - After changing component props or function signatures
  - After refactoring or moving files
  - Before completing complex tasks
  - After adding new imports or dependencies
- **Fix errors immediately**: Build errors must be resolved before continuing; lint warnings can be contextual

## Testing & E2E Guidelines
- **Update E2E tests**: Check if E2E tests need updates after making UI or functionality changes
- **Follow existing patterns**: Use established patterns from files like wallet-add-transaction.spec.ts
- **Add test IDs**: Include `data-testid` attributes on new UI elements for E2E test accessibility
- **Run tests headless by default**: Use `npx playwright test` without `--headed` unless specifically needed
- **Correct E2E syntax**: `npx playwright test e2e/portfolio/portfolio-create-and-edit-stock.spec.ts`

## Domain-Specific Standards
- **Follow stock market conventions**: Use standard financial terminology and calculations
- **Maintain consistency**: Follow existing naming patterns for financial entities (stocks, wallets, transactions)

## Git & Version Control
- **Never commit unless asked**: Only create commits when explicitly requested by the user
- **Use git rm for deletions**: Use `git rm "filename"` instead of file system commands to properly track deletions
- **Atomic commits**: When asked to commit, include all related changes in a single, well-described commit

## Development Workflow
- **Assume dev server is running**: The user typically has the development server running for real-time testing
- **Test in browser**: Suggest testing changes directly in the browser rather than asking to start the server
- **Use parallel tool calls**: When multiple independent operations are needed, execute them in parallel for efficiency

## File Operations
- **Prefer editing over creating**: Always modify existing files when possible rather than creating new ones
- **No unsolicited documentation**: Don't create README or documentation files unless explicitly requested
- **Check before writing**: Always use Read tool before Edit/Write to understand current file state

## Error Handling
- **Provide actionable solutions**: When encountering errors, suggest specific fixes
- **Check logs when needed**: Request browser console screenshots for client-side debugging when appropriate
- **Handle failures gracefully**: If a tool operation fails, explain why and provide alternatives