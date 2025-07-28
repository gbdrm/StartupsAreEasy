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
  // Local dev override
  if (HAS_FAKE_LOGIN) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_url")
      .eq("id", process.env.NEXT_PUBLIC_DEFAULT_USER_ID)
      .single();
    if (error || !profile) throw new Error("Could not find default profile for local dev");

    // Store fake session data in localStorage for persistence
    const fakeUserData = {
      id: profile.id,
      name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      username: profile.username ?? "",
      avatar: profile.avatar_url ?? "",
      first_name: profile.first_name,
      last_name: profile.last_name,
    };
    localStorage.setItem("fake-user-session", JSON.stringify(fakeUserData));


    return fakeUserData;
  }

  // Call backend to get JWT
  const res = await fetch("https://jymlmpzzjlepgqbimzdf.functions.supabase.co/tg-login", {
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
  // Check for fake session first (local dev)
  if (process.env.NEXT_PUBLIC_DEFAULT_USER_ID) {
    const fakeSession = localStorage.getItem("fake-user-session");
    if (fakeSession) {
      try {
        const userData = JSON.parse(fakeSession);
        return userData;
      } catch (error) {
        console.error("Error parsing fake session:", error);
        localStorage.removeItem("fake-user-session");
      }
    }
    return null;
  }

  // Production auth flow
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
    name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    username: profile.username ?? "",
    avatar: profile.avatar_url ?? "",
    first_name: profile.first_name,
    last_name: profile.last_name,
  };
}

export async function signOut() {
  // Clear fake session for local dev
  if (process.env.NEXT_PUBLIC_DEFAULT_USER_ID) {
    localStorage.removeItem("fake-user-session");
    return;
  }

  // Production logout
  localStorage.removeItem("sb-access-token");
  await supabase.auth.signOut();
}
