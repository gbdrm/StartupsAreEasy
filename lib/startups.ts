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
    // Generate base slug from name
    const baseSlug = startup.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    // If baseSlug is empty, use a fallback
    if (!baseSlug) {
        throw new Error("Startup name must contain at least one alphanumeric character")
    }

    // Generate initial slug from name
    let slug = baseSlug

    logger.debug(`Generated initial slug: "${slug}"`)

    // Simple approach: just try to insert, and if it fails due to duplicate slug, add timestamp
    // This is simpler and less likely to hang than checking availability first

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

    logger.debug(`Attempting to create startup with slug: "${slug}"`)

    const { data, error } = await supabase
        .from("startups")
        .insert(insertData)
        .select("*")
        .single()

    if (error) {
        logger.error("Error creating startup:", error)

        // If we get a duplicate slug error, try with timestamp suffix
        if (error.code === '23505' && error.message?.includes('startups_slug_key')) {
            logger.warn("Duplicate slug detected, retrying with timestamp suffix...")

            // Generate a unique slug with timestamp and random suffix
            const uniqueSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            logger.debug(`Retrying with unique slug: "${uniqueSlug}"`)

            const retryData = { ...insertData, slug: uniqueSlug }

            try {
                const { data: retryResult, error: retryError } = await supabase
                    .from("startups")
                    .insert(retryData)
                    .select("*")
                    .single()

                if (retryError) {
                    logger.error("Error creating startup on retry:", retryError)
                    throw retryError
                }

                logger.info("Startup created successfully on retry")
                return retryResult
            } catch (retryErr) {
                logger.error("Retry also failed:", retryErr)
                throw retryErr
            }
        }

        // For other errors, throw them
        throw error
    }

    logger.info("Startup created successfully")
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
