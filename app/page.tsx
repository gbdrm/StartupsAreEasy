"use client"

import { useState, useEffect } from "react"
import { EnhancedPostForm } from "@/components/enhanced-post-form"
import { PostCard } from "@/components/post-card"
import { Header } from "@/components/header"
import type { Post, Comment, PostType, PostFormData, Startup } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { getPosts, toggleLike, getComments, createComment } from "@/lib/posts"
import { createEnhancedPost, getUserStartupsForPosts } from "@/lib/enhanced-posts"
import { useAuth } from "@/hooks/use-auth"

export default function HomePage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [userStartups, setUserStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)

  // Load posts and user startups
  useEffect(() => {
    loadPosts()
    if (currentUser) {
      loadUserStartups()
    }
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

  const loadUserStartups = async () => {
    if (!currentUser) return
    try {
      const startups = await getUserStartupsForPosts(currentUser.id)
      setUserStartups(startups)
    } catch (err) {
      console.error("Error loading user startups:", err)
    }
  }

  const handleCreatePost = async (data: PostFormData) => {
    if (!currentUser) return

    try {
      setIsCreatingPost(true)
      setError(null)
      
      const { post } = await createEnhancedPost(data, currentUser.id)

      // Add the new post to the top of the list
      setPosts(prevPosts => [post, ...prevPosts])
      
      // Reload user startups in case new ones were created
      await loadUserStartups()
      
      // Hide the form
      setShowPostForm(false)
    } catch (err) {
      console.error("Error creating post:", err)
      setError("Failed to create post. Please try again.")
    } finally {
      setIsCreatingPost(false)
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
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="container max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Create Post Button */}
          {currentUser && !showPostForm && (
            <div className="flex justify-center">
              <Button
                onClick={() => setShowPostForm(true)}
                className="flex items-center gap-2"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Create Post
              </Button>
            </div>
          )}

          {/* Enhanced Post Form */}
          {showPostForm && currentUser && (
            <EnhancedPostForm
              onSubmit={handleCreatePost}
              userStartups={userStartups}
              isSubmitting={isCreatingPost}
              onCancel={() => setShowPostForm(false)}
            />
          )}

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
