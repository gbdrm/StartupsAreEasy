# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

**Development:**
- `pnpm dev` - Start development server at http://localhost:3000
- `pnpm install` - Install dependencies

**Building & Linting:**
- `pnpm build` - Build production static site
- `pnpm lint` - Run ESLint checks
- `pnpm start` - Start production server (after build)

**Testing:**
- `npm test` - Run the test suite (uses Node.js test runner)
- `npm run test:watch` - Run tests in watch mode
- Individual test files are in `tests/` directory

## High-Level Architecture

This is a **client-side Next.js 15 application** deployed as static assets on Vercel. The architecture prioritizes performance and simplicity by avoiding SSR complexity.

### Core Principles
- **Pure client-side**: All pages use `"use client"` directive
- **Hybrid API approach**: Supabase SDK for auth, direct REST API for data
- **Static deployment**: Built with `next build` for Vercel static hosting

### Key Architectural Components

**Authentication System:**
- Custom Telegram Bot integration with Supabase Auth
- Global auth hook: `useSimpleAuth()` in `hooks/use-simple-auth.ts`
- Polling-based login flow via `/api/check-login` route
- Production bypass for hanging session issues

**Data Layer:**
- Direct REST API calls in `lib/api-direct.ts` to avoid client conflicts
- RLS-protected database operations requiring user tokens
- Bulk loading patterns to prevent N+1 queries

**Database Flow:**
```
Frontend → Data Hook → lib/api-direct.ts → Supabase REST API → PostgreSQL
```

**Auth Flow:**
```
User → Telegram Bot → Edge Function → Supabase Auth → useSimpleAuth Hook
```

### Important Files & Patterns

**Core Authentication:**
- `hooks/use-simple-auth.ts` - Global auth state management
- `lib/auth.ts` - Auth utilities and token management
- `lib/api-direct.ts` - All database operations (CRUD)
- `supabase/functions/telegram-confirm/` - Telegram login edge function

**Data Patterns:**
- Use `getPostsWithDetailsInternal()` for consistent post loading
- Use bulk operations like `getBulkCommentsDirect()` for efficiency
- All mutations require user tokens for RLS

**React Patterns:**
- Memoize async functions with `useCallback` to prevent re-renders
- Use global auth context, avoid creating new Supabase clients
- Prefer server-side joins in REST API calls over client-side loops

### Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEXT_PUBLIC_DEV_EMAIL=dev-test@example.com
NEXT_PUBLIC_DEV_PASSWORD=secure-dev-password
```

### Database Schema Key Points
- Posts have optional `startup_id` foreign key relationships
- Comments use `profiles` join for user information  
- RLS policies require authenticated users for mutations
- `get_posts_with_details` RPC function handles complex joins

### Testing Approach
- Custom Node.js test suite in `tests/` directory
- Direct API testing against Supabase endpoints
- Auth flow testing with mock scenarios

## Development Guidelines

**DO:**
- Use `useSimpleAuth()` for user state
- Use functions from `lib/api-direct.ts` for all data operations
- Memoize functions in React hook dependencies
- Use bulk API calls when loading related data
- Follow existing TypeScript patterns in `lib/types.ts`

**DON'T:**
- Create new Supabase client instances in components
- Use Supabase JS client for data operations (auth only)
- Make API calls in loops (causes N+1 problems)
- Bypass RLS by using service role key in client code
- Add SSR or server components (keep client-side only)