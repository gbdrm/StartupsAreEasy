import { supabase } from "./supabase"
import { logger } from "./logger"
import type { Startup, StartupStage, User } from "./types"

export async function getStartups(userId?: string): Promise<Startup[]> {
    logger.info("getStartups: Starting database query...")

    try {
        // Use direct REST API approach to bypass auth client conflicts
        logger.info("getStartups: Using direct REST API approach...")

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

        const url = `${supabaseUrl}/rest/v1/startups?is_public=eq.true&order=created_at.desc&select=id,name,slug,description,website_url,logo_url,industry,stage,founded_date,location,team_size,funding_raised,target_market,estimated_timeline,looking_for,launch_date,is_public,created_at,updated_at,user_id`

        logger.api(url, 'GET')

        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        })

        logger.debug("getStartups: HTTP response status:", response.status)

        if (!response.ok) {
            const errorText = await response.text()
            logger.error("getStartups: HTTP error:", errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const data = await response.json()
        logger.info(`getStartups: Successfully loaded ${data.length} startups`)

        return data || []
    } catch (err) {
        logger.error("getStartups: Exception caught:", err)
        throw err
    }
}

export async function getStartupsByStage(stage: StartupStage): Promise<Startup[]> {
    const { data, error } = await supabase
        .from("startups")
        .select("*")
        .eq("is_public", true)
        .eq("stage", stage)
        .order("created_at", { ascending: false })

    if (error) {
        logger.error("Error fetching startups by stage:", error)
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
        logger.error("Error fetching user startups:", error)
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
    // Use the unified createStartupDirect function from api-direct.ts
    // This ensures consistent error handling and duplicate slug logic
    const { createStartupDirect } = await import("./api-direct")
    const { getCurrentUserToken } = await import("./auth")

    const token = await getCurrentUserToken()
    return createStartupDirect(startup, token || undefined)
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
        logger.error("Error updating startup:", error)
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
        logger.error("Error deleting startup:", error)
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
        logger.error("Error fetching startup by slug:", error)
        throw error
    }

    return data
}
