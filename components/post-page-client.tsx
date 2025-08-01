"use client"

import { useState, useEffect } from "react"
import { PostCard } from "@/components/post-card"
import { toggleLike, createComment } from "@/lib/posts"
import type { Post, Comment, User } from "@/lib/types"

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
    console.log('PostPageClient - user:', user)
    console.log('PostPageClient - post:', post)
  }, [user, post])

  const handleLike = async (postId: string) => {
    console.log('handleLike called with user:', user)
    if (!user) {
      console.log('No user, returning early')
      return
    }

    try {
      await toggleLike(postId, user.id)
      
      // Update the post state
      setCurrentPost(prev => ({
        ...prev,
        liked_by_user: !prev.liked_by_user,
        likes_count: prev.liked_by_user ? prev.likes_count - 1 : prev.likes_count + 1
      }))
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  const handleComment = async (postId: string, content: string) => {
    if (!user) return

    try {
      const newComment = await createComment({
        postId,
        userId: user.id,
        content
      })

      // Add the new comment to the list
      const commentWithUser = {
        id: newComment.id,
        post_id: postId,
        content,
        created_at: newComment.created_at,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar
        }
      }

      setComments(prev => [...prev, commentWithUser])
      
      // Update comment count
      setCurrentPost(prev => ({
        ...prev,
        comments_count: prev.comments_count + 1
      }))
    } catch (error) {
      console.error("Error creating comment:", error)
    }
  }

  return (
    <PostCard
      post={currentPost}
      user={user}
      comments={comments}
      onLike={handleLike}
      onComment={handleComment}
      clickable={false}
    />
  )
}
