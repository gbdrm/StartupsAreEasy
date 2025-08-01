"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header" 
import { PostPageClient } from "@/components/post-page-client"
import { useAuth } from "@/hooks/use-auth"
import type { Post, Comment } from "@/lib/types"

interface PostClientWrapperProps {
  post: Post
  initialComments: Comment[]
}

export function PostClientWrapper({ post, initialComments }: PostClientWrapperProps) {
  const { user, login, logout } = useAuth()
  const router = useRouter()

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
      <Header user={user} onLogin={login} onLogout={logout} />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <button 
            onClick={handleBackClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ← Back to Feed
          </button>
        </div>

        <PostPageClient
          post={post}
          user={user}
          initialComments={initialComments}
        />

        {/* Related posts from same startup - we'll add this later */}
        {post.startup && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">More about {post.startup.name}</h3>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Related posts and startup details coming soon...
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
