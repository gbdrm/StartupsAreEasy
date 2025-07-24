"use client"

import { useState, useEffect } from "react"
import { PostForm } from "@/components/post-form"
import { PostCard } from "@/components/post-card"
import { AuthButton } from "@/components/auth-button"
import type { Post, Comment, User, PostType } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { getPosts, createPost, toggleLike, getComments, createComment } from "@/lib/posts"
import { signInWithTelegram, signOut, getCurrentUserProfile } from "@/lib/auth"
import Link from "next/link"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load user from Supabase Auth on mount
  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUserProfile()
      setCurrentUser(user)
    }
    fetchUser()
  }, [])

  // Load posts
  useEffect(() => {
    loadPosts()
  }, [currentUser])

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)
      const postsData = await getPosts(currentUser?.id)
      setPosts(postsData)

      // Load comments for all posts in parallel
      const commentsArrays = await Promise.all(
        postsData.map((post) => getComments(post.id)),
      )
      setComments(commentsArrays.flat())
    } catch (err) {
      console.error("Error loading posts:", err)
      setError("Failed to load posts. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (telegramUser: TelegramUser) => {
    try {
      console.log("Login attempt with:", telegramUser)
      setError(null)
      const user = await signInWithTelegram(telegramUser)
      console.log("Login successful, user:", user)
      setCurrentUser(user)
    } catch (err) {
      console.error("Error logging in:", err)
      setError(`Failed to log in: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setCurrentUser(null)
    } catch (err) {
      console.error("Error logging out:", err)
    }
  }

  const handleCreatePost = async (data: {
    type: PostType
    content: string
    link?: string
    image?: string
  }) => {
    if (!currentUser) return

    try {
      await createPost({
        userId: currentUser.id,
        type: data.type,
        content: data.content,
        link: data.link,
        image: data.image,
      })

      // Reload posts to show the new one
      await loadPosts()
    } catch (err) {
      console.error("Error creating post:", err)
      setError("Failed to create post. Please try again.")
    }
  }

  const handleLike = async (postId: string) => {
    if (!currentUser) return

    try {
      const isLiked = await toggleLike(postId, currentUser.id)

      // Update local state optimistically
      setPosts(
        posts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              liked_by_user: isLiked,
              likes_count: isLiked ? post.likes_count + 1 : post.likes_count - 1,
            }
          }
          return post
        }),
      )
    } catch (err) {
      console.error("Error toggling like:", err)
      setError("Failed to update like. Please try again.")
    }
  }

  const handleComment = async (postId: string, content: string) => {
    if (!currentUser) return

    try {
      await createComment({
        postId,
        userId: currentUser.id,
        content,
      })

      // Reload comments for this post
      const newComments = await getComments(postId)
      setComments((prev) => [...prev.filter((c) => c.post_id !== postId), ...newComments])

      // Update post comment count
      setPosts(
        posts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              comments_count: newComments.length,
            }
          }
          return post
        }),
      )
    } catch (err) {
      console.error("Error creating comment:", err)
      setError("Failed to create comment. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 ml-4">
            <h1 className="text-xl font-bold">Startups Are Easy</h1>
            <span className="text-2xl">🚀</span>
            <Link href="/startups" className="text-blue-600 hover:underline text-sm">Startups</Link>
          </div>
          <AuthButton user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <PostForm user={currentUser} onSubmit={handleCreatePost} />

          <Separator />

          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={currentUser}
                comments={comments.filter((comment) => comment.post_id === post.id)}
                onLike={handleLike}
                onComment={handleComment}
              />
            ))}
          </div>

          {posts.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
