"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/header"
import { PostCard } from "@/components/post-card"
import { CollapsiblePostForm } from "@/components/collapsible-post-form"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { usePostsWithOptimisticUpdates } from "@/hooks/use-posts-optimistic"
import { useComments } from "@/hooks/use-comments"
import { useStagedLoading } from "@/hooks/use-staged-loading"
import { createPostFromFormDirect } from "@/lib/api-direct"
import { getUserStartups } from "@/lib/startups"
import { logger } from "@/lib/logger"
import type { PostFormData, Comment as PostComment, Startup } from "@/lib/types"

export default function HomePage() {
  const stagingState = useStagedLoading()
  const { user, loading: authLoading } = useSimpleAuth()
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

  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userStartups, setUserStartups] = useState<Startup[]>([])
  const hasInitialized = useRef(false)

  // Staged initialization
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    async function initializeApp() {
      try {
        stagingState.setStage('initializing')
        
        // Wait for auth to be determined
        stagingState.setStage('checking-auth')
        // The auth hook handles its own loading, we just need to wait for it
        
      } catch (error) {
        logger.error('APP', 'App initialization failed', error)
        stagingState.setError(error instanceof Error ? error.message : 'Initialization failed')
      }
    }

    initializeApp()
  }, [stagingState])

  // Handle auth state changes and load posts
  useEffect(() => {
    if (authLoading) return // Still determining auth state

    async function loadInitialData() {
      try {
        if (stagingState.stage === 'checking-auth' || stagingState.stage === 'initializing') {
          stagingState.setStage('loading-posts')
          
          if (posts.length === 0 && !postsLoading) {
            logger.info('APP', '📱 Loading initial posts')
            await loadPosts()
            return // Let the next effect handle comment loading
          }

          stagingState.setStage('complete')
        }
      } catch (error) {
        logger.error('APP', 'Failed to load initial data', error)
        stagingState.setError(error instanceof Error ? error.message : 'Failed to load data')
      }
    }

    loadInitialData()
  }, [authLoading, postsLoading, loadPosts, stagingState])

  // Separate effect to load comments when posts are available
  useEffect(() => {
    if (posts.length > 0 && stagingState.stage === 'loading-posts') {
      async function loadCommentsForPosts() {
        try {
          stagingState.setStage('loading-comments')
          const postIds = posts.map(p => p.id)
          logger.info('APP', 'Loading comments for posts', { count: postIds.length })
          await loadComments(postIds)
          stagingState.setStage('complete')
        } catch (error) {
          logger.error('APP', 'Failed to load comments', error)
          stagingState.setError(error instanceof Error ? error.message : 'Failed to load comments')
        }
      }
      
      loadCommentsForPosts()
    }
  }, [posts.length, loadComments, stagingState])

  // Load user startups when user changes
  useEffect(() => {
    async function loadUserStartupsData() {
      if (!user) return
      try {
        const startups = await getUserStartups(user.id)
        setUserStartups(startups)
      } catch (err) {
        logger.error('APP', 'Failed to load user startups', err)
      }
    }
    
    loadUserStartupsData()
  }, [user])

  const handleCreatePost = async (data: PostFormData) => {
    if (!user) return
    try {
      setIsCreatingPost(true)
      setError(null)
      await createPostFromFormDirect(data, user.id)
      refreshPosts()
      // Reload user startups if an idea was posted (creates a new startup)
      if (data.type === "idea") {
        try {
          const startups = await getUserStartups(user.id)
          setUserStartups(startups)
        } catch (err) {
          logger.error('APP', 'Failed to reload user startups after creating idea', err)
        }
      }
    } catch (err) {
      logger.error('APP', 'Error creating post', err)
      
      // The API now handles all error categorization, so just pass through the message
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsCreatingPost(false)
    }
  }

  const handleLikeWrapper = (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post) {
      handleLike(postId, post.liked_by_user || false, post.likes_count || 0)
    }
  }

  // Show loading during staged initialization
  if (stagingState.stage !== 'complete' && stagingState.stage !== 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {stagingState.message}
            </p>
            <Progress value={stagingState.progress} className="w-64" />
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (stagingState.stage === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{stagingState.error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CollapsiblePostForm
            onSubmit={handleCreatePost}
            userStartups={userStartups}
            isSubmitting={isCreatingPost}
            onLoginRequired={() => setShowLoginDialog(true)}
            error={error}
            onErrorClear={() => setError(null)}
          />
          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
          />
          <Separator />
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
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
