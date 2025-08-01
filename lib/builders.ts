import { supabase } from "./supabase"
import type { User } from "./types"

export async function getBuilders() {
    try {
        const { data: profiles, error } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, username, avatar_url")
            .neq("username", "admin")  // Exclude admin profile
            .order("created_at", { ascending: false })

        if (error) throw error

        return profiles.map(profile => ({
            id: profile.id,
            name: `${profile.first_name} ${profile.last_name || ""}`.trim(),
            username: profile.username,
            avatar: profile.avatar_url,
        })) as User[]
    } catch (error) {
        console.error("Error fetching builders:", error)
        throw error
    }
}

export async function getBuilderStats(userId: string) {
    try {
        // Get posts count
        const { count: postsCount } = await supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)

        // Get startups count
        const { count: startupsCount } = await supabase
            .from("startups")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)

        return {
            postsCount: postsCount || 0,
            startupsCount: startupsCount || 0,
        }
    } catch (error) {
        console.error("Error fetching builder stats:", error)
        return { postsCount: 0, startupsCount: 0 }
    }
}
