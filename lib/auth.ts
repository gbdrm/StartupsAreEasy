import { supabase } from "./supabase";
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
  // Local dev override
  if (process.env.NEXT_PUBLIC_DEFAULT_USER_ID) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_url")
      .eq("id", process.env.NEXT_PUBLIC_DEFAULT_USER_ID)
      .single();
    if (error || !profile) throw new Error("Could not find default profile for local dev");
    return {
      id: profile.id,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      username: profile.username ?? "",
      avatar: profile.avatar_url ?? "",
      first_name: profile.first_name,
      last_name: profile.last_name,
    };
  }

  // Call backend to get JWT
  console.log('[DEBUG] Calling backend with Telegram data:', telegramUser);
  const res = await fetch("https://jymlmpzzjlepgqbimzdf.functions.supabase.co/tg-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telegramUser),
  });
  if (!res.ok) {
    console.error('[ERROR] Backend response not OK:', res.status, await res.text());
    throw new Error("Telegram login failed");
  }
  const { access_token, refresh_token } = await res.json();
  console.log('[DEBUG] Received tokens:', {
    access_token: access_token?.slice(0, 20) + '...', // only log beginning of token for security
    has_refresh_token: !!refresh_token
  });

  // Decode JWT for debugging
  decodeJwt(access_token); // This will show us the actual content of the JWT

  // Store JWT in localStorage and set session
  localStorage.setItem("sb-access-token", access_token);
  console.log('[DEBUG] About to set Supabase session');
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token
  });
  console.log('[DEBUG] setSession result:', { data: sessionData, error: sessionError });

  // Get user from JWT
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log('[DEBUG] getUser result:', { data: userData, error: userError });
  if (userError || !userData?.user) {
    console.error('[ERROR] No authenticated user after setting session');
    throw new Error("No authenticated user found after setting JWT");
  }
  const user = userData.user;
  console.log('[DEBUG] Successfully got user:', { id: user.id, email: user.email });

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

export async function getCurrentUserProfile() {
  // Restore JWT from localStorage if present
  const access_token = localStorage.getItem("sb-access-token");
  if (access_token) {
    await supabase.auth.setSession({ access_token, refresh_token: "" });
  }

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) return null;
  const user = userData.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) return null;

  return {
    id: user.id,
    email: user.email,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
  };
}

export async function signOut() {
  localStorage.removeItem("sb-access-token");
  await supabase.auth.signOut();
}

function decodeJwt(token: string) {
  const [header, payload] = token.split('.').slice(0, 2).map(part =>
    JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
  );
  console.log('[DEBUG] Decoded JWT:', { header, payload });
  return { header, payload };
}
