import { supabase } from "./supabase";
import { HAS_FAKE_LOGIN, STORAGE_KEYS, API_ENDPOINTS } from "./constants";
import { logger } from "./logger";
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

      // Store tokens directly and reload
      localStorage.setItem("sb-access-token", access_token);
      localStorage.setItem("sb-refresh-token", refresh_token);

      logger.info('🚨 PRODUCTION BYPASS: Tokens stored, forcing page reload')
      
      // Don't return any user object - this prevents ANY database calls
      // Force immediate page reload and let onAuthStateChange handle everything
      
      // Mark that we're in a reload state so components know to wait
      localStorage.setItem("auth-reload-pending", "true")
      
      // Force immediate page reload - no user object returned
      if (typeof window !== 'undefined') {
        logger.info('🚨 PRODUCTION BYPASS: Page reloading immediately...')
        window.location.reload()
      }
      
      // This code should never be reached due to reload, but just in case:
      // Throw a special error that the auth hook will handle gracefully
      throw new Error("AUTH_RELOAD_IN_PROGRESS")

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

  // Store JWT in localStorage for production bypass
  localStorage.setItem("sb-access-token", access_token);

  // PRODUCTION BYPASS: Skip setSession in production due to hanging issue
  if (isProduction) {
    logger.info('Production bypass: Skipping setSession call due to hanging issue')
    logger.info('Tokens stored, forcing page reload for session consistency')

    // Store tokens in localStorage for manual session management
    localStorage.setItem("sb-refresh-token", refresh_token);

    // Force page reload to let onAuthStateChange handle the session
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
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
    console.error('Session error:', sessionError);
    throw new Error("Failed to set session");
  }

  // Get user from JWT
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.error('No authenticated user after setting session:', userError);
    throw new Error("No authenticated user found after setting JWT");
  }
  const user = userData.user;

  console.log('🔵 Got user from session:', {
    id: user.id,
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata
  })

  // Upsert profile info
  console.log('🔵 Upserting profile with data:', {
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
  if (profileError) {
    console.error('Profile upsert error:', profileError);
    throw profileError;
  }

  console.log('🔵 Profile upserted successfully:', {
    id: profile.id,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name
  })

  const userResult = {
    id: user.id,
    name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    username: profile.username ?? "",
    avatar: profile.avatar_url ?? "",
    first_name: profile.first_name,
    last_name: profile.last_name,
  }

  console.log('🔵 Returning user object:', userResult)

  return userResult;
}

export async function getCurrentUserProfile(): Promise<User | null> {
  try {
    // Get current user from Supabase auth
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.log(`getCurrentUserProfile: Auth error:`, authError.message)
      return null
    }

    if (!userData?.user) {
      console.log(`getCurrentUserProfile: No authenticated user found`)
      return null // No need to log this, it's normal when not authenticated
    }

    const user = userData.user;
    console.log(`getCurrentUserProfile: Found authenticated user:`, user.id, user.email)

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log(`getCurrentUserProfile: Profile error:`, profileError.message)
      return null
    }

    if (!profile) {
      console.log(`getCurrentUserProfile: No profile found for user:`, user.id)
      return null
    }

    console.log(`getCurrentUserProfile: Found profile:`, profile.first_name, profile.last_name, `(@${profile.username})`)

    const userProfile = {
      id: user.id,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      username: profile.username ?? "",
      avatar: profile.avatar_url ?? "",
      first_name: profile.first_name,
      last_name: profile.last_name,
    }

    return userProfile
  } catch (error) {
    console.error(`getCurrentUserProfile: Unexpected error:`, error)
    return null
  }
}

