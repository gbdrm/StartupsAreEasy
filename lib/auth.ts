import { supabase } from "./supabase";
import { HAS_FAKE_LOGIN, STORAGE_KEYS, API_ENDPOINTS } from "./constants";
import { logger } from './logger'
import { authCircuitBreaker } from './auth-circuit-breaker'
import type { User } from "./types";

// Safe reload function that works in both browser and SSR
function safeReload() {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export async function signInWithTelegram(telegramUser: TelegramUser): Promise<User> {
  logger.debug('signInWithTelegram called', {
    id: telegramUser.id,
    username: telegramUser.username,
    first_name: telegramUser.first_name,
    HAS_FAKE_LOGIN,
    NODE_ENV: process.env.NODE_ENV,
    hasEnvEmail: !!process.env.NEXT_PUBLIC_DEV_EMAIL,
    hasEnvPassword: !!process.env.NEXT_PUBLIC_DEV_PASSWORD
  })

  // AGGRESSIVE PRODUCTION BYPASS: Skip all Supabase auth calls in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

  logger.info('🔍 Environment detection', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
    isProduction
  })

  if (isProduction) {
    logger.info('🚨 AGGRESSIVE PRODUCTION BYPASS: Skipping all Supabase auth calls')

    try {
      // Call backend to get JWT (this part works)
      const res = await fetch(API_ENDPOINTS.TELEGRAM_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telegramUser),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error('Telegram login failed', { status: res.status, errorText });
        throw new Error("Telegram login failed");
      }

      const { access_token, refresh_token } = await res.json();

      // Store tokens directly and reload (only in browser)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("sb-access-token", access_token);
        localStorage.setItem("sb-refresh-token", refresh_token);

        logger.info('🚨 PRODUCTION BYPASS: Tokens stored, skipping setSession (causes hanging)')

        // Store tokens for getCurrentUserToken() to find
        localStorage.setItem("sb-access-token", access_token);
        localStorage.setItem("sb-refresh-token", refresh_token);

        // Mark that we completed login successfully (prevents reload loops)
        localStorage.setItem("telegram-login-complete", "true")
      }

      // Return a minimal user that will get replaced by onAuthStateChange
      // when the auth hook detects the stored tokens
      const tempUser: User = {
        id: 'temp-loading', // Safe ID that won't cause UUID errors
        name: telegramUser.first_name || 'Loading...',
        username: telegramUser.username || 'loading',
        avatar: '',
        telegram_id: telegramUser.id,
        first_name: telegramUser.first_name || 'Loading',
        last_name: telegramUser.last_name || '',
        bio: undefined,
        location: undefined,
        website: undefined,
        joined_at: new Date().toISOString()
      }

      logger.info('🚨 PRODUCTION BYPASS: Returning temp user, auth hook will load real profile')
      return tempUser

    } catch (error) {
      logger.error('🚨 PRODUCTION BYPASS ERROR:', error)
      throw error
    }
  }

  // Local dev override - use proper Supabase authentication
  if (HAS_FAKE_LOGIN) {
    logger.info('Using fake login for development')
    // For local development, sign in with a test email/password
    // This creates a real Supabase session with proper auth.uid()
    const testEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
    const testPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD;

    if (!testEmail || !testPassword) {
      throw new Error("Local dev credentials not found. Please set NEXT_PUBLIC_DEV_EMAIL and NEXT_PUBLIC_DEV_PASSWORD in .env.local");
    }

    // Try to sign in with existing test user
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // If user doesn't exist, create them
    if (authError && authError.message.includes("Invalid login credentials")) {
      logger.info("Creating test user for local development...");
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      if (signUpError || !signUpData.user || !signUpData.session) {
        throw new Error(`Failed to create test user: ${signUpError?.message}`);
      }

      // Use the sign up data directly
      authData = {
        user: signUpData.user,
        session: signUpData.session
      };
      authError = null;
    }

    if (authError || !authData?.user) {
      throw new Error(`Local dev auth failed: ${authError?.message}`);
    }

    const authUserId = authData.user.id;

    // Get or create profile for the authenticated user
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_url")
      .eq("id", authUserId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: authUserId,
          username: "localdev",
          first_name: "Local",
          last_name: "Developer",
        })
        .select()
        .single();

      if (createError || !newProfile) {
        throw new Error(`Failed to create profile: ${createError?.message}`);
      }
      profile = newProfile;
    } else if (profileError || !profile) {
      throw new Error(`Profile error: ${profileError?.message || 'Profile not found'}`);
    }

    return {
      id: profile!.id,
      name: `${profile!.first_name ?? ""} ${profile!.last_name ?? ""}`.trim(),
      username: profile!.username ?? "",
      avatar: profile!.avatar_url ?? "",
      first_name: profile!.first_name,
      last_name: profile!.last_name,
    };
  }

  logger.info('Using real Telegram authentication')
  // Call backend to get JWT
  const res = await fetch(API_ENDPOINTS.TELEGRAM_LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telegramUser),
  });
  if (!res.ok) {
    const errorText = await res.text();
    logger.error('Telegram login failed', { status: res.status, errorText });
    throw new Error("Telegram login failed");
  }

  logger.debug('Response OK, parsing JSON...')
  const { access_token, refresh_token } = await res.json();
  logger.debug('JSON parsed successfully')

  logger.debug('Setting session...')

  // Store JWT in localStorage for production bypass (only in browser)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem("sb-access-token", access_token);
  }

  // PRODUCTION BYPASS: Skip setSession in production due to hanging issue
  if (isProduction) {
    logger.info('Production bypass: Skipping setSession call due to hanging issue')
    logger.info('Tokens stored, forcing page reload for session consistency')

    // Store tokens in localStorage for manual session management
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("sb-refresh-token", refresh_token);
    }

    // Force page reload to let onAuthStateChange handle the session
    setTimeout(() => {
      safeReload()
    }, 500) // Short delay to ensure tokens are stored

    // Return a temporary user object - the reload will establish proper session
    return {
      id: `temp-${Date.now()}`,
      name: "Loading...",
      username: "loading",
      avatar: "",
      telegram_id: undefined,
      first_name: "Loading...",
      last_name: "",
      bio: undefined,
      location: undefined,
      website: undefined,
      joined_at: new Date().toISOString()
    } as User
  }

  logger.debug('Calling supabase.auth.setSession...')

  // Add timeout wrapper to prevent hanging (development only)
  const setSessionPromise = supabase.auth.setSession({
    access_token,
    refresh_token
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('setSession timeout after 10 seconds')), 10000);
  });

  const { data: sessionData, error: sessionError } = await Promise.race([
    setSessionPromise,
    timeoutPromise
  ]);

  logger.debug('setSession completed', {
    hasSessionData: !!sessionData,
    hasError: !!sessionError,
    errorMessage: sessionError?.message
  })

  if (sessionError) {
    logger.error('Session error:', sessionError);
    throw new Error("Failed to set session");
  }

  // Get user from JWT
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    logger.error('No authenticated user after setting session:', userError);
    throw new Error("No authenticated user found after setting JWT");
  }
  const user = userData.user;

  logger.debug('Got user from session:', {
    id: user.id,
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata
  })

  // Upsert profile info
  logger.debug('Upserting profile with data:', {
    id: user.id,
    username: telegramUser.username || `user_${telegramUser.id}`,
    first_name: telegramUser.first_name,
    last_name: telegramUser.last_name,
    avatar_url: telegramUser.photo_url
  })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      username: telegramUser.username || `user_${telegramUser.id}`,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      avatar_url: telegramUser.photo_url,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError || !profile) {
    logger.error('Profile upsert failed:', profileError);
    throw new Error("Failed to update profile");
  }

  logger.debug('Profile upserted successfully:', profile)

  return {
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
}

