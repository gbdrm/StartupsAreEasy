# Authentication Troubleshooting Guide

## Production Auth Issues & Solutions

### Tab Switching Auth Failures (FIXED)
**Problem**: Likes and comments return 403 Forbidden errors after switching tabs and returning

**Symptoms**: 
- "new row violates row-level security policy for table 'likes'" after tab switch
- Authentication token appears valid but RLS policies fail
- Session timeout errors appearing after idle time

**Root Cause**: JWT tokens expire or become invalid while tab is inactive, but the app doesn't detect this properly

**Solution Implemented**:
1. **Token Expiration Validation**: Added JWT payload parsing to check expiration before API calls
2. **Page Visibility Handling**: Enhanced `usePageVisibility` hook to validate auth when returning to tab
3. **Automatic Error Recovery**: All auth-related API errors (403, JWT errors) now trigger page reload
4. **Smart Timeout Strategy**: Progressive timeouts (2s → fallback) with circuit breaker pattern instead of long waits
5. **Auth Utilities**: New `auth-utils.ts` with comprehensive error detection and handling

### Supabase Auth Hanging Issue
**Problem**: `supabase.auth.getSession()` may hang indefinitely in production even when auth endpoints return 200 status

**Symptoms**: 
- Page loads with extended timeouts
- "Failsafe timeout" and "Initial session timed out" errors after 10-15 seconds
- App gets stuck on "Getting session..." loading state

**Root Cause**: Supabase JavaScript client has issues with session retrieval in production environments, while REST endpoints work fine

**Solution**: Production bypass in `useSimpleAuth` hook that skips initial session check but preserves all auth functionality through `onAuthStateChange` listener

### Environment Detection
The production bypass activates when any of these conditions are true:
```typescript
const isProduction = process.env.NODE_ENV === 'production' || 
                    process.env.VERCEL_ENV === 'production' || 
                    (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
```

### Auth Debugging Steps
1. **Test auth endpoints directly**: 
   ```bash
   curl https://your-project.supabase.co/auth/v1/settings
   # Should return 200
   ```

2. **Check REST API**: 
   ```bash
   curl https://your-project.supabase.co/rest/v1/
   # Should work normally
   ```

3. **Environment check**: Verify `NODE_ENV` and that production/development use same Supabase URLs

4. **Network inspection**: Look for hanging requests in browser Network tab

5. **Use diagnostics page**: Visit `/diagnostics` and run "Debug Telegram Login" test

### Telegram Authentication Debugging

#### Common Issues:
- **Profile Missing telegram_id**: Check if user profile has `telegram_id` field populated for proper lookup
- **Email Conflicts**: Database may have both real email users and fake telegram email users
- **UI Update Issues**: Force page reload after successful authentication to ensure UI consistency
- **JWT vs Session Mismatch**: JWT payload may contain correct user while session shows different email

#### Debug Functions:
```javascript
// In browser console:
debugTelegramUser(123456789)  // Check expected email for Telegram ID
debugAuthConfig()             // View current auth configuration
emergencyAuthReset()          // Clear all auth state and reload
```

### Emergency Auth Reset
When the app gets stuck in an auth state:

```javascript
emergencyAuthReset()
```

This function:
1. Clears all localStorage and sessionStorage
2. Signs out from Supabase
3. Clears cookies
4. Forces full page reload to `/`

### Production Bypass Architecture

#### How It Works:
1. **Login Process**: 
   - Calls Telegram backend function to get JWT tokens
   - Stores tokens in localStorage
   - Skips `supabase.auth.setSession()` (which hangs)
   - Returns temp user object

2. **Token Management**:
   - `getCurrentUserToken()` reads from localStorage in production
   - `getCurrentUserProfile()` uses direct REST API calls with Bearer token
   - All database operations use JWT authentication

3. **Auth State**:
   - Auth hook detects stored tokens
   - Loads real user profile via direct API
   - Maintains same security level as normal Supabase auth

