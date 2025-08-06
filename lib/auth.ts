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
  logger.info('🚪 signOut: Starting signOut process...')

  // Use storage manager for consistent cleanup
  logger.debug('🚪 signOut: Clearing localStorage tokens...')
  const { clearAuthStorage, setStorageItem } = await import('./storage-utils')
  setStorageItem('logout-in-progress', 'true')

  // PRODUCTION BYPASS: Skip supabase.auth.signOut in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('🚨 PRODUCTION BYPASS: Skipping supabase.auth.signOut()')
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
  logger.info('🚨 BYPASS: Skipping supabase.auth.signOut() due to hanging issues (both prod and dev)')

  // Clear all auth storage using storage manager
  clearAuthStorage()

  // Since we're bypassing supabase.auth.signOut(), manually trigger auth state reset
  // by dispatching a storage event that the auth system can listen to
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('manual-signout', { detail: { timestamp: Date.now() } }));
  }

  logger.debug('🚪 signOut: Manual signout completed successfully')
}

// Token validation and utilities
export async function getCurrentUserToken(): Promise<string | null> {
  const timestamp = new Date().toISOString()
  logger.info(`🔍 [${timestamp}] getCurrentUserToken: Starting token retrieval`)

  try {
    // In production, read from localStorage directly
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'
    logger.debug(`🔍 [${timestamp}] getCurrentUserToken: Environment check - isProduction: ${isProduction}`)

    if (isProduction) {
      const token = localStorage.getItem("sb-access-token");
      logger.info(`🔍 [${timestamp}] getCurrentUserToken: PRODUCTION BYPASS - token found: ${!!token}`)
      if (token) {
        logger.debug('🚨 PRODUCTION BYPASS: Found token in localStorage')
        return token;
      }
      logger.debug('🚨 PRODUCTION BYPASS: No token found in localStorage')
      return null;
    }

    // Development: Use proper Supabase session
    logger.info(`🔍 [${timestamp}] getCurrentUserToken: DEVELOPMENT - calling supabase.auth.getSession()`)
    const sessionStartTime = Date.now()

    const { data, error } = await supabase.auth.getSession();
    const sessionEndTime = Date.now()
    const sessionDuration = sessionEndTime - sessionStartTime

    logger.info(`🔍 [${timestamp}] getCurrentUserToken: getSession completed in ${sessionDuration}ms`)

    if (error) {
      logger.error(`🔍 [${timestamp}] getCurrentUserToken: Error getting current session:`, error);
      return null;
    }

    const token = data.session?.access_token;
    logger.info(`🔍 [${timestamp}] getCurrentUserToken: Session result - hasSession: ${!!data.session}, hasToken: ${!!token}`)
    logger.debug('getCurrentUserToken result:', { hasToken: !!token });
    return token || null;
  } catch (error) {
    logger.error(`🔍 [${timestamp}] getCurrentUserToken: EXCEPTION caught:`, error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  logger.debug('getCurrentUser called')

  try {
    // In production, bypass Supabase and use localStorage
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

    if (isProduction) {
      logger.info('🚨 PRODUCTION BYPASS: getCurrentUser bypassing Supabase')

      // Check if we have stored tokens
      const hasToken = localStorage.getItem("sb-access-token");
      if (!hasToken) {
        logger.debug('🚨 PRODUCTION BYPASS: No access token found')
        return null;
      }

      // Check if we have cached user data
      const cachedUser = localStorage.getItem("sb-user");
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          logger.debug('🚨 PRODUCTION BYPASS: Returning cached user')
          return user;
        } catch (e) {
          logger.debug('🚨 PRODUCTION BYPASS: Failed to parse cached user')
        }
      }

      logger.debug('🚨 PRODUCTION BYPASS: No cached user, returning null (auth hook will handle)')
      return null;
    }

    // Development: Use proper Supabase authentication
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      logger.debug('No authenticated user:', userError?.message);
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Profile fetch failed:', profileError);
      return null;
    }

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

    logger.debug('getCurrentUser success:', { userId: user.id, username: user.username });
    return user;
  } catch (error) {
    logger.error('getCurrentUser error:', error);
    return null;
  }
}

export async function refreshAuthSession(): Promise<boolean> {
  logger.debug('refreshAuthSession called');

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('🚨 PRODUCTION BYPASS: Skipping session refresh')
    return false;
  }

  // Development: Use proper Supabase session refresh
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error('Session refresh failed:', error);
      return false; // Return false to indicate failure
    }
    logger.debug('Session refreshed successfully');
    return true; // Return true to indicate success
  } catch (error) {
    logger.error('refreshAuthSession error:', error);
    return false;
  }
}

export async function handleAuthError(error: any): Promise<boolean> {
  logger.debug('handleAuthError called', { error });

  // Check if this is an auth-related error
  if (
    error?.status === 403 ||
    error?.message?.includes('JWT') ||
    error?.message?.includes('token') ||
    error?.message?.includes('unauthorized') ||
    error?.message?.includes('Unauthorized')
  ) {
    logger.info('🔧 Auth error detected, attempting recovery');

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
          logger.info('User declined page reload for auth recovery');
          return false; // User declined, don't handle the error
        }
      }

      return true; // Indicate we handled the error
    } catch (refreshError) {
      logger.error('Auth recovery failed:', refreshError);
      
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
  logger.debug('validateAuthState called');

  try {
    const token = await getCurrentUserToken();
    const user = await getCurrentUser();

    const isValid = !!(token && user);
    logger.debug('Auth state validation:', { hasToken: !!token, hasUser: !!user, isValid });

    return isValid;
  } catch (error) {
    logger.error('validateAuthState error:', error);
    return false;
  }
}