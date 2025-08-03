# AI Coding Agent Instructions for StartupsAreEasy

## Architecture Overview
This is a Next.js 15 social platform with a unique **direct REST API architecture** instead 12. **Auth Timeout Issues**: If app gets stuck on "Getting session...", user sessions may be stale after long inactivity - use `emergencyAuthReset()` for stuck states. Extended timeout to 15 seconds for production reliability.
13. **Production Telegram Issues**: Telegram authentication may show wrong email or fail to update UI. Added comprehensive debugging and force page reload after successful sign-in to ensure UI consistency.
14. **Email Conflicts**: Real emails in database can conflict with Telegram fake emails (`telegram-ID@telegram.local`). Use `debugTelegramUser()` function to diagnose expected vs actual email lookup issues.f traditional Supabase client patterns. The project uses TypeScript, Supabase PostgreSQL, and Telegram authentication.

### Critical Architectural Decisions
- **Direct REST API**: All database operations use `fetch()` to Supabase REST endpoints (`lib/api-direct.ts`) to avoid multiple GoTrueClient instances
- **Global Auth State**: Single authentication system using `useSimpleAuth()` hook with pub-sub pattern
- **Bulk Operations**: Always prefer single API calls over loops (e.g., `getBulkCommentsDirect()`)
- **JWT Authentication**: All authenticated operations require token from `getCurrentUserToken()`

### Page Architecture Patterns
The app uses different rendering strategies depending on the page:

**Client-Only Pages** (Most Common):
- `app/page.tsx` (Homepage) - Full client component with `useEffect` data fetching
- `app/profile/[username]/page.tsx` - Full client component with auth-dependent data loading
- Pattern: `"use client"` at top, all data fetching in `useEffect`, auth handled by global state

**Server + Client Hybrid** (Specific Use Cases):
- `app/posts/[id]/page.tsx` - Server component for initial data + client wrapper for interactions
- Pattern: Server fetches public data, client handles auth-dependent features
- Note: Server components cannot access user auth context, so like status requires client-side updates

**Auth Consistency Rules**:
- All auth state changes trigger `window.location.reload()` for data consistency
- Never use complex `useEffect` patterns to sync auth state - rely on page reloads
- Client-only pages are preferred for auth-dependent features
- Server components are only used for public data that benefits from SSR/SEO

## Essential Patterns

### Logging (Use `lib/logger.ts` - NEVER console.log)
```typescript
import { logger } from "@/lib/logger"

// ✅ Correct - Production-safe logging
logger.debug("Component state", { user, loading })  // Development only
logger.info("User action completed", { userId })     // Info level
logger.warn("Deprecated feature used", context)      // Warnings
logger.error("API call failed", error, context)      // Always shows
logger.api("GET /api/posts", "GET", { userId })      // API calls (dev only)

// ❌ Wrong - Exposes logs in production
console.log("Debug info:", data)
console.error("Error:", error)
```

### API Functions (Follow `lib/api-direct.ts` patterns)
```typescript
// All API functions must handle empty Supabase responses
const requestHeaders = {
    ...getAuthHeaders(token),
    'Prefer': 'return=representation'  // Critical for POST requests
}

// Always check response.text() before JSON.parse()
const responseText = await response.text()
if (!responseText.trim()) {
    return { id: `temp-${Date.now()}`, ...data } // Handle empty 201 responses
}

// ✅ Correct - Centralized error handling with user-friendly messages
if (!response.ok) {
    const errorText = await response.text()
    if (errorText.includes('Authentication token required')) {
        throw new Error("You must be logged in to perform this action. Please sign in and try again.")
    }
    // Other specific error handling...
    throw new Error(`Operation failed: ${errorText}`)
}

// ❌ Wrong - Messy error detection patterns scattered across pages
if (errorMessage.includes('startups_slug_key') || 
    errorMessage.includes('duplicate key value') ||
    errorMessage.includes('already exists')) {
    // This should be handled in the API function instead
}
```

### Duplicate Detection Pattern
```typescript
// ✅ Correct - Check availability first
export async function checkStartupNameAvailable(name: string): Promise<boolean> {
    const url = `${supabaseUrl}/rest/v1/startups?select=id&name=eq.${encodeURIComponent(name)}`
    const response = await fetch(url, { headers })
    const data = await response.json()
    return data.length === 0
}

// Use before creating
const isAvailable = await checkStartupNameAvailable(startup.name)
if (!isAvailable) {
    throw new Error("A startup with this name already exists. Please choose a different name.")
}

// ❌ Wrong - Catching constraint violations with complex string matching
const isDuplicateSlug = response.status === 409 || 
    errorText.includes('startups_slug_key') || 
    errorText.includes('duplicate key value') ||
    errorText.includes('violates unique constraint')
```

