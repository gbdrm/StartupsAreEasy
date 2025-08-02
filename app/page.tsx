"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { PostCard } from "@/components/post-card"
import { CollapsiblePostForm } from "@/components/collapsible-post-form"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"         
import { Loader2 } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { usePostsWithOptimisticUpdates } from "@/hooks/use-posts-optimistic"
import { useComments } from "@/hooks/use-comments"
import { createPostFromFormDirect } from "@/lib/api-direct"
import type { PostFormData, Comment as PostComment } from "@/lib/types"

export default function HomePage() {
  // Much simpler state management with optimistic updates
  const { user, loading: authLoading, login, logout } = useSimpleAuth()
  const { 
    posts, 
    loading: postsLoading, 
    loadPosts,
    refreshPosts, 
    updatePostLikeOptimistically,
    updatePostCommentsOptimistically,
    addPostOptimistically
  } = usePostsWithOptimisticUpdates(user?.id)
  
  const { comments, loadComments, handleComment, handleLike } = useComments(
    user, 
    refreshPosts,
    updatePostLikeOptimistically,
    updatePostCommentsOptimistically
  )
  
  // Only local UI state needed
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load posts when component mounts
  useEffect(() => {
    if (!postsLoading && posts.length === 0) {
      loadPosts()
    }
  }, [loadPosts, posts.length, postsLoading])

  // Load comments when posts change
  useEffect(() => {
    if (posts.length > 0) {
      const postIds = posts.map(post => post.id)
      loadComments(postIds)
    }
  }, [posts, loadComments])

  const handleCreatePost = async (data: PostFormData) => {
    if (!user) return

    try {
      setIsCreatingPost(true)
      setError(null)
      
      await createPostFromFormDirect(data, user.id)
      
      // Refresh posts to get the new one
      refreshPosts()
    } catch (err) {
      console.error("Error creating post:", err)
      setError("Failed to create post. Please try again.")
    } finally {
      setIsCreatingPost(false)
    }
  }

  // Wrapper function to match PostCard interface
  const handleLikeWrapper = (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post) {
      handleLike(postId, post.liked_by_user || false, post.likes_count || 0)
    }
  }

  // Show loading only when actually needed
  const showLoading = authLoading || (postsLoading && posts.length === 0)
  
  console.log(`[${new Date().toISOString()}] HomePage: Loading states - authLoading: ${authLoading}, postsLoading: ${postsLoading}, posts.length: ${posts.length}, showLoading: ${showLoading}`)

  if (showLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">
            {authLoading ? 'Authenticating...' : 'Loading posts...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogin={login} onLogout={logout} />

      <main className="container max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <CollapsiblePostForm
            user={user}
            onSubmit={handleCreatePost}
            userStartups={[]} // Simplified for now
            isSubmitting={isCreatingPost}
            onLoginRequired={() => setShowLoginDialog(true)}
          />

          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
            onLogin={login}
          />

          <Separator />

          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                comments={comments.filter((comment: PostComment) => comment.post_id === post.id)}
                onLike={handleLikeWrapper}
                onComment={handleComment}
              />
            ))}
          </div>

          {posts.length === 0 && !postsLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
