# StartupsAreEasy - Clean Architecture Documentation

## Overview
This is a **pure client-side Next.js application** deployed as a static site on Vercel. There is no server-side rendering (SSR) or server-side components.

## Architecture Components

### Frontend (Client-Only)
- **Next.js 15 App Router** with `"use client"` directive on all pages
- **Static Site Generation (SSG)** - pre-built at deployment time
- **Client-side routing** and state management
- **Supabase Browser SDK** for database and authentication

### Backend Services
- **Supabase Database** - PostgreSQL with Row Level Security (RLS)
- **Supabase Auth** - JWT-based authentication
- **Single Edge Function** - Telegram login endpoint only (`/api/telegram-login`)

### Deployment
- **Vercel Static Hosting** - no server functions, just static files
- **Environment Variables** - managed through Vercel dashboard
- **Build Process** - `pnpm build` generates static assets

## Key Architectural Decisions

### No SSR Guards Needed
Since all pages use `"use client"` and the app is deployed statically:
- ❌ No need for `typeof window !== 'undefined'` checks  
- ❌ No need for `typeof localStorage !== 'undefined'` checks
- ❌ No need for safe wrapper functions around browser APIs
- ✅ Direct usage of `window`, `localStorage`, `document` is safe

### Authentication Flow
1. **Telegram Widget** - client-side login widget
2. **Edge Function** - `/api/telegram-login` validates and issues JWT tokens
3. **Client Storage** - tokens stored in localStorage
4. **Page Reload** - forces re-authentication check on successful login

### Data Flow
```
User -> Telegram Widget -> Edge Function -> JWT Tokens -> localStorage -> Client Auth State
```

### File Structure
```
app/                  # All pages with "use client"
components/           # Client-side React components  
lib/                  # Client-side utilities and auth
hooks/                # React hooks for state management
supabase/functions/   # Single Telegram login edge function
```

## Important Notes

### Build Process
- Build runs Next.js static analysis but **no actual SSR**
- All pages are pre-rendered as static HTML
- No server-side code execution at runtime

### Error Prevention
- All browser APIs are available without checks
- No need for "safe" wrapper functions
- Direct `window.location.reload()` instead of wrapped versions

### Future Development
When adding new features, remember:
- This is a **client-only application**
- No server-side rendering considerations needed
- Use browser APIs directly without safety checks
- All state management happens client-side

This architecture provides simplicity and performance while avoiding the complexity of SSR/hydration issues.
