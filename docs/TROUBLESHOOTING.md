# Technical Troubleshooting Guide

## Common Issues & Solutions

### 1. "Multiple GoTrueClient instances detected"

**Symptoms:**
- Console warnings about multiple auth clients
- Authentication state inconsistencies
- Session conflicts

**Root Cause:**
- Multiple components creating separate Supabase client instances
- Hot-reloading in development creating duplicate clients

**Solution:**
- Use single client instance from `lib/supabase.ts`
- For data operations, prefer `lib/api-direct.ts` (no client needed)
- Ensure global auth state via `hooks/use-simple-auth.ts`

### 2. Infinite API Call Loops

**Symptoms:**
- Console flooded with identical API calls
- Browser becomes unresponsive
- Excessive network requests

**Root Cause:**
- React hooks without proper memoization
- Dependency array issues in `useEffect`/`useCallback`

**Solution:**
```typescript
// ✅ CORRECT
const loadData = useCallback(async () => {
  // API call
}, [dependency1, dependency2]) // Proper dependencies

// ❌ WRONG
const loadData = async () => {
  // This recreates on every render
}
```

### 3. N+1 Query Problems

**Symptoms:**
- Many individual API calls for related data
- Slow page loading
- High server load

**Root Cause:**
- Fetching related data in loops
- Not using database joins

**Solution:**
```typescript
// ✅ CORRECT - Bulk operation
const comments = await getBulkCommentsDirect(postIds)

// ❌ WRONG - N+1 queries  
for (const postId of postIds) {
  await getCommentsDirect(postId)
}
```

### 4. Authentication State Issues

**Symptoms:**
- User appears logged out randomly
- Authentication required errors
- Inconsistent user data

**Root Cause:**
- Multiple auth state sources
- Session persistence issues
- Token expiration handling

**Solution:**
- Use only `useSimpleAuth()` hook
- Check `lib/auth.ts` for session handling
- Ensure token refresh is working

### 5. TypeScript Errors After Schema Changes

**Symptoms:**
- Type mismatches in API responses
- Missing properties on objects
- Compilation errors

**Root Cause:**
- Database schema changed but types not updated
- API response structure changed

**Solution:**
- Update `lib/types.ts` to match database
- Check API response structure
- Run type checking: `pnpm type-check`

## Debugging Strategies

### 1. API Call Debugging

```typescript
// Add logging to track API calls
console.log(`[${new Date().toISOString()}] API call: ${endpoint}`)
```

### 2. React Render Debugging

```typescript
// Track component re-renders
useEffect(() => {
  console.log('Component rendered:', { prop1, prop2 })
})
```

### 3. Authentication Debugging

```typescript
// Check auth state
const { user, loading } = useSimpleAuth()
console.log('Auth state:', { user: user?.id, loading })
```

## Performance Monitoring

### Key Metrics to Watch

1. **API Call Frequency**: Should see bulk calls, not individual ones
2. **Component Re-renders**: Minimize with proper memoization
3. **Network Requests**: Batch operations reduce request count
4. **Console Errors**: No authentication or client conflicts

### Performance Checklist

- [ ] Using bulk API calls where possible
- [ ] All async functions are memoized with `useCallback`
- [ ] No multiple Supabase client instances
- [ ] Database joins used instead of client-side fetching
- [ ] Error boundaries implemented
- [ ] Loading states handled properly

## Emergency Fixes

### Quick Fix for Infinite Loops

1. Add `useCallback` to all async functions
2. Check `useEffect` dependency arrays
3. Verify no functions are recreated on each render

### Quick Fix for Auth Issues

1. Clear browser localStorage/sessionStorage
2. Restart development server
3. Check environment variables are set
4. Verify `lib/supabase.ts` configuration

### Quick Fix for API Issues

1. Check network tab for failed requests
2. Verify environment variables
3. Test API endpoints directly in browser
4. Check Supabase dashboard for errors

## Code Quality Rules

### Always Do

- Use TypeScript strictly (no `any` types)
- Implement error handling for all API calls
- Add loading states for async operations
- Memoize functions passed to other components
- Use bulk operations for multiple records

### Never Do

- Create multiple Supabase client instances
- Use API calls inside render functions
- Ignore TypeScript errors
- Create unmemoized functions in React components
- Use synchronous operations for data fetching

## Architecture Validation

Before merging code, verify:

1. No console warnings about multiple clients
2. API calls are batched appropriately
3. No infinite loops in network tab
4. Authentication works consistently
5. Performance is acceptable (< 3 second load times)

This document should be updated whenever new patterns or issues are discovered.
