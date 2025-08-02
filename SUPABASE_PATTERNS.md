# Supabase Common Patterns & Issues

## Empty Response Issue (`Unexpected end of JSON input`)

### Problem
When creating records via Supabase REST API POST requests, the server sometimes returns an empty response (HTTP 201) instead of the created data, causing `JSON.parse()` to fail with "Unexpected end of JSON input".

### Root Cause
Supabase doesn't always return the created data by default. This happens especially when:
- Row Level Security (RLS) policies are involved
- The request doesn't explicitly ask for the data to be returned

### Solution Pattern
Always use the `Prefer: return=representation` header and handle empty responses gracefully:

```typescript
const requestHeaders = {
    ...getAuthHeaders(token),
    'Prefer': 'return=representation'  // Tell Supabase to return the created data
}

const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(data)
})

if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
}

// Check if response has content before parsing JSON
const responseText = await response.text()
if (!responseText || responseText.trim() === '') {
    console.log('Empty response but 201 status - record was created successfully')
    // Return a minimal object with the data we sent plus temporary ID
    return {
        id: `temp-${Date.now()}`,
        ...data,
        created_at: new Date().toISOString(),
    }
}

let result
try {
    result = JSON.parse(responseText)
} catch (parseError) {
    console.error('JSON parse error:', parseError)
    throw new Error(`Invalid JSON response: ${responseText}`)
}

return result[0] || result
```

### Fixed Functions
- ✅ `createPostDirect` - Fixed with proper empty response handling
- ✅ `createCommentDirect` - Fixed with proper empty response handling  
- ✅ `createStartupDirect` - Fixed with proper empty response handling

### Optimistic UI Updates

To provide instant feedback to users, implement optimistic updates for likes and comments:

```typescript
// Update UI immediately, then sync with server
const handleLike = async (postId: string, currentLiked: boolean, currentCount: number) => {
    // 1. Update UI optimistically
    const newLiked = !currentLiked
    const newCount = newLiked ? currentCount + 1 : currentCount - 1
    updatePostLikeOptimistically(postId, newLiked, newCount)
    
    try {
        // 2. Send request to server
        const result = await toggleLikeDirect(postId, userId, token)
        
        // 3. Update with actual server result
        updatePostLikeOptimistically(postId, result.liked, result.likesCount)
    } catch (error) {
        // 4. Revert on error
        updatePostLikeOptimistically(postId, currentLiked, currentCount)
    }
}
```

### Session Management & Auto-Refresh

Handle session timeouts gracefully:

```typescript
export async function getCurrentUserToken(): Promise<string | null> {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        return refreshData?.session?.access_token || null
    }
    
    // Check if token expires soon and refresh proactively
    const now = Math.floor(Date.now() / 1000)
    const tokenExp = session.expires_at || 0
    const timeUntilExpiry = tokenExp - now
    
    if (timeUntilExpiry < 300) { // 5 minutes
        const { data: refreshData } = await supabase.auth.refreshSession()
        return refreshData?.session?.access_token || session.access_token
    }
    
    return session.access_token
}
```

### JWT Token Authentication for RLS

### Problem
Row Level Security (RLS) policies require proper user authentication via JWT tokens.

### Solution Pattern
Always get the user's JWT token and pass it to API functions:

```typescript
const token = await getCurrentUserToken()
if (!token) {
    console.error('No user token available')
    return null
}

const result = await apiFunction(data, token)
```

### Fixed Functions
- ✅ `toggleLikeDirect` - Now properly uses JWT token
- ✅ `createCommentDirect` - Already uses JWT token via `use-comments.ts`
- ✅ `createPostDirect` - Already uses JWT token via main page

## Development Notes

### When to Apply These Patterns
1. **All POST requests** that create data should use the empty response handling pattern
2. **All authenticated operations** should use proper JWT token handling
3. **All RLS-protected tables** require JWT authentication

### Testing
- Test with browser dev tools network tab to see actual responses
- Check for 201 status with empty body
- Verify JWT tokens are being passed in Authorization header
- Monitor console logs for debugging information
