import { supabase } from "./supabase";
import { logger } from './logger'
import type { User } from "./types";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export async function signOut(): Promise<void> {
  logger.info('AUTH', 'Starting signOut process')

  // Use storage manager for consistent cleanup
  logger.debug('AUTH', 'Clearing localStorage tokens')
  const { clearAuthStorage, setStorageItem } = await import('./storage-utils')
  setStorageItem('logout-in-progress', 'true')

  // PRODUCTION BYPASS: Skip supabase.auth.signOut in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('AUTH', 'PRODUCTION BYPASS: Skipping supabase.auth.signOut()')
    // Clear all auth storage using storage manager
    clearAuthStorage()

    // Force page reload to clear state
    setTimeout(() => {
      window.location.reload()
    }, 100)
    return;
  }

  // BYPASS: Skip supabase.auth.signOut due to hanging issues
  // Apply same bypass as getSession - Supabase auth calls are unreliable
  logger.info('AUTH', 'BYPASS: Skipping supabase.auth.signOut() due to hanging issues (both prod and dev)')

  // Clear all auth storage using storage manager
  clearAuthStorage()

  // Since we're bypassing supabase.auth.signOut(), manually trigger auth state reset
  // by dispatching a storage event that the auth system can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manual-signout', { detail: { timestamp: Date.now() } }));
  }

  logger.debug('AUTH', 'Manual signout completed successfully')
}

