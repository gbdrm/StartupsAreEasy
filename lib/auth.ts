import { createClient } from "@supabase/supabase-js"
import type { User } from "./types"
import { supabase } from "./supabase"

// Create a service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

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
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", process.env.NEXT_PUBLIC_DEFAULT_USER_ID)
      .single();
    if (error || !data) throw new Error("Could not find default user for local dev");
    return {
      id: data.id,
      name: `${data.first_name} ${data.last_name || ""}`.trim(),
      username: data.username,
      avatar: data.avatar_url || "",
      telegram_id: data.telegram_id,
      first_name: data.first_name,
      last_name: data.last_name,
    };
  }

  try {
    console.log("Attempting to sign in with Telegram user:", telegramUser)

    // Use the admin client to bypass RLS for user creation/updates
    const { data: existingUser, error: selectError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("telegram_id", telegramUser.id)
      .single()

    console.log("Existing user query result:", { existingUser, selectError })

    if (existingUser) {
      // Update existing user with latest info
      const { data, error } = await supabaseAdmin
        .from("users")
        .update({
          username: telegramUser.username || `user_${telegramUser.id}`,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          avatar_url: telegramUser.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("telegram_id", telegramUser.id)
        .select()
        .single()

      console.log("Update user result:", { data, error })

      if (error) throw error

      return {
        id: data.id,
        name: `${data.first_name} ${data.last_name || ""}`.trim(),
        username: data.username,
        avatar: data.avatar_url || "",
        telegram_id: data.telegram_id,
        first_name: data.first_name,
        last_name: data.last_name,
      }
    } else {
      // Create new user using admin client
      console.log("Creating new user...")
      const { data, error } = await supabaseAdmin
        .from("users")
        .insert({
          telegram_id: telegramUser.id,
          username: telegramUser.username || `user_${telegramUser.id}`,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          avatar_url: telegramUser.photo_url,
        })
        .select()
        .single()

      console.log("Create user result:", { data, error })

      if (error) throw error

      return {
        id: data.id,
        name: `${data.first_name} ${data.last_name || ""}`.trim(),
        username: data.username,
        avatar: data.avatar_url || "",
        telegram_id: data.telegram_id,
        first_name: data.first_name,
        last_name: data.last_name,
      }
    }
  } catch (error) {
    console.error("Error signing in with Telegram:", error)
    throw error
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