export async function getCurrentUserToken(): Promise<string | null> {
  try {
    logger.debug('getCurrentUserToken: Getting session...')

    // PRODUCTION BYPASS: Use localStorage token directly in production
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || typeof window !== 'undefined' && window.location.hostname !== 'localhost'

    if (isProduction) {
      const token = localStorage.getItem('sb-access-token')
      if (token) {
        logger.debug('getCurrentUserToken: Using production bypass with localStorage token')
        return token
      } else {
        logger.debug('getCurrentUserToken: No token in localStorage for production bypass')
        return null
      }
    }

    // Add timeout to prevent hanging (development only)
    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Session timeout')), 10000) // 10 second timeout
    })

    let sessionResult
    try {
      sessionResult = await Promise.race([sessionPromise, timeoutPromise])
    } catch (timeoutError) {
      logger.error('Session request timed out, clearing auth state', timeoutError)
      // Force sign out and reload page
      await signOut()
      window.location.reload()
      return null
    }

    const { data: { session }, error } = sessionResult

    if (error) {
      logger.error('Error getting session', error)
      // Try to refresh the session
      logger.debug('Attempting to refresh session...')
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError || !refreshData.session) {
          logger.error('Session refresh failed', refreshError)
          // Clear auth state and reload
          await signOut()
          window.location.reload()
          return null
        }

        logger.info('Session refreshed successfully')
        return refreshData.session.access_token
      } catch (refreshErr) {
        logger.error('Session refresh threw error', refreshErr)
        await signOut()
        window.location.reload()
        return null
      }
    }

    logger.debug('Session found', { hasSession: !!session, hasAccessToken: !!session?.access_token })

    if (!session) {
      logger.debug('No session found - user might not be authenticated')
      // Clear any stale auth state and reload
      await signOut()
      window.location.reload()
      return null
    }

    // Check if token is close to expiring (within 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const tokenExp = session.expires_at || 0
    const timeUntilExpiry = tokenExp - now

    if (timeUntilExpiry < 300) { // 5 minutes
      logger.debug('Token expires soon, refreshing...')
      try {
        const refreshPromise = supabase.auth.refreshSession()
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Refresh timeout')), 10000) // 10 second timeout
        })

        const { data: refreshData, error: refreshError } = await Promise.race([refreshPromise, timeoutPromise])

        if (refreshError || !refreshData.session) {
          logger.warn('Token refresh failed, clearing auth state', refreshError)
          await signOut()
          window.location.reload()
          return null
        }

        logger.info('Token refreshed proactively')
        return refreshData.session.access_token
      } catch (refreshErr) {
        logger.error('Token refresh timeout or error', refreshErr)
        await signOut()
        window.location.reload()
        return null
      }
    }

    const token = session.access_token
    logger.debug('Returning token', { hasToken: !!token, tokenLength: token?.length })
    return token
  } catch (error) {
    logger.error("Error getting user token", error)
    // On any unexpected error, clear auth state and reload
    try {
      await signOut()
      window.location.reload()
    } catch (signOutError) {
      logger.error("Error during emergency signout", signOutError)
      window.location.reload()
    }
    return null
  }
}

export async function signOut() {
  try {
    // Clear localStorage items
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.FAKE_USER_SESSION)

    // Sign out from Supabase
    await supabase.auth.signOut()

    console.log('✅ Successfully signed out and cleared all local storage')
  } catch (error) {
    console.error('❌ Error during signOut:', error)
    // Even if there's an error, clear local storage
    localStorage.removeItem(STORAGE_KEYS.SUPABASE_ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.FAKE_USER_SESSION)
    throw error
  }
}

// Emergency function to clear all auth state and reload page
// Call this when the app gets stuck or auth is in a bad state
export async function emergencyAuthReset() {
  console.log('🚨 Emergency auth reset triggered')
  try {
    // Clear all possible auth storage
    localStorage.clear()
    sessionStorage.clear()

    // Force sign out
    await supabase.auth.signOut()

    // Clear any cookies (if any)
    document.cookie.split(";").forEach(function (c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    })

    console.log('🚨 Emergency reset complete, reloading page')
    window.location.href = '/' // Force full reload
  } catch (error) {
    console.error('❌ Error during emergency reset:', error)
    // Even if there's an error, force reload
    window.location.href = '/'
  }
}

// Diagnostic function to check auth configuration (useful for debugging)
export function debugAuthConfig() {
  const config = {
    NODE_ENV: process.env.NODE_ENV,
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
    hasDevEmail: !!process.env.NEXT_PUBLIC_DEV_EMAIL,
    hasDevPassword: !!process.env.NEXT_PUBLIC_DEV_PASSWORD,
    HAS_FAKE_LOGIN: HAS_FAKE_LOGIN,
    telegramEndpoint: API_ENDPOINTS.TELEGRAM_LOGIN
  }

  console.log('🔍 Auth Configuration:', config)
  return config
}

// Debug function to help diagnose email conflicts in production
export async function debugTelegramUser(telegramId: number) {
  const expectedEmail = `telegram-${telegramId}@telegram.local`

  console.log('🔍 Debugging Telegram user lookup:', {
    telegramId,
    expectedEmail,
    timestamp: new Date().toISOString()
  })

  return {
    telegramId,
    expectedEmail,
    telegramEndpoint: API_ENDPOINTS.TELEGRAM_LOGIN
  }
}

// Add this to window for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).debugTelegramUser = debugTelegramUser;
  (window as any).debugAuthConfig = debugAuthConfig;
  (window as any).emergencyAuthReset = emergencyAuthReset;
}