export async function signOut(): Promise<void> {
  logger.debug('signOut called')

  // Clear localStorage tokens first (only in browser)
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem("sb-access-token");
    localStorage.removeItem("sb-refresh-token");
    localStorage.removeItem("telegram-login-complete");
  }

  // PRODUCTION BYPASS: Skip supabase.auth.signOut in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('🚨 PRODUCTION BYPASS: Skipping supabase.auth.signOut()')
    // Clear all our custom localStorage items
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem("sb-user");
      localStorage.removeItem("sb-access-token");
      localStorage.removeItem("sb-refresh-token");
    }

    // Force page reload to clear state
    setTimeout(() => {
      safeReload()
    }, 100)
    return;
  }

  // Development: Use proper Supabase signOut
  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.error('SignOut error:', error);
    throw new Error("Failed to sign out");
  }

  // Clear all our custom localStorage items (only in browser)
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem("sb-user");
    localStorage.removeItem("sb-access-token");
    localStorage.removeItem("sb-refresh-token");
  }

  logger.debug('signOut completed successfully')
}

// Token validation and utilities
export async function getCurrentUserToken(): Promise<string | null> {
  logger.debug('getCurrentUserToken called')

  try {
    // In production, read from localStorage directly (SSR safe)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

    if (isProduction) {
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem("sb-access-token");
        if (token) {
          logger.debug('🚨 PRODUCTION BYPASS: Found token in localStorage')
          return token;
        }
      }
      logger.debug('🚨 PRODUCTION BYPASS: No token found in localStorage')
      return null;
    }

    // Development: Use proper Supabase session
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logger.error('Error getting current session:', error);
      return null;
    }

    const token = data.session?.access_token;
    logger.debug('getCurrentUserToken result:', { hasToken: !!token });
    return token || null;
  } catch (error) {
    logger.error('getCurrentUserToken error:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  logger.debug('getCurrentUser called')

  try {
    // In production, bypass Supabase and use localStorage (SSR safe)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

    if (isProduction) {
      logger.info('🚨 PRODUCTION BYPASS: getCurrentUser bypassing Supabase')

      // Check if we have stored tokens
      if (typeof localStorage !== 'undefined') {
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

export async function refreshAuthSession(): Promise<void> {
  logger.debug('refreshAuthSession called');

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

  if (isProduction) {
    logger.info('🚨 PRODUCTION BYPASS: Skipping session refresh')
    return;
  }

  // Development: Use proper Supabase session refresh
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      logger.error('Session refresh failed:', error);
      // Don't throw - let the app handle auth state naturally
      return;
    }
    logger.debug('Session refreshed successfully');
  } catch (error) {
    logger.error('refreshAuthSession error:', error);
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
      await refreshAuthSession();

      // If that doesn't work, force a page reload
      setTimeout(() => {
        safeReload();
      }, 1000);

      return true; // Indicate we handled the error
    } catch (refreshError) {
      logger.error('Auth recovery failed:', refreshError);
      // Force reload as last resort
      setTimeout(() => {
        safeReload();
      }, 1000);
      return true;
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
