"use client"

import { useState, useEffect } from "react"
import { PostCard } from "@/components/post-card"
import { toggleLikeDirect, createCommentDirect } from "@/lib/api-direct"
import { getCurrentUserToken } from "@/lib/auth"
import type { Post, Comment, User } from "@/lib/types"
import { logger } from "@/lib/logger"

interface PostPageClientProps {
  post: Post
  user: User | null
  initialComments: Comment[]
}

export function PostPageClient({ post, user, initialComments }: PostPageClientProps) {
  const [comments, setComments] = useState(initialComments)
  const [currentPost, setCurrentPost] = useState(post)

  // Debug logging
  useEffect(() => {
    logger.debug('UI', 'PostPageClient mounted', { userId: user?.id, postId: post.id })
  }, [user, post])

  const handleLike = async (postId: string) => {
    logger.debug('UI', 'handleLike called', { userId: user?.id })
    if (!user) {
      logger.debug('UI', 'No user, returning early')
      return
    }

    try {
      // Get current user token for authentication
      const token = await getCurrentUserToken()
      if (!token) {
        logger.error('AUTH', 'No authentication token available')
        return
      }

      // Call the toggleLikeDirect function
      const result = await toggleLikeDirect(postId, user.id, token)
      
      // Update the post state with new like status
      setCurrentPost(prev => ({
        ...prev,
        liked_by_user: result.liked,
        likes_count: result.likesCount
      }))
    } catch (error) {
      logger.error('API', 'Error toggling like', error)
    }
  }

  const handleComment = async (postId: string, content: string) => {
    if (!user || !content.trim()) return false

    try {
      // Get current user token for authentication
      const token = await getCurrentUserToken()
      if (!token) {
        logger.error('AUTH', 'No authentication token available')
        return false
      }

      const newComment = await createCommentDirect({
        post_id: postId,
        user_id: user.id,
        content: content.trim()
      }, token)

      // Add the new comment to the list
      setComments(prev => [...prev, newComment])
      
      // Update comment count
      setCurrentPost(prev => ({
        ...prev,
        comments_count: prev.comments_count + 1
      }))

      return true
    } catch (error) {
      logger.error('API', 'Error creating comment', error)
      return false
    }
  }

  return (
    <PostCard
      post={currentPost}
      comments={comments}
      onLike={handleLike}
      onComment={handleComment}
      clickable={false}
    />
  )
}
