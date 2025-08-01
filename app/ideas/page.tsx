"use client"

import { useState, useEffect } from "react"
import { CollapsiblePostForm } from "@/components/collapsible-post-form"
import { PostCard } from "@/components/post-card"
import { Header } from "@/components/header"
import { AuthDialog } from "@/components/auth-dialog"
import type { Post, Comment, PostFormData, Startup } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { getPostsByType } from "@/lib/posts"
import { createEnhancedPost, getUserStartupsForPosts } from "@/lib/enhanced-posts"
import { useAuth } from "@/hooks/use-auth"
import { useComments } from "@/hooks/use-comments"

export default function IdeasPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const { comments, loadComments, handleComment, handleLike } = useComments(currentUser, setPosts)
  const [userStartups, setUserStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Diagnostics - log all loading states
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] Ideas page loading states:`, {
      authLoading,
      postsLoading: loading,
      currentUser: currentUser ? `${currentUser.name} (${currentUser.id})` : 'null',
      postsCount: posts.length,
      commentsCount: comments.length
    })
  }, [authLoading, loading, currentUser, posts.length, comments.length])

  // Emergency fallback: if loading states are stuck for more than 15 seconds, force clear them
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      if (authLoading || loading) {
        console.error(`[${new Date().toISOString()}] EMERGENCY: Ideas page loading states stuck for 15+ seconds, forcing clear`)
        setLoading(false)
        if (posts.length === 0) {
          setError("Loading timed out. Please refresh the page.")
        }
      }
    }, 15000) // 15 seconds

    return () => clearTimeout(emergencyTimeout)
  }, [authLoading, loading, posts.length])

  // Load posts and user startups
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Ideas page effect triggered: loadPosts()`)
    loadPosts()
  }, []) // Remove currentUser dependency to prevent unnecessary re-fetches

  // Load user startups separately when user changes
  useEffect(() => {
    if (currentUser) {
      console.log(`[${new Date().toISOString()}] Ideas page effect triggered: loadUserStartups() for user:`, currentUser.name)
      loadUserStartups()
    }
  }, [currentUser])

  const loadPosts = async () => {
    const startTime = Date.now()
    console.log(`[${new Date().toISOString()}] Starting loadPosts() for ideas`)
    
    try {
      setLoading(true)
      setError(null)
      
      console.log(`[${new Date().toISOString()}] Calling getPostsByType('idea') with userId:`, currentUser?.id || 'null')
      
      // Add timeout protection - if getPostsByType takes longer than 10 seconds, bail out
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Posts loading timeout after 10 seconds')), 10000)
      )
      
      const postsData = await Promise.race([
        getPostsByType("idea", currentUser?.id),
        timeoutPromise
      ]) as Post[]
      
      console.log(`[${new Date().toISOString()}] getPostsByType('idea') returned ${postsData.length} posts`)
      setPosts(postsData)

      // Load comments using the shared hook
      const postIds = postsData.map(post => post.id)
      console.log(`[${new Date().toISOString()}] Loading comments for ${postIds.length} idea posts`)
      
      try {
        await loadComments(postIds)
        console.log(`[${new Date().toISOString()}] Comments loaded successfully for ideas`)
      } catch (commentError) {
        console.error(`[${new Date().toISOString()}] Error loading comments for ideas (non-fatal):`, commentError)
        // Don't fail the whole operation if comments fail
      }
      
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error loading idea posts:`, err)
      
      if (err instanceof Error && err.message.includes('timeout')) {
        setError("Loading is taking longer than expected. Please check your connection and try again.")
      } else {
        setError("Failed to load ideas. Please try again.")
      }
    } finally {
      const endTime = Date.now()
      console.log(`[${new Date().toISOString()}] loadPosts() for ideas completed in ${endTime - startTime}ms`)
      setLoading(false)
    }
  }

  const loadUserStartups = async () => {
    if (!currentUser) return
    try {
      const startups = await getUserStartupsForPosts(currentUser.id)
      setUserStartups(startups)
    } catch (err) {
      console.error("Error loading user startups for ideas page:", err)
    }
  }

  const handleCreatePost = async (data: PostFormData) => {
    if (!currentUser) return

    // Only allow idea posts on this page
    if (data.type !== "idea") {
      setError("Only idea posts are allowed on this page.")
      return
    }

    try {
      setIsCreatingPost(true)
      setError(null)
      
      const { post } = await createEnhancedPost(data, currentUser.id)

      // Add the new post to the top of the list with duplicate prevention
      setPosts(prevPosts => {
        const postExists = prevPosts.some(existingPost => existingPost.id === post.id)
        if (postExists) {
          console.log("Idea post already exists, not adding duplicate")
          return prevPosts
        }
        return [post, ...prevPosts]
      })
      
      // Reload user startups in case new ones were created
      await loadUserStartups()
    } catch (err) {
      console.error("Error creating idea post:", err)
      setError("Failed to create idea. Please try again.")
    } finally {
      setIsCreatingPost(false)
    }
  }

  // Show loading spinner only if both auth is loading AND we don't have any posts yet
  // This prevents the spinner from showing too long when auth takes time
  const showLoadingSpinner = (authLoading && !currentUser) || (loading && posts.length === 0)

  // Add diagnostic info in development
  const isDev = process.env.NODE_ENV === 'development'

  if (showLoadingSpinner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          {isDev && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <div>Auth loading: {authLoading ? 'true' : 'false'}</div>
              <div>Posts loading: {loading ? 'true' : 'false'}</div>
              <div>Current user: {currentUser ? currentUser.name : 'null'}</div>
              <div>Ideas count: {posts.length}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="container max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">💡 Ideas</h1>
            <p className="text-muted-foreground">
              Share your innovative startup ideas with the community
            </p>
          </div>

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
              <p className="text-muted-foreground">No ideas shared yet. Be the first to share your innovative idea!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
