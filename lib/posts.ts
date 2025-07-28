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
  const { data: posts, error } = await supabase
    .from("posts")
    .select(`
      id,
      type,
      content,
      link_url,
      image_url,
      created_at,
      user:profiles(
        id,
        username,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false })

  if (error) throw error

  // Get likes and comments counts separately
  const postsWithCounts = await Promise.all(
    posts.map(async (post: any) => {
      const [likesResult, commentsResult, userLikeResult] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
        supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id),
        userId ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", userId).single() : null,
      ])

      return {
        id: post.id,
        user: {
          id: post.user.id,
          name: `${post.user.first_name} ${post.user.last_name || ""}`.trim(),
          username: post.user.username,
          avatar: post.user.avatar_url,
        },
        type: post.type,
        content: post.content,
        link: post.link_url,
        image: post.image_url,
        created_at: post.created_at,
        likes_count: likesResult.count || 0,
        comments_count: commentsResult.count || 0,
        liked_by_user: !!userLikeResult.data,
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
  image?: string
}) {
  try {
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: data.userId,
        type: data.type,
        content: data.content,
        link_url: data.link,
        image_url: data.image,
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
    const { data, error } = await supabase
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        user:profiles(
          id,
          username,
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return data.map((comment: any) => ({
      id: comment.id,
      post_id: postId,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.user.id,
        name: `${comment.user.first_name} ${comment.user.last_name || ""}`.trim(),
        username: comment.user.username,
        avatar: comment.user.avatar_url,
      },
    })) as Comment[]
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