#### Security Notes:
- Production bypass maintains same Row Level Security (RLS) protection
- JWT tokens are validated by Supabase on every request
- No reduction in security - just bypasses hanging client calls
- Auth state is still managed centrally through `useSimpleAuth` hook

### Testing Auth Issues

#### Local Development:
1. Set environment variables in `.env.local`:
   ```bash
   NEXT_PUBLIC_DEV_EMAIL=test@example.com
   NEXT_PUBLIC_DEV_PASSWORD=secure_password
   ```

2. Fake login will be available when both variables are set

#### Production Testing:
1. Use `/diagnostics` page for comprehensive auth testing
2. "Debug Telegram Login" shows step-by-step auth flow verification
3. "Test Current Auth" checks your actual auth state

#### Common Error Messages:
- **"Auth session missing!"**: Indicates production bypass is needed
- **"Getting session..." hanging**: Use `emergencyAuthReset()`
- **401 Unauthorized in diagnostics**: Expected for mock data - endpoint is working correctly
- **403 Forbidden**: Check JWT token validity and RLS policies

### Best Practices

1. **Always use `useSimpleAuth()` hook** - never create auth state manually
2. **Let page reloads handle auth changes** - don't try to sync state with useEffect
3. **Use `getCurrentUserToken()` for all authenticated API calls**
4. **Test in both development and production environments**
5. **Monitor auth state with diagnostics page during development**
6. **Handle tab switching gracefully** - auth system now validates tokens when returning to tab
7. **Automatic recovery from auth failures** - likes/comments will trigger page reload on 403 errors

### Common Issues After Tab Switching

**Problem**: Likes and comments return 403 Forbidden errors after switching tabs and returning
**Cause**: JWT tokens expire or become stale while tab is inactive
**Solution**: Updated auth system now:
- Validates stored tokens for expiration before use
- Automatically refreshes auth state when returning to tab
- Triggers page reload on RLS policy violations (403 errors)
- Extends session timeout to 15 seconds for better reliability

### Error Recovery Mechanisms

The auth system now automatically handles these error scenarios:
- **Token expiration**: Validates JWT payload expiration before API calls
- **Tab switch auth failure**: Re-validates auth when page becomes visible  
- **RLS policy violations**: Detects 403 errors and triggers auth refresh
- **Session timeouts**: Smart 2-second timeouts with immediate stored token fallback
- **Circuit breaker**: Prevents repeated hangs by opening circuit after 3 failures (30s cooldown)

### Testing the Fixes

#### Browser Console Tests
Run these commands in browser console to test auth resilience:

```javascript
// Test all auth fixes
runAuthTests()

// Test individual components
testTokenValidation()
testAuthErrorDetection() 
testCurrentAuthState()
simulateTabSwitch()

// Manual utilities
isTokenExpired(yourToken)
isAuthError(someError)
// Test circuit breaker utilities
authCircuitBreaker.isOpen()
authCircuitBreaker.reset()
```

#### Expected Behavior After Fixes
1. **Tab Switch Recovery**: Switching tabs and returning should not break likes/comments
2. **Token Validation**: Expired tokens are detected and trigger refresh automatically  
3. **Error Recovery**: 403/auth errors trigger page reload for fresh authentication
4. **Smart Timeouts**: Quick 2-second timeouts with immediate fallback to stored tokens
5. **Circuit Breaker**: Prevents repeated hanging by falling back after 3 failures
6. **Debug Tools**: Enhanced logging and browser console utilities for troubleshooting

### Monitoring & Logging

The auth system uses `lib/logger.ts` for production-safe logging:
- `logger.debug()`: Development-only debugging info
- `logger.info()`: Important auth events (login, logout, bypass activation, token refresh)
- `logger.error()`: Auth errors and failures
- `logger.warn()`: Deprecated features or unusual conditions

Enhanced logging now includes:
- Token expiration checks and validation results
- Page visibility auth state validation  
- Detailed error categorization for auth vs non-auth errors
- Tab switch simulation results

View logs in browser console during development, they're filtered in production.
