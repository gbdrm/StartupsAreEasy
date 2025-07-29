import { supabase } from "./supabase"
import type { Post, Comment, PostType } from "./types"

export async function getPosts(userId?: string) {
  try {
    // First try to use the custom function
    const { data, error } = await supabase.rpc("get_posts_with_details", {
      user_id_param: userId || null,
    })

    if (error) {
      // If the function doesn't exist, fall back to basic query
      if (error.message.includes("function") && error.message.includes("does not exist")) {
        return await getPostsBasic(userId)
      }
      throw error
    }

    return data.map((post: any) => ({
      id: post.id,
      user: {
        id: post.user_id,
        name: `${post.first_name} ${post.last_name || ""}`.trim(),
        username: post.username,
        avatar: post.avatar_url,
      },
      type: post.type,
      content: post.content,
      link: post.link_url,
      image: post.image_url,
      created_at: post.created_at,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      liked_by_user: post.liked_by_user,
    })) as Post[]
  } catch (error) {
    console.error("Error fetching posts:", error)
    // Fall back to basic query if RPC fails
    return await getPostsBasic(userId)
  }
}

// Fallback function for basic posts query
async function getPostsBasic(userId?: string) {
  // First get posts with startup info
  const { data: posts, error } = await supabase
    .from("posts")
    .select(`
      id,
      user_id,
      type,
      content,
      link,
      image,
      created_at,
      startup:startups(id, name, stage)
    `)
    .order("created_at", { ascending: false })

  if (error) throw error

  // Get user profiles separately to avoid the foreign key issue
  const userIds = [...new Set(posts.map(post => post.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_url")
    .in("id", userIds)

  if (profilesError) throw profilesError

  // Create a map for quick profile lookup
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))

  // Get likes and comments counts separately
  const postsWithCounts = await Promise.all(
    posts.map(async (post: any) => {
      const profile = profileMap.get(post.user_id)

      const [likesResult, commentsResult, userLikeResult] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
        supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id),
        userId ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", userId).single() : null,
      ])

      return {
        id: post.id,
        user: {
          id: post.user_id,
          name: profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Unknown User",
          username: profile?.username || "unknown",
          avatar: profile?.avatar_url,
        },
        type: post.type,
        content: post.content,
        link: post.link,
        image: post.image,
        startup: post.startup,
        created_at: post.created_at,
        likes_count: likesResult.count || 0,
        comments_count: commentsResult.count || 0,
        liked_by_user: !!userLikeResult?.data,
      }
    }),
  )

  return postsWithCounts as Post[]
}

export async function createPost(data: {
  userId: string
  type: PostType
  content: string
  link?: string
}) {
  try {
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: data.userId,
        type: data.type,
        content: data.content,
        link: data.link,
      })
      .select()
      .single()

    if (error) throw error
    return post
  } catch (error) {
    console.error("Error creating post:", error)
    throw error
  }
}

export async function toggleLike(postId: string, userId: string) {
  try {
    // Check if like exists
    const { data: existingLike } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single()

    if (existingLike) {
      // Remove like
      const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId)

      if (error) throw error
      return false
    } else {
      // Add like
      const { error } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: userId,
      })

      if (error) throw error
      return true
    }
  } catch (error) {
    console.error("Error toggling like:", error)
    throw error
  }
}

export async function getComments(postId: string) {
  try {
    // First get comments with user_id
    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        user_id
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })

    if (error) throw error

    // Get unique user IDs
    const userIds = [...new Set(comments.map(comment => comment.user_id))]

    // Fetch user profiles separately
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_url")
      .in("id", userIds)

    if (profilesError) throw profilesError

    // Create a map for quick profile lookup
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]))

    return comments.map((comment: any) => {
      const profile = profileMap.get(comment.user_id)
      return {
        id: comment.id,
        post_id: postId,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          id: comment.user_id,
          name: profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Unknown User",
          username: profile?.username || "unknown",
          avatar: profile?.avatar_url,
        },
      }
    }) as Comment[]
  } catch (error) {
    console.error("Error fetching comments:", error)
    throw error
  }
}

export async function createComment(data: {
  postId: string
  userId: string
  content: string
}) {
  try {
    const { data: comment, error } = await supabase
      .from("comments")
      .insert({
        post_id: data.postId,
        user_id: data.userId,
        content: data.content,
      })
      .select()
      .single()

    if (error) throw error
    return comment
  } catch (error) {
    console.error("Error creating comment:", error)
    throw error
  }
}
