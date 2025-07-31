import { supabase } from "./supabase"
import type { Startup, StartupStage, User } from "./types"

export async function getStartups(userId?: string): Promise<Startup[]> {
    const { data, error } = await supabase
        .from("startups")
        .select(`
      id,
      name,
      slug,
      description,
      website_url,
      logo_url,
      industry,
      stage,
      founded_date,
      location,
      team_size,
      funding_raised,
      target_market,
      estimated_timeline,
      looking_for,
      launch_date,
      is_public,
      created_at,
      updated_at,
      user_id
    `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching startups:", error)
        throw error
    }

    return data || []
}

export async function getStartupsByStage(stage: StartupStage): Promise<Startup[]> {
    const { data, error } = await supabase
        .from("startups")
        .select("*")
        .eq("is_public", true)
        .eq("stage", stage)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching startups by stage:", error)
        throw error
    }

    return data || []
}

export async function getUserStartups(userId: string): Promise<Startup[]> {
    const { data, error } = await supabase
        .from("startups")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching user startups:", error)
        throw error
    }

    return data || []
}

export async function createStartup(startup: {
    userId?: string  // Made optional since existing table might not require it
    name: string
    description?: string
    website_url?: string
    logo_url?: string
    industry?: string
    stage?: StartupStage
    founded_date?: string
    location?: string
    team_size?: number
    funding_raised?: number
    target_market?: string
    estimated_timeline?: string
    looking_for?: string[]
    is_public?: boolean
}): Promise<Startup> {
    // Generate slug from name
    const slug = startup.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    const insertData: any = {
        name: startup.name,
        slug,
        description: startup.description,
        website_url: startup.website_url,
        logo_url: startup.logo_url,
        industry: startup.industry,
        stage: startup.stage || "idea",
        founded_date: startup.founded_date,
        location: startup.location,
        team_size: startup.team_size,
        funding_raised: startup.funding_raised,
        target_market: startup.target_market,
        estimated_timeline: startup.estimated_timeline,
        looking_for: startup.looking_for,
        is_public: startup.is_public ?? true,
    }

    // Only add user_id if provided
    if (startup.userId) {
        insertData.user_id = startup.userId
    }

    const { data, error } = await supabase
        .from("startups")
        .insert(insertData)
        .select("*")
        .single()

    if (error) {
        console.error("Error creating startup:", error)
        throw error
    }

    return data
}

export async function updateStartup(
    startupId: string,
    updates: Partial<Omit<Startup, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<Startup> {
    const { data, error } = await supabase
        .from("startups")
        .update(updates)
        .eq("id", startupId)
        .select("*")
        .single()

    if (error) {
        console.error("Error updating startup:", error)
        throw error
    }

    return data
}

export async function deleteStartup(startupId: string): Promise<void> {
    const { error } = await supabase
        .from("startups")
        .delete()
        .eq("id", startupId)

    if (error) {
        console.error("Error deleting startup:", error)
        throw error
    }
}

export async function getStartupBySlug(slug: string): Promise<Startup | null> {
    const { data, error } = await supabase
        .from("startups")
        .select("*")
        .eq("slug", slug)
        .eq("is_public", true)
        .single()

    if (error) {
        if (error.code === "PGRST116") {
            return null // Not found
        }
        console.error("Error fetching startup by slug:", error)
        throw error
    }

    return data
}
