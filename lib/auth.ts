import { createClient } from "@supabase/supabase-js"
import type { User } from "./types"
import { supabase } from "./supabase"

const supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export async function signInWithTelegram(telegramUser: TelegramUser): Promise<User> {
  // Local development override: sign in as NEXT_PUBLIC_DEFAULT_USER_ID if set
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

  // Use Supabase Edge Function to get JWT and set session
  const res = await fetch("https://jymlmpzzjlepgqbimzdf.functions.supabase.co/telegram-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telegramUser),
  })
  if (!res.ok) throw new Error("Telegram login failed")
  const { access_token, refresh_token = "" } = await res.json()
  if (!access_token) throw new Error("No access_token returned from edge function")

  // Set Supabase Auth session
  await supabase.auth.setSession({ access_token, refresh_token })

  // Get the current authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("No authenticated user found after setting session.")

  // Upsert profile info for this user
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
    .single()
  if (profileError) throw profileError

  return {
    id: user.id,
    name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
    username: profile.username ?? "",
    avatar: profile.avatar_url ?? "",
    first_name: profile.first_name,
    last_name: profile.last_name,
  }
}

export async function getCurrentUserProfile() {
  // Get the authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return null

  // Load profile data from profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()
  if (profileError || !profile) return null

  return {
    id: user.id,
    email: user.email,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
  }
}

export async function signOut() {
  await supabase.auth.signOut()
}
