// Direct REST API functions to avoid Supabase client conflicts
// These functions use fetch() directly instead of the Supabase JS client

import type { Post, Comment, User, Startup, StartupStage } from "./types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
}

// Get auth headers with user token
function getAuthHeaders(token?: string) {
    return {
        ...headers,
        ...(token && { 'Authorization': `Bearer ${token}` })
    }
}

// Posts API
export async function getPostsDirect(userId?: string): Promise<Post[]> {
    try {
        console.log(`[${new Date().toISOString()}] getPostsDirect: Starting...`)

        // Join posts with profiles to get user information
        const url = `${supabaseUrl}/rest/v1/posts?order=created_at.desc&select=id,user_id,type,content,link,image,created_at,startup_id,profiles!user_id(id,first_name,last_name,username,avatar_url)`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const posts = await response.json()
        console.log(`[${new Date().toISOString()}] getPostsDirect: Loaded ${posts.length} posts`)

        // Return posts with proper user information
        return posts.map((post: any) => ({
            id: post.id,
            user: {
                id: post.user_id,
                name: post.profiles ? `${post.profiles.first_name || ''} ${post.profiles.last_name || ''}`.trim() || 'User' : 'User',
                username: post.profiles?.username || 'user',
                avatar: post.profiles?.avatar_url || '',
            },
            type: post.type,
            content: post.content,
            link: post.link,
            image: post.image,
            created_at: post.created_at,
            likes_count: 0, // Simplified for now
            comments_count: 0,
            liked_by_user: false,
        })) as Post[]
    } catch (error) {
        console.error("Error fetching posts:", error)
        throw error
    }
}