### Authentication Architecture
- **Global State**: Use `useSimpleAuth()` hook (NOT `useAuth()` - that's legacy) 
- **Page Reloads**: Auth state changes trigger `window.location.reload()` for consistency
- **No Complex Syncing**: Avoid `useEffect` patterns to sync auth - let page reloads handle it
- **Client-Only Auth**: Server components cannot access auth context - use client components for auth-dependent features
- **Development**: Fake login available when `NEXT_PUBLIC_DEV_EMAIL/PASSWORD` environment variables are set
- **Production**: Telegram authentication via `/supabase/functions/telegram.ts`
- **RLS Tokens**: All authenticated operations require `getCurrentUserToken()` for Row Level Security
- **Timeout Handling**: Auth operations have 10-second timeouts to prevent hanging on stale sessions
- **Emergency Reset**: Use `emergencyAuthReset()` function when auth state gets stuck after long inactivity

### React Hooks
```typescript
// Always memoize async functions to prevent infinite loops
const loadData = useCallback(async () => {
    // Never include loading state in dependencies
}, [userId]) // Only stable external dependencies

// Auth pattern in components
const { user, loading } = useSimpleAuth()
if (loading) return <Loading />
if (!user) return <LoginPrompt />
```

## Key File Structure
- `lib/api-direct.ts` - All database operations (REST API pattern)
- `hooks/use-simple-auth.ts` - Global auth state (preferred)
- `hooks/use-auth.ts` - Legacy auth hook (avoid in new code)
- `lib/constants.ts` - Environment flags and UI constants
- `docs/DEV_PATTERNS.md` - Comprehensive development templates
- `docs/SUPABASE_PATTERNS.md` - Supabase-specific issues and solutions

## Development Workflow
```bash
# Start development
pnpm dev

# Run comprehensive tests
npm test              # Main test suite with database checks
node tests/test-*.js  # Individual component tests

# TypeScript validation (essential for migrations)
npx tsc --noEmit --incremental  # Check for compilation errors

# Database setup
# Run SQL scripts in order: scripts/01-create-tables.sql, 05-add-startups-schema.sql, etc.
```

## Migration Workflow
When migrating components from legacy patterns:
1. **Check TypeScript**: `npx tsc --noEmit --incremental` to identify all errors
2. **Migrate Systematically**: Fix one component at a time, not all at once
3. **Validate Each Step**: Run TypeScript check after each component fix
4. **Component Interface Alignment**: Remove props that components now handle internally
5. **Hook Signature Matching**: Ensure function signatures match component expectations

## Common Pitfalls to Avoid
1. **Multiple Supabase Clients**: Never create new `createClient()` instances
2. **N+1 Queries**: Use bulk operations (`getBulkCommentsDirect()`) not loops
3. **React Infinite Loops**: Include loading state setters in `useCallback` dependencies
4. **Missing JWT Tokens**: All RLS operations need `getCurrentUserToken()`
5. **Direct JSON Parsing**: Always use `response.text()` first, then parse
6. **Component Prop Drilling**: Components like `Header`, `AuthDialog`, `CollapsiblePostForm`, and `PostCard` manage auth internally via `auth-context` - don't pass auth props
7. **Hook Function Signatures**: `useComments()` expects callback function as second parameter, not setState directly
8. **Production Logging**: NEVER use `console.log()` - always use `logger` from `lib/logger.ts` for production-safe logging
9. **Error Handling**: Centralize error handling in API functions - don't duplicate error detection patterns across pages
10. **Availability Checks**: Use dedicated availability check functions instead of catching duplicate errors
11. **Complex Auth Syncing**: Avoid `useEffect` patterns to sync auth state - rely on `window.location.reload()` for auth consistency
12. **Server Component Auth**: Server components cannot access user auth context - handle auth-dependent features on client side
13. **Auth Timeout Issues**: If app gets stuck on "Getting session...", user sessions may be stale after long inactivity - use `emergencyAuthReset()` for stuck states

## Component Migration Patterns

### Auth Context Integration
```typescript
// ❌ Wrong - Prop drilling auth state
<Header user={user} onLogin={login} onLogout={logout} />
<AuthDialog open={show} onOpenChange={setShow} onLogin={login} />
<CollapsiblePostForm user={user} onSubmit={handleSubmit} />

// ✅ Correct - Components use auth-context internally
<Header />
<AuthDialog open={show} onOpenChange={setShow} />
<CollapsiblePostForm onSubmit={handleSubmit} />
```

### Hook Usage Patterns
```typescript
// ❌ Wrong - Passing setState directly
const { comments, handleLike } = useComments(user, setPosts)

// ✅ Correct - Use callback wrapper
const { comments, handleLike } = useComments(user, () => setPosts([...posts]))

// ❌ Wrong - Component expects different signature
<PostCard onLike={handleLike} />

// ✅ Correct - Wrap with proper signature
<PostCard onLike={(postId) => handleLike(postId, post.liked_by_user, post.likes_count)} />
```

### Error Handling Patterns
```typescript
// ✅ Correct - Let API handle error categorization
try {
    await createStartupDirect(data, token)
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    setError(errorMessage) // API already provides user-friendly message
}

// ❌ Wrong - Duplicate error categorization in UI components
try {
    await createStartupDirect(data, token)
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage.includes('startups_slug_key') || 
        errorMessage.includes('duplicate key value')) {
        setError("A startup with this name already exists...")
    } else if (errorMessage.includes('Authentication token required')) {
        setError("You must be logged in...")
    }
    // This logic should be in the API function instead
}
```

## Database Patterns
- PostgREST joins: `/posts?select=*,profiles!user_id(username,avatar_url)`
- Bulk operations: `/posts?id=in.(${ids.join(',')})`
- RLS policies require proper JWT tokens in Authorization header

## Environment Setup
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key  # For admin operations
NEXT_PUBLIC_DEV_EMAIL=test@example.com      # Development only
NEXT_PUBLIC_DEV_PASSWORD=secure_password    # Development only
```

## Testing & Debugging
- Comprehensive test suite covers all API endpoints and auth flows
- Diagnostics page at `/diagnostics` for runtime system health checks
- All API functions include timestamped logging for debugging
- Use `lib/logger.ts` for environment-aware logging (mandatory - never use console.log)
- Logger automatically filters debug logs in production, shows all errors
- Debug logs: `logger.debug()`, Info: `logger.info()`, Errors: `logger.error()`

Refer to `docs/` folder for detailed patterns, troubleshooting guides, and architectural decisions.
