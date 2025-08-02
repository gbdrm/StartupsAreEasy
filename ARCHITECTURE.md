# Architecture Documentation & Guidelines

## Why We Use Direct REST API Instead of Supabase Client

### The Problem We Encountered

1. **Multiple GoTrueClient Instances**: When using the Supabase JS client in a Next.js environment with multiple components and hooks, we encountered "Multiple GoTrueClient instances detected" errors.

2. **Session Management Conflicts**: The Supabase client's automatic session management caused conflicts when multiple components tried to initialize authentication simultaneously.

3. **Persistent Session Issues**: Initially, we avoided persistent sessions due to concerns about client-side hydration mismatches and authentication state synchronization issues.

4. **React Rendering Loops**: The Supabase client's reactive nature caused infinite re-renders when used incorrectly with React hooks.

### The Solution: Direct REST API

We implemented a direct REST API approach (`lib/api-direct.ts`) that:

- Uses `fetch()` directly to Supabase's REST endpoints
- Avoids client-side session management conflicts
- Provides predictable, stateless API calls
- Eliminates multiple client instance issues
- Gives us full control over request/response handling

## Current Architecture Principles

### ✅ What Works Well

1. **Direct REST API**: All data operations use `fetch()` directly
2. **Bulk Operations**: Single API calls for multiple resources (e.g., `getBulkCommentsDirect`)
3. **Memoized Hooks**: `useCallback` with proper dependencies to prevent infinite loops
4. **Global Auth State**: Single source of truth for authentication state
5. **Database Joins**: Server-side joins to avoid N+1 query problems

### ❌ What to Avoid

1. **Multiple Supabase Client Instances**: Never create multiple `createClient()` calls
2. **Individual API Calls in Loops**: Always prefer bulk operations
3. **Unmemoized React Hooks**: Always use `useCallback` for functions passed as dependencies
4. **Client-Side Joins**: Let the database handle relationships

## Future Development Guidelines

### Authentication

```typescript
// ✅ GOOD: Use the existing global auth system
const { user, loading } = useSimpleAuth()

// ❌ AVOID: Creating new Supabase client instances
const newSupabase = createClient(url, key) // Don't do this
```

### Data Fetching

```typescript
// ✅ GOOD: Use direct API with bulk operations
const comments = await getBulkCommentsDirect(postIds)

// ❌ AVOID: Individual API calls in loops
for (const postId of postIds) {
  await getCommentsDirect(postId) // Don't do this
}
```

### React Hooks

```typescript
// ✅ GOOD: Memoized functions with proper dependencies
const loadData = useCallback(async () => {
  // fetch data
}, [dependency1, dependency2])

// ❌ AVOID: Functions without memoization
const loadData = async () => {
  // This will cause infinite re-renders
}
```

### Database Operations

```typescript
// ✅ GOOD: Server-side joins
const url = `${supabaseUrl}/rest/v1/posts?select=id,content,profiles!user_id(username)`

// ❌ AVOID: Client-side joins
const posts = await getPosts()
for (const post of posts) {
  post.user = await getUser(post.user_id) // Don't do this
}
```

## Performance Best Practices

1. **Batch Operations**: Always prefer single bulk API calls over multiple individual calls
2. **React Optimization**: Use `useCallback` and `useMemo` to prevent unnecessary re-renders
3. **Database Efficiency**: Use PostgREST's `select` parameter for joins and filtering
4. **Error Boundaries**: Implement proper error handling for all API calls

## Why Persistent Sessions Were Initially Avoided

1. **SSR/Hydration Issues**: Next.js hydration mismatches when server and client have different auth states
2. **Complexity**: Managing session state across multiple components seemed complex
3. **Control**: Direct API calls gave us more predictable behavior

However, the current implementation in `lib/supabase.ts` does use persistent sessions:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // We DO use persistent sessions now
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})
```

## Migration Path for Future Features

When adding new features:

1. **Start with Direct API**: Use `lib/api-direct.ts` pattern
2. **Design for Bulk**: Plan for multiple records from the beginning
3. **Memoize Everything**: Wrap all async functions in `useCallback`
4. **Test Performance**: Monitor for infinite loops and excessive API calls
5. **Document Decisions**: Update this file with any architectural changes

## Key Files

- `lib/api-direct.ts` - Direct REST API functions
- `hooks/use-simple-auth.ts` - Global authentication state
- `hooks/use-comments.ts` - Memoized comment management
- `lib/supabase.ts` - Single Supabase client instance (used minimally)

## Remember

The goal is **simplicity, performance, and predictability**. When in doubt, choose the approach that:
- Reduces API calls
- Eliminates client-side complexity
- Provides clear, debuggable behavior
- Follows the existing patterns in this codebase
