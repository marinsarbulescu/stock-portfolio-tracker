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

### Testing
- Use `data-testid` attributes for E2E tests
- Prefer semantic selectors over CSS class selectors

## Deployment
- Push to `beta` branch deploys to beta.mystocs.com
- Amplify Hosting handles CI/CD automatically

## AWS Resources (Sandbox)
- **Cognito User Pool**: `amplifyAuthUserPool4BA7F805-AjKwZ77Os3T6`
- **Region**: us-east-2
- **Admin User ID**: `010b75c0-30c1-7061-dd29-1c5e38c4a042`