// Token validation and utilities
export async function getCurrentUserToken(): Promise<string | null> {
  try {
    // Unified approach: Always check localStorage first for better stability
    const storedToken = localStorage.getItem("sb-access-token");

    if (storedToken) {
      // Validate token is not expired (basic check)
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp > now) {
          logger.debug('AUTH', 'Using valid stored token');
          return storedToken;
        } else {
          logger.debug('AUTH', 'Stored token expired, removing');
          localStorage.removeItem("sb-access-token");
        }
      } catch (tokenError) {
        logger.debug('AUTH', 'Invalid stored token, removing');
        localStorage.removeItem("sb-access-token");
      }
    }

    // Only try Supabase session if no valid stored token and not in production
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost';

    if (!isProduction) {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!error && data.session?.access_token) {
          // Store the fresh token for future use
          localStorage.setItem("sb-access-token", data.session.access_token);
          logger.debug('AUTH', 'Got fresh token from session');
          return data.session.access_token;
        }
      } catch (sessionError) {
        logger.debug('AUTH', 'Session check failed, continuing without token');
      }
    }

    logger.debug('AUTH', 'No valid token available');
    return null;
  } catch (error) {
    logger.error('AUTH', 'Error in getCurrentUserToken', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  logger.debug('AUTH', 'getCurrentUser called')

  // Simple in-memory debounce (avoid multiple concurrent calls) & short-term cache
  const CACHE_KEY = 'sb-profile-cache'
  const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
  const lastCallKey = '__getCurrentUser_inflight'
  const lastProfileFetchKey = '__lastProfileFetchAt'
  const MIN_INTERVAL_MS = 4000 // throttle full network path within 4s window
    // Track timeout for caller diagnostics
    ; (window as any).__lastGetCurrentUserTimedOut = (window as any).__lastGetCurrentUserTimedOut || false
    ; (window as any).__lastGetCurrentUserSoft = false
    ; (window as any).__lastGetCurrentUserStartedAt = Date.now()
  const nowTs = Date.now()
  const w = typeof window !== 'undefined' ? (window as any) : null

  // Reuse in-flight promise if present to prevent duplicate network hits
  if (w && w[lastCallKey]) {
    logger.debug('AUTH', 'Joining in-flight getCurrentUser promise')
    try {
      return await w[lastCallKey]
    } catch {
      // fall through to new attempt
    }
  }

  // Throttle: if last profile fetch happened very recently, use cache only
  if (w && w[lastProfileFetchKey] && (nowTs - w[lastProfileFetchKey]) < MIN_INTERVAL_MS) {
    try {
      const cachedRaw = localStorage.getItem('sb-profile-cache')
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw)
        const user: User = {
          id: cached.profile.id,
          name: `${cached.profile.first_name ?? ''} ${cached.profile.last_name ?? ''}`.trim(),
          username: cached.profile.username ?? '',
          avatar: cached.profile.avatar_url ?? '',
          telegram_id: cached.profile.telegram_id,
          first_name: cached.profile.first_name,
          last_name: cached.profile.last_name,
          bio: cached.profile.bio,
          location: cached.profile.location,
          website: cached.profile.website,
          joined_at: cached.profile.created_at
        }
        logger.debug('AUTH', 'Throttle short-circuit: returning cached user (recent fetch)')
        return user
      }
    } catch {/* ignore */ }
  }

  try {
    // In production, bypass Supabase and use localStorage
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

    if (isProduction) {
      logger.debug('AUTH', 'PRODUCTION BYPASS: getCurrentUser bypassing Supabase')

      // Check if we have stored tokens
      const hasToken = localStorage.getItem("sb-access-token");
      if (!hasToken) {
        logger.debug('AUTH', 'PRODUCTION BYPASS: No access token found')
        return null;
      }

      // Check if we have cached user data
      const cachedUser = localStorage.getItem("sb-user");
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          logger.debug('AUTH', 'PRODUCTION BYPASS: Returning cached user')
          return user;
        } catch {
          logger.debug('AUTH', 'PRODUCTION BYPASS: Failed to parse cached user')
        }
      }

      logger.debug('AUTH', 'PRODUCTION BYPASS: No cached user, returning null (auth hook will handle)')
      return null;
    }

    // Development: Use proper Supabase authentication with adaptive timeout
    logger.debug('AUTH', 'Development mode: starting Supabase auth check')

    // Extended timeout: background tabs throttle timers & network; 5s was producing false negatives
    const GET_USER_TIMEOUT_MS = 12000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`getCurrentUser timeout after ${GET_USER_TIMEOUT_MS}ms`)), GET_USER_TIMEOUT_MS)
    })

    const authPromise = async () => {
      // Fast path: session in memory (avoid network call of getUser())
      const sessionStart = Date.now()
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const sessionDuration = Date.now() - sessionStart
      if (!sessionError && sessionData.session?.user) {
        logger.debug('AUTH', `getSession() fast path in ${sessionDuration}ms`)
        const fastUser = { user: sessionData.session.user }
        // proceed to profile fetch (still cacheable)
        return await buildUserWithProfile(fastUser as any)
      }

      logger.debug('AUTH', 'Falling back to getUser() (timeout=' + GET_USER_TIMEOUT_MS + 'ms)')
      const startTime = Date.now()
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const getUserDuration = Date.now() - startTime
      logger.debug('AUTH', `getUser() took ${getUserDuration}ms`)

      if (userError || !userData?.user) {
        logger.debug('AUTH', 'No authenticated user', userError);
        return null;
      }

      return await buildUserWithProfile(userData)
    }

    async function buildUserWithProfile(userData: { user: { id: string } }) {
      // Check cached profile first
      try {
        const cachedRaw = localStorage.getItem(CACHE_KEY)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          if (cached.userId === userData.user.id && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            logger.debug('AUTH', 'Returning cached profile (build helper)')
            return { userData, profile: cached.profile }
          }
        }
      } catch (cacheErr) {
        logger.debug('AUTH', 'Profile cache parse failed', cacheErr)
      }
      logger.debug('AUTH', 'Fetching profile (build helper)...', { userId: userData.user.id })
      const profileStart = Date.now()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single()
      logger.debug('AUTH', `Profile query took ${Date.now() - profileStart}ms (build helper)`)
      if (profileError || !profile) {
        logger.error('AUTH', 'Profile fetch failed', profileError)
        return null
      }
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ userId: userData.user.id, profile, cachedAt: Date.now() }))
      } catch (cacheStoreErr) {
        logger.debug('AUTH', 'Failed to store profile cache', cacheStoreErr)
      }
      logger.debug('AUTH', 'Successfully got user profile (build helper)')
      if (w) w[lastProfileFetchKey] = Date.now()
      return { userData, profile }
    }

    try {
      const inflight = authPromise()
      if (w) w[lastCallKey] = inflight
      const result = await Promise.race([inflight, timeoutPromise])
      if (w) delete w[lastCallKey]
      if (!result) return null

      const { userData, profile } = result

      const user: User = {
        id: profile.id,
        name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        username: profile.username ?? "",
        avatar: profile.avatar_url ?? "",
        telegram_id: profile.telegram_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        joined_at: profile.created_at
      };

      logger.debug('AUTH', 'getCurrentUser success', { userId: user.id, username: user.username });
      return user;
    } catch (timeoutError) {
      // Mark soft timeout (not a real sign-out). Downgrade severity to debug to reduce noise.
      ; (window as any).__lastGetCurrentUserTimedOut = true
      logger.debug('AUTH', 'getCurrentUser timed out (soft, keeping existing user)', { message: (timeoutError as Error)?.message })
      return null; // Soft timeout
    }
  } catch (error) {
    logger.error('AUTH', 'getCurrentUser error', error);
    return null;
  }
}

