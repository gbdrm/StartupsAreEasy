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

        // Use the get_posts_with_details function to get all posts with like counts
        const url = `${supabaseUrl}/rest/v1/rpc/get_posts_with_details`
        const requestBody = {
            user_id_param: userId || null
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[${new Date().toISOString()}] getPostsDirect: Error ${response.status}:`, errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const posts = await response.json()
        console.log(`[${new Date().toISOString()}] getPostsDirect: Loaded ${posts.length} posts`)

        // Transform the response to match our Post type
        return posts.map((post: any) => ({
            id: post.id,
            user: {
                id: post.user_id,
                name: post.first_name && post.last_name ? `${post.first_name} ${post.last_name}`.trim() : post.username || 'User',
                username: post.username || 'user',
                avatar: post.avatar_url || '',
            },
            type: post.type,
            content: post.content,
            link: post.link_url,
            image: post.image_url,
            created_at: post.created_at,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            liked_by_user: post.liked_by_user || false,
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
            founded_date: startup.founded_date && startup.founded_date.trim() !== '' ? startup.founded_date : null,
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
        const requestHeaders = {
            ...getAuthHeaders(token),
            'Prefer': 'return=representation'  // Tell Supabase to return the created data
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
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
                    headers: requestHeaders,
                    body: JSON.stringify(retryData)
                })

                if (!retryResponse.ok) {
                    throw new Error(`HTTP ${retryResponse.status}: ${await retryResponse.text()}`)
                }

                // Handle empty response for retry
                const retryResponseText = await retryResponse.text()
                if (!retryResponseText || retryResponseText.trim() === '') {
                    console.log(`[${new Date().toISOString()}] createStartupDirect: Empty response but 201 status - startup created with unique slug`)
                    return {
                        ...insertData,
                        id: `temp-${Date.now()}`,
                        slug: uniqueSlug,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as Startup
                }

                const result = JSON.parse(retryResponseText)
                console.log(`[${new Date().toISOString()}] createStartupDirect: Startup created with unique slug`)
                return result[0] || result
            }

            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // Handle empty response for main request
        const responseText = await response.text()
        if (!responseText || responseText.trim() === '') {
            console.log(`[${new Date().toISOString()}] createStartupDirect: Empty response but 201 status - startup created successfully`)
            return {
                ...insertData,
                id: `temp-${Date.now()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Startup
        }

        const result = JSON.parse(responseText)
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
        console.log(`[${new Date().toISOString()}] createPostDirect: Creating post with data:`, data)
        console.log(`[${new Date().toISOString()}] createPostDirect: Using token:`, token ? 'YES (length: ' + token.length + ')' : 'NO')

        const url = `${supabaseUrl}/rest/v1/posts`
        const requestHeaders = {
            ...getAuthHeaders(token),
            'Prefer': 'return=representation'  // Tell Supabase to return the created data
        }
        console.log(`[${new Date().toISOString()}] createPostDirect: Request headers:`, requestHeaders)

        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(data)
        })

        console.log(`[${new Date().toISOString()}] createPostDirect: Response status:`, response.status)
        console.log(`[${new Date().toISOString()}] createPostDirect: Response headers:`, Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[${new Date().toISOString()}] createPostDirect: Error response:`, errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // Check if response has content before parsing JSON
        const responseText = await response.text()
        console.log(`[${new Date().toISOString()}] createPostDirect: Raw response:`, responseText)
        console.log(`[${new Date().toISOString()}] createPostDirect: Response length:`, responseText.length)

        if (!responseText || responseText.trim() === '') {
            console.log(`[${new Date().toISOString()}] createPostDirect: Empty response but 201 status - post was created successfully`)
            // Post was created successfully but no data returned
            // Return a minimal post object with the data we sent
            return {
                id: `temp-${Date.now()}`, // Temporary ID since we don't have the real one
                user: {
                    id: data.user_id,
                    name: "User",
                    username: "user",
                    avatar: "",
                },
                type: data.type,
                content: data.content,
                link: data.link,
                image: data.image,
                created_at: new Date().toISOString(),
                likes_count: 0,
                comments_count: 0,
                liked_by_user: false,
            } as Post
        }

        let result
        try {
            result = JSON.parse(responseText)
        } catch (parseError) {
            console.error(`[${new Date().toISOString()}] createPostDirect: JSON parse error:`, parseError)
            console.error(`[${new Date().toISOString()}] createPostDirect: Response was:`, responseText)
            throw new Error(`Invalid JSON response: ${responseText}`)
        }

        console.log(`[${new Date().toISOString()}] createPostDirect: Post created successfully`, result)

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
        console.log(`[${new Date().toISOString()}] createCommentDirect: Using token:`, token ? 'YES (length: ' + token.length + ')' : 'NO')

        const url = `${supabaseUrl}/rest/v1/comments`
        const requestHeaders = {
            ...getAuthHeaders(token),
            'Prefer': 'return=representation'  // Tell Supabase to return the created data
        }
        console.log(`[${new Date().toISOString()}] createCommentDirect: Request headers:`, requestHeaders)

        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(data)
        })

        console.log(`[${new Date().toISOString()}] createCommentDirect: Response status:`, response.status)
        console.log(`[${new Date().toISOString()}] createCommentDirect: Response headers:`, Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[${new Date().toISOString()}] createCommentDirect: Error response:`, errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // Check if response has content before parsing JSON
        const responseText = await response.text()
        console.log(`[${new Date().toISOString()}] createCommentDirect: Raw response:`, responseText)
        console.log(`[${new Date().toISOString()}] createCommentDirect: Response length:`, responseText.length)

        if (!responseText || responseText.trim() === '') {
            console.log(`[${new Date().toISOString()}] createCommentDirect: Empty response but 201 status - comment was created successfully`)
            // Comment was created successfully but no data returned
            // Return a minimal comment object with the data we sent
            return {
                id: `temp-${Date.now()}`, // Temporary ID since we don't have the real one
                post_id: data.post_id,
                user: {
                    id: data.user_id,
                    name: "User",
                    username: "user",
                    avatar: "",
                },
                content: data.content,
                created_at: new Date().toISOString(),
            } as Comment
        }

        let result
        try {
            result = JSON.parse(responseText)
        } catch (parseError) {
            console.error(`[${new Date().toISOString()}] createCommentDirect: JSON parse error:`, parseError)
            console.error(`[${new Date().toISOString()}] createCommentDirect: Response was:`, responseText)
            throw new Error(`Invalid JSON response: ${responseText}`)
        }

        console.log(`[${new Date().toISOString()}] createCommentDirect: Comment created successfully`, result)

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

// Like/Unlike API
export async function toggleLikeDirect(postId: string, userId: string, token?: string): Promise<{ liked: boolean, likesCount: number }> {
    console.log('🎯 toggleLikeDirect called:', { postId, userId, hasToken: !!token })

    try {
        // First check if user already liked this post
        console.log('🔍 Checking if user already liked this post...')
        const checkUrl = `${supabaseUrl}/rest/v1/likes?user_id=eq.${userId}&post_id=eq.${postId}`
        const checkResponse = await fetch(checkUrl, { headers: getAuthHeaders(token) })

        if (!checkResponse.ok) {
            console.error('❌ Error checking existing likes:', checkResponse.status, await checkResponse.text())
            throw new Error(`HTTP ${checkResponse.status}: ${await checkResponse.text()}`)
        }

        const existingLikes = await checkResponse.json()
        const isLiked = existingLikes.length > 0
        console.log('🔍 Current like status:', isLiked ? 'LIKED' : 'NOT LIKED', 'existing likes:', existingLikes.length)

        if (isLiked) {
            // Unlike: delete the like
            console.log('👎 Removing like...')
            const deleteUrl = `${supabaseUrl}/rest/v1/likes?user_id=eq.${userId}&post_id=eq.${postId}`
            const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: getAuthHeaders(token)
            })

            if (!deleteResponse.ok) {
                console.error('❌ Error deleting like:', deleteResponse.status, await deleteResponse.text())
                throw new Error(`HTTP ${deleteResponse.status}: ${await deleteResponse.text()}`)
            }
            console.log('✅ Like removed successfully')
        } else {
            // Like: create a new like
            console.log('👍 Adding like...')
            console.log('🔍 Debug - userId:', userId, 'postId:', postId)
            console.log('🔍 Debug - token present:', !!token)
            console.log('🔍 Debug - token length:', token?.length || 0)

            const createUrl = `${supabaseUrl}/rest/v1/likes`
            const likeHeaders = getAuthHeaders(token)
            console.log('🔍 Debug - request headers:', likeHeaders)

            const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: likeHeaders,
                body: JSON.stringify({
                    user_id: userId,
                    post_id: postId
                })
            })

            console.log('🔍 Debug - response status:', createResponse.status)
            console.log('🔍 Debug - response headers:', Object.fromEntries(createResponse.headers.entries()))

            if (!createResponse.ok) {
                const errorText = await createResponse.text()
                console.error('❌ Error creating like:', createResponse.status, errorText)
                console.error('❌ Full error details:', {
                    status: createResponse.status,
                    statusText: createResponse.statusText,
                    headers: Object.fromEntries(createResponse.headers.entries()),
                    body: errorText
                })
                throw new Error(`HTTP ${createResponse.status}: ${errorText}`)
            }
            console.log('✅ Like added successfully')
        }

        // Get updated likes count
        console.log('📊 Getting updated like count...')
        const countUrl = `${supabaseUrl}/rest/v1/likes?post_id=eq.${postId}&select=id`
        const countResponse = await fetch(countUrl, { headers: getAuthHeaders(token) })

        if (!countResponse.ok) {
            console.error('❌ Error getting like count:', countResponse.status, await countResponse.text())
            throw new Error(`HTTP ${countResponse.status}: ${await countResponse.text()}`)
        }

        const likes = await countResponse.json()
        const likesCount = likes.length
        console.log('📊 Final like count:', likesCount)

        const result = {
            liked: !isLiked,
            likesCount
        }
        console.log('✅ toggleLikeDirect returning:', result)
        return result
    } catch (error) {
        console.error("💥 Error toggling like:", error)
        throw error
    }
}
