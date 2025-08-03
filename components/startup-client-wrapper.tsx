"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { StartupDetail } from "@/components/startup-detail"
import { PostCard } from "@/components/post-card"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { useComments } from "@/hooks/use-comments"
import { Separator } from "@/components/ui/separator"
import type { Startup, Post } from "@/lib/types"

interface StartupClientWrapperProps {
  startup: Startup
  relatedPosts: Post[]
}

export function StartupClientWrapper({ startup, relatedPosts }: StartupClientWrapperProps) {
  const { user, login, logout } = useSimpleAuth()
  const router = useRouter()
  const [posts, setPosts] = useState(relatedPosts)
  
  // Create refresh function for useComments
  const refreshPosts = () => {
    // In this component, we don't need to refresh from server
    // as posts are static props, but we need to provide the callback
  }

  // Optimistic update functions
  const updatePostLikeOptimistically = (postId: string, liked: boolean, likesCount: number) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, liked_by_user: liked, likes_count: likesCount }
          : post
      )
    )
  }

  const updatePostCommentsOptimistically = (postId: string, commentsCount: number) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, comments_count: commentsCount }
          : post
      )
    )
  }

  const { comments, loadComments, handleComment, handleLike } = useComments(
    user, 
    refreshPosts,
    updatePostLikeOptimistically,
    updatePostCommentsOptimistically
  )

  // Create wrapper function for onLike to match PostCard's expected signature
  const handlePostLike = (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post) {
      handleLike(postId, post.liked_by_user || false, post.likes_count)
    }
  }

  // Load comments for related posts
  useEffect(() => {
    if (posts.length > 0) {
      const postIds = posts.map(post => post.id)
      loadComments(postIds)
    }
  }, [posts])

  const handleBackClick = () => {
    // Use browser back if available, otherwise navigate to home
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <button 
            onClick={handleBackClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ← Back to Startups
          </button>
        </div>

        {/* Startup Details */}
        <StartupDetail startup={startup} />

        {/* Related Posts Timeline */}
        {posts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Journey Timeline</h2>
            <p className="text-muted-foreground mb-8">
              Follow {startup.name}'s progress from idea to launch
            </p>
            
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  comments={comments.filter((comment) => comment.post_id === post.id)}
                  onLike={handlePostLike}
                  onComment={handleComment}
                  clickable={true}
                />
              ))}
            </div>
          </div>
        )}

        {posts.length === 0 && (
          <div className="mt-12 text-center py-12">
            <p className="text-muted-foreground">No posts yet for this startup.</p>
          </div>
        )}
      </main>
    </div>
  )
}
