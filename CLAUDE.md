# Stock Portfolio Tracker - Development Guide

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: AWS Amplify Gen 2
- **Auth**: AWS Cognito (admin-creates-users-only)
- **Database**: DynamoDB via Amplify Data
- **API**: GraphQL via AWS AppSync

## Project Structure
```
├── amplify/              # Amplify Gen 2 backend
│   ├── auth/             # Cognito authentication config
│   ├── data/             # GraphQL schema and data models
│   └── backend.ts        # Main backend definition
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── (authed)/     # Protected routes (require login)
│   │   └── login/        # Public login page
│   ├── components/       # React components
│   └── utils/            # Utility functions
```

## Development Commands
```bash
# Start Amplify sandbox (local backend) - REQUIRED before npm run dev
npx ampx sandbox

# Start Next.js dev server (in a separate terminal)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

**Important**: You must run `npx ampx sandbox` before `npm run dev` to generate `amplify_outputs.json`.

## Key Conventions

### Authentication
- All routes under `(authed)/` require authentication
- Users are created manually via AWS Cognito Console
- No self-registration allowed

### Data Models
- All models use owner-based authorization
- Each user only sees their own data
- Use GraphQL selection sets to minimize data transfer

### After Schema Changes
Run sandbox to regenerate types:
```bash
npx ampx sandbox --once
```

### Testing (TDD Required)

**This project follows Test-Driven Development (TDD) as the default workflow.**

#### TDD Cycle
1. **Red**: Write a failing test that describes the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up the code while keeping tests green

#### When to Write Tests First
- **Utility functions**: Always write tests before implementation
- **React components**: Write tests for expected behavior/rendering
- **API handlers**: Test expected inputs/outputs
- **Business logic**: Test all edge cases before coding

#### Test Organization
- Place tests in `__tests__/` directories next to source files
- Name test files: `{filename}.test.ts` or `{filename}.test.tsx`
- Use descriptive test names that explain the expected behavior

#### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

#### Testing Guidelines
- Use `data-testid` attributes for component selection
- Prefer semantic queries (getByRole, getByLabelText) over test IDs when possible
- Mock external dependencies (API calls, Amplify client)
- Keep tests focused and independent

## Deployment
- Push to `beta` branch deploys to beta.mystocs.com
- Amplify Hosting handles CI/CD automatically

## AWS Resources

### Sandbox (Local Development)
- **Cognito User Pool**: `amplifyAuthUserPool4BA7F805-AjKwZ77Os3T6`
- **DynamoDB Table ID**: `yuxh2uw64jgnfon4amqqm7trmu`
- **Region**: us-east-2
- **Admin User ID**: `010b75c0-30c1-7061-dd29-1c5e38c4a042`

### Production (beta.mystocs.com)
- **Cognito User Pool**: `amplifyAuthUserPool4BA7F805-lEKM7HRpFKht`
- **DynamoDB Table ID**: `73xhjaml3jcblg3stg5txx3wge`
- **Region**: us-east-2
- **Admin User ID**: `110b85c0-5021-70b3-22de-f6877bd250af`