// Builders API
export async function getBuildersDirect(): Promise<User[]> {
    try {
        console.log(`[${new Date().toISOString()}] getBuildersDirect: Starting...`)

        const url = `${supabaseUrl}/rest/v1/profiles?username=neq.admin&order=created_at.desc&select=id,first_name,last_name,username,avatar_url`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const profiles = await response.json()
        console.log(`[${new Date().toISOString()}] getBuildersDirect: Loaded ${profiles.length} builders`)

        return profiles.map((profile: any) => ({
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

// Startups API  
export async function getStartupsDirect(): Promise<Startup[]> {
    try {
        console.log(`[${new Date().toISOString()}] getStartupsDirect: Starting...`)

        const url = `${supabaseUrl}/rest/v1/startups?is_public=eq.true&order=created_at.desc&select=id,name,slug,description,website_url,logo_url,industry,stage,founded_date,location,team_size,funding_raised,target_market,estimated_timeline,looking_for,launch_date,is_public,created_at,updated_at,user_id`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const data = await response.json()
        console.log(`[${new Date().toISOString()}] getStartupsDirect: Loaded ${data.length} startups`)

        return data || []
    } catch (error) {
        console.error("Error fetching startups:", error)
        throw error
    }
}

// Create Startup API
export async function createStartupDirect(startup: {
    userId?: string
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
}, token?: string): Promise<Startup> {
    try {
        console.log(`[${new Date().toISOString()}] createStartupDirect: Creating startup...`)

        // Generate base slug from name
        const baseSlug = startup.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')

        if (!baseSlug) {
            throw new Error("Startup name must contain at least one alphanumeric character")
        }

        const insertData: any = {
            name: startup.name,
            slug: baseSlug,
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

        if (startup.userId) {
            insertData.user_id = startup.userId
        }

        const url = `${supabaseUrl}/rest/v1/startups`
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(insertData)
        })

        if (!response.ok) {
            const errorText = await response.text()
            // If duplicate slug error, try with timestamp suffix
            if (response.status === 409 || errorText.includes('startups_slug_key')) {
                console.warn("Duplicate slug detected, retrying with timestamp suffix...")
                const uniqueSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`

                const retryData = { ...insertData, slug: uniqueSlug }
                const retryResponse = await fetch(url, {
                    method: 'POST',
                    headers: getAuthHeaders(token),
                    body: JSON.stringify(retryData)
                })

                if (!retryResponse.ok) {
                    throw new Error(`HTTP ${retryResponse.status}: ${await retryResponse.text()}`)
                }

                const result = await retryResponse.json()
                console.log(`[${new Date().toISOString()}] createStartupDirect: Startup created with unique slug`)
                return result[0] || result
            }

            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const result = await response.json()
        console.log(`[${new Date().toISOString()}] createStartupDirect: Startup created successfully`)
        return result[0] || result
    } catch (error) {
        console.error("Error creating startup:", error)
        throw error
    }
}

// Create Post API (simplified)
export async function createPostDirect(data: {
    user_id: string
    type: string
    content: string
    link?: string
    image?: string
    startup_id?: string
}, token?: string): Promise<Post> {
    try {
        console.log(`[${new Date().toISOString()}] createPostDirect: Creating post...`)

        const url = `${supabaseUrl}/rest/v1/posts`
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const result = await response.json()
        console.log(`[${new Date().toISOString()}] createPostDirect: Post created successfully`)

        // Return simplified post structure
        const post = result[0] || result
        return {
            id: post.id,
            user: {
                id: post.user_id,
                name: "User",
                username: "user",
                avatar: "",
            },
            type: post.type,
            content: post.content,
            link: post.link,
            image: post.image,
            created_at: post.created_at,
            likes_count: 0,
            comments_count: 0,
            liked_by_user: false,
        } as Post
    } catch (error) {
        console.error("Error creating post:", error)
        throw error
    }
}

// Simplified post creation from form data
export async function createPostFromFormDirect(formData: {
    type: string
    content?: string
    link?: string
    startup_name?: string
    startup_description?: string
    existing_startup_id?: string
}, userId: string, token?: string): Promise<void> {
    try {
        console.log(`[${new Date().toISOString()}] createPostFromFormDirect: Creating post...`)

        // For simplified version, just create a basic post
        const postData = {
            user_id: userId,
            type: formData.type,
            content: formData.content || "",
            link: formData.link,
            startup_id: formData.existing_startup_id
        }

        await createPostDirect(postData, token)
        console.log(`[${new Date().toISOString()}] createPostFromFormDirect: Post created successfully`)
    } catch (error) {
        console.error("Error creating post from form:", error)
        throw error
    }
}

// Comments API (simplified)
export async function getCommentsDirect(postId: string): Promise<Comment[]> {
    try {
        console.log(`[${new Date().toISOString()}] getCommentsDirect: Starting for post ${postId}...`)

        // Join comments with profiles to get user information
        const url = `${supabaseUrl}/rest/v1/comments?post_id=eq.${postId}&order=created_at.asc&select=id,post_id,user_id,content,created_at,profiles!user_id(id,first_name,last_name,username,avatar_url)`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const comments = await response.json()
        console.log(`[${new Date().toISOString()}] getCommentsDirect: Loaded ${comments.length} comments`)

        // Return comments with proper user information
        return comments.map((comment: any) => ({
            id: comment.id,
            post_id: comment.post_id,
            user: {
                id: comment.user_id,
                name: comment.profiles ? `${comment.profiles.first_name || ''} ${comment.profiles.last_name || ''}`.trim() || 'User' : 'User',
                username: comment.profiles?.username || 'user',
                avatar: comment.profiles?.avatar_url || '',
            },
            content: comment.content,
            created_at: comment.created_at,
        })) as Comment[]
    } catch (error) {
        console.error("Error fetching comments:", error)
        throw error
    }
}

// Bulk comments API - fetch comments for multiple posts at once
export async function getBulkCommentsDirect(postIds: string[]): Promise<Comment[]> {
    if (postIds.length === 0) return []

    try {
        console.log(`[${new Date().toISOString()}] getBulkCommentsDirect: Loading comments for ${postIds.length} posts...`)

        // Use the 'in' operator to fetch comments for multiple posts in one query
        const postIdsParam = postIds.join(',')
        const url = `${supabaseUrl}/rest/v1/comments?post_id=in.(${postIdsParam})&order=created_at.asc&select=id,post_id,user_id,content,created_at,profiles!user_id(id,first_name,last_name,username,avatar_url)`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const comments = await response.json()
        console.log(`[${new Date().toISOString()}] getBulkCommentsDirect: Loaded ${comments.length} total comments`)

        // Return comments with proper user information
        return comments.map((comment: any) => ({
            id: comment.id,
            post_id: comment.post_id,
            user: {
                id: comment.user_id,
                name: comment.profiles ? `${comment.profiles.first_name || ''} ${comment.profiles.last_name || ''}`.trim() || 'User' : 'User',
                username: comment.profiles?.username || 'user',
                avatar: comment.profiles?.avatar_url || '',
            },
            content: comment.content,
            created_at: comment.created_at,
        })) as Comment[]
    } catch (error) {
        console.error("Error fetching comments:", error)
        throw error
    }
}

// Builder stats
export async function getBuilderStatsDirect(userId: string): Promise<{ postsCount: number; startupsCount: number }> {
    try {
        console.log(`[${new Date().toISOString()}] getBuilderStatsDirect: Starting for user ${userId}...`)

        // Get posts count
        const postsUrl = `${supabaseUrl}/rest/v1/posts?user_id=eq.${userId}&select=id`
        const postsResponse = await fetch(postsUrl, {
            headers: { ...headers, 'Prefer': 'count=exact' }
        })

        // Get startups count  
        const startupsUrl = `${supabaseUrl}/rest/v1/startups?user_id=eq.${userId}&select=id`
        const startupsResponse = await fetch(startupsUrl, {
            headers: { ...headers, 'Prefer': 'count=exact' }
        })

        const postsCount = postsResponse.ok ? parseInt(postsResponse.headers.get('content-range')?.split('/')[1] || '0') : 0
        const startupsCount = startupsResponse.ok ? parseInt(startupsResponse.headers.get('content-range')?.split('/')[1] || '0') : 0

        console.log(`[${new Date().toISOString()}] getBuilderStatsDirect: Posts: ${postsCount}, Startups: ${startupsCount}`)

        return { postsCount, startupsCount }
    } catch (error) {
        console.error("Error fetching builder stats:", error)
        return { postsCount: 0, startupsCount: 0 }
    }
}

// Get posts by type
export async function getPostsByTypeDirect(type: string): Promise<Post[]> {
    try {
        console.log(`[${new Date().toISOString()}] getPostsByTypeDirect: Starting for type ${type}...`)

        const url = `${supabaseUrl}/rest/v1/posts?type=eq.${type}&order=created_at.desc&select=id,user_id,type,content,link,image,created_at,startup_id`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const posts = await response.json()
        console.log(`[${new Date().toISOString()}] getPostsByTypeDirect: Loaded ${posts.length} posts of type ${type}`)

        // Return simplified posts structure
        return posts.map((post: any) => ({
            id: post.id,
            user: {
                id: post.user_id,
                name: "User", // Simplified for now
                username: "user",
                avatar: "",
            },
            type: post.type,
            content: post.content,
            link: post.link,
            image: post.image,
            created_at: post.created_at,
            likes_count: 0, // Simplified for now
            comments_count: 0,
            liked_by_user: false,
        })) as Post[]
    } catch (error) {
        console.error("Error fetching posts by type:", error)
        throw error
    }
}

// Get single post by ID
export async function getPostByIdDirect(id: string): Promise<Post | null> {
    try {
        console.log(`[${new Date().toISOString()}] getPostByIdDirect: Starting for ID ${id}...`)

        const url = `${supabaseUrl}/rest/v1/posts?id=eq.${id}&select=id,user_id,type,content,link,image,created_at,startup_id`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const posts = await response.json()
        console.log(`[${new Date().toISOString()}] getPostByIdDirect: Found ${posts.length} posts`)

        if (posts.length === 0) return null

        const post = posts[0]
        return {
            id: post.id,
            user: {
                id: post.user_id,
                name: "User",
                username: "user",
                avatar: "",
            },
            type: post.type,
            content: post.content,
            link: post.link,
            image: post.image,
            created_at: post.created_at,
            likes_count: 0,
            comments_count: 0,
            liked_by_user: false,
        } as Post
    } catch (error) {
        console.error("Error fetching post by ID:", error)
        throw error
    }
}

// Get single startup by slug
export async function getStartupBySlugDirect(slug: string): Promise<Startup | null> {
    try {
        console.log(`[${new Date().toISOString()}] getStartupBySlugDirect: Starting for slug ${slug}...`)

        const url = `${supabaseUrl}/rest/v1/startups?slug=eq.${slug}&select=id,name,slug,description,website_url,logo_url,industry,stage,founded_date,location,team_size,funding_raised,target_market,estimated_timeline,looking_for,launch_date,is_public,created_at,updated_at,user_id`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const startups = await response.json()
        console.log(`[${new Date().toISOString()}] getStartupBySlugDirect: Found ${startups.length} startups`)

        return startups.length > 0 ? startups[0] : null
    } catch (error) {
        console.error("Error fetching startup by slug:", error)
        throw error
    }
}

// Create Comment API
export async function createCommentDirect(data: {
    post_id: string
    user_id: string
    content: string
}, token?: string): Promise<Comment> {
    try {
        console.log(`[${new Date().toISOString()}] createCommentDirect: Creating comment...`)

        const url = `${supabaseUrl}/rest/v1/comments`
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const result = await response.json()
        console.log(`[${new Date().toISOString()}] createCommentDirect: Comment created successfully`)

        const comment = result[0] || result
        return {
            id: comment.id,
            post_id: comment.post_id,
            user: {
                id: comment.user_id,
                name: "User",
                username: "user",
                avatar: "",
            },
            content: comment.content,
            created_at: comment.created_at,
        } as Comment
    } catch (error) {
        console.error("Error creating comment:", error)
        throw error
    }
}

// Get user profile by username
export async function getUserProfileDirect(username: string): Promise<User | null> {
    try {
        console.log(`[${new Date().toISOString()}] getUserProfileDirect: Starting for username ${username}...`)

        const url = `${supabaseUrl}/rest/v1/profiles?username=eq.${username}&select=id,first_name,last_name,username,avatar_url,bio,location,website,created_at`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const profiles = await response.json()
        console.log(`[${new Date().toISOString()}] getUserProfileDirect: Found ${profiles.length} profiles`)

        if (profiles.length === 0) return null

        const profile = profiles[0]
        return {
            id: profile.id,
            name: `${profile.first_name} ${profile.last_name || ""}`.trim(),
            username: profile.username,
            avatar: profile.avatar_url || "",
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
            joined_at: profile.created_at,
        } as User
    } catch (error) {
        console.error("Error fetching user profile:", error)
        throw error
    }
}

// Get posts by user ID
export async function getPostsByUserDirect(userId: string): Promise<Post[]> {
    try {
        console.log(`[${new Date().toISOString()}] getPostsByUserDirect: Starting for user ${userId}...`)

        // Join with profiles to get user information
        const url = `${supabaseUrl}/rest/v1/posts?user_id=eq.${userId}&order=created_at.desc&select=id,user_id,type,content,link,image,created_at,startup_id,profiles!user_id(id,first_name,last_name,username,avatar_url)`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const posts = await response.json()
        console.log(`[${new Date().toISOString()}] getPostsByUserDirect: Loaded ${posts.length} posts`)

        return posts.map((post: any) => ({
            id: post.id,
            user: {
                id: post.user_id,
                name: post.profiles ? `${post.profiles.first_name || ''} ${post.profiles.last_name || ''}`.trim() || 'User' : 'User',
                username: post.profiles?.username || 'user',
                avatar: post.profiles?.avatar_url || '',
            },
            type: post.type,
            content: post.content,
            link: post.link,
            image: post.image,
            created_at: post.created_at,
            likes_count: 0,
            comments_count: 0,
            liked_by_user: false,
        })) as Post[]
    } catch (error) {
        console.error("Error fetching posts by user:", error)
        throw error
    }
}

// Get startups by user ID
export async function getStartupsByUserDirect(userId: string): Promise<Startup[]> {
    try {
        console.log(`[${new Date().toISOString()}] getStartupsByUserDirect: Starting for user ${userId}...`)

        const url = `${supabaseUrl}/rest/v1/startups?user_id=eq.${userId}&order=created_at.desc&select=id,name,slug,description,website_url,logo_url,industry,stage,founded_date,location,team_size,funding_raised,target_market,estimated_timeline,looking_for,launch_date,is_public,created_at,updated_at,user_id`

        const response = await fetch(url, { headers })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const data = await response.json()
        console.log(`[${new Date().toISOString()}] getStartupsByUserDirect: Loaded ${data.length} startups`)

        return data || []
    } catch (error) {
        console.error("Error fetching startups by user:", error)
        throw error
    }
}
