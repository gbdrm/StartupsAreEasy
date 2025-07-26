import { createClient } from "@supabase/supabase-js";
import type { User } from "./types";
import { supabase } from "./supabase"; // base client created once

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

  const res = await fetch("https://jymlmpzzjlepgqbimzdf.functions.supabase.co/tg-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telegramUser),
  });

  if (!res.ok) throw new Error("Telegram login failed");
  const { access_token } = await res.json();
  if (!access_token) throw new Error("No access_token returned from edge function");

  // Set Supabase Auth session (refresh_token is empty string)
  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token: '' });
  if (sessionError) throw new Error(`Failed to set session: ${sessionError.message}`);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error("No authenticated user found after setting session");
  const user = userData.user;

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
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_url")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile) return null;

  return {
    id: userData.user.id,
    email: userData.user.email,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}
