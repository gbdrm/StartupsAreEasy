"use client"

import { useState, useEffect } from "react"
import { CollapsiblePostForm } from "@/components/collapsible-post-form"
import { PostCard } from "@/components/post-card"
import { Header } from "@/components/header"
import { AuthDialog } from "@/components/auth-dialog"
import type { Post, Comment, PostType, PostFormData, Startup } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { getPosts } from "@/lib/posts"
import { createEnhancedPost, getUserStartupsForPosts } from "@/lib/enhanced-posts"
import { useAuth } from "@/hooks/use-auth"
import { useComments } from "@/hooks/use-comments"

export default function HomePage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const { comments, loadComments, handleComment, handleLike } = useComments(currentUser, setPosts)
  const [userStartups, setUserStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Load posts and user startups
  useEffect(() => {
    loadPosts()
  }, []) // Remove currentUser dependency to prevent unnecessary re-fetches

  // Load user startups separately when user changes
  useEffect(() => {
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

      // Load comments using the shared hook
      const postIds = postsData.map(post => post.id)
      await loadComments(postIds)
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

      // Add the new post to the top of the list with a unique key to prevent duplicates
      // Check if post already exists to prevent duplicates
      setPosts(prevPosts => {
        const postExists = prevPosts.some(existingPost => existingPost.id === post.id)
        if (postExists) {
          console.log("Post already exists, not adding duplicate")
          return prevPosts
        }
        return [post, ...prevPosts]
      })
      
      // Reload user startups in case new ones were created
      await loadUserStartups()
    } catch (err) {
      console.error("Error creating post:", err)
      setError("Failed to create post. Please try again.")
    } finally {
      setIsCreatingPost(false)
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

          {/* Collapsible Post Form - Always visible */}
          <CollapsiblePostForm
            user={currentUser}
            onSubmit={handleCreatePost}
            userStartups={userStartups}
            isSubmitting={isCreatingPost}
            onLoginRequired={() => setShowLoginDialog(true)}
          />

          {/* Auth Dialog */}
          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
            onLogin={handleLogin}
          />

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