export function wasLastGetCurrentUserTimeout(): boolean {
  return !!(window as any).__lastGetCurrentUserTimedOut
}

export async function refreshAuthSession(): Promise<boolean> {
  logger.debug('AUTH', 'refreshAuthSession called');

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('AUTH', 'PRODUCTION BYPASS: Skipping session refresh')
    return false;
  }

  // Development: Use proper Supabase session refresh
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error('AUTH', 'Session refresh failed', error);
      return false; // Return false to indicate failure
    }
    logger.debug('AUTH', 'Session refreshed successfully');
    return true; // Return true to indicate success
  } catch (error) {
    logger.error('AUTH', 'refreshAuthSession error', error);
    return false;
  }
}

export async function handleAuthError(error: unknown): Promise<boolean> {
  logger.debug('AUTH', 'handleAuthError called', { error });

  // Check if this is an auth-related error
  const errorObj = error as Record<string, unknown>;
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorObj?.status === 403 ||
    errorMessage?.includes('JWT') ||
    errorMessage?.includes('token') ||
    errorMessage?.includes('unauthorized') ||
    errorMessage?.includes('Unauthorized')
  ) {
    logger.info('AUTH', 'Auth error detected, attempting recovery');

    try {
      // Try to refresh the session first
      const refreshSucceeded = await refreshAuthSession();

      if (!refreshSucceeded) {
        // Refresh failed, ask user before reloading
        const userConfirmed = confirm(
          'Your session has expired. The page needs to reload to re-authenticate. Continue?'
        );

        if (userConfirmed) {
          window.location.reload();
        } else {
          logger.info('AUTH', 'User declined page reload for auth recovery');
          return false; // User declined, don't handle the error
        }
      }

      return true; // Indicate we handled the error
    } catch (refreshError) {
      logger.error('AUTH', 'Auth recovery failed', refreshError);

      // Ask user before forcing reload as last resort
      const userConfirmed = confirm(
        'Authentication recovery failed. The page needs to reload. Continue?'
      );

      if (userConfirmed) {
        window.location.reload();
      }
      return userConfirmed;
    }
  }

  return false; // Not an auth error
}

export async function validateAuthState(): Promise<boolean> {
  logger.debug('AUTH', 'validateAuthState called');

  try {
    const token = await getCurrentUserToken();
    const user = await getCurrentUser();

    const isValid = !!(token && user);
    logger.debug('AUTH', 'Auth state validation', { hasToken: !!token, hasUser: !!user, isValid });

    return isValid;
  } catch (error) {
    logger.error('AUTH', 'validateAuthState error', error);
    return false;
  }
}