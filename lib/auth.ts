import { supabase } from "./supabase";
import { HAS_FAKE_LOGIN, STORAGE_KEYS, API_ENDPOINTS } from "./constants";
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
  // Local dev override - use proper Supabase authentication
  if (HAS_FAKE_LOGIN) {
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
      console.log("Creating test user for local development...");
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

  // Call backend to get JWT
  const res = await fetch(API_ENDPOINTS.TELEGRAM_LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telegramUser),
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Telegram login failed:', res.status, errorText);
    throw new Error("Telegram login failed");
  }
  const { access_token, refresh_token } = await res.json();

  // Store JWT in localStorage and set session
  localStorage.setItem("sb-access-token", access_token);
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token
  });

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

  // Upsert profile info
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
  if (profileError) throw profileError;

  return {
    id: user.id,
    name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    username: profile.username ?? "",
    avatar: profile.avatar_url ?? "",
    first_name: profile.first_name,
    last_name: profile.last_name,
  };
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
      return null // No need to log this, it's normal when not authenticated
    }

    const user = userData.user;

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
    console.log('🔑 getCurrentUserToken: Getting session...')

    // Try to get the session with a shorter timeout and auto-refresh
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Error getting session:', error)
      // Try to refresh the session
      console.log('🔄 Attempting to refresh session...')
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError || !refreshData.session) {
        console.error('❌ Session refresh failed:', refreshError)
        return null
      }

      console.log('✅ Session refreshed successfully')
      return refreshData.session.access_token
    }

    console.log('🔑 Session found:', !!session, 'has access_token:', !!session?.access_token)

    if (!session) {
      console.log('❌ No session found - user might not be authenticated')
      return null
    }

    // Check if token is close to expiring (within 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    const tokenExp = session.expires_at || 0
    const timeUntilExpiry = tokenExp - now

    if (timeUntilExpiry < 300) { // 5 minutes
      console.log('🔄 Token expires soon, refreshing...')
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError || !refreshData.session) {
        console.warn('⚠️ Token refresh failed, using existing token:', refreshError)
        return session.access_token
      }

      console.log('✅ Token refreshed proactively')
      return refreshData.session.access_token
    }

    const token = session.access_token
    console.log('🔑 Returning token:', token ? 'YES (length: ' + token.length + ')' : 'NO')
    return token
  } catch (error) {
    console.error("❌ Error getting user token:", error)
    return null
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}
