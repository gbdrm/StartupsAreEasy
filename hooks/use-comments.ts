import { useState, useCallback } from "react"
import { getBulkCommentsDirect, createCommentDirect, toggleLikeDirect } from "@/lib/api-direct"
import { getCurrentUserToken } from "@/lib/auth"
import type { User, Post, Comment } from "@/lib/types"

export function useComments(
    currentUser: User | null,
    refreshPosts: () => void,
    updatePostLikeOptimistically?: (postId: string, liked: boolean, likesCount: number) => void,
    updatePostCommentsOptimistically?: (postId: string, commentsCount: number) => void
) {
    const [comments, setComments] = useState<Comment[]>([])

    const loadComments = useCallback(async (postIds: string[]) => {
        if (postIds.length === 0) {
            setComments([])
            return
        }

        try {
            // Use bulk API to load all comments in one request
            const allComments = await getBulkCommentsDirect(postIds)
            setComments(allComments)
        } catch (error) {
            console.error("Error loading comments:", error)
            setComments([])
        }
    }, []) // Empty dependency array since it doesn't depend on any props/state

    const handleComment = useCallback(async (postId: string, content: string) => {
        if (!currentUser) return

        try {
            const token = await getCurrentUserToken()

            // Optimistically add comment to local state first
            const tempComment: Comment = {
                id: `temp-${Date.now()}`,
                post_id: postId,
                user: {
                    id: currentUser.id,
                    name: currentUser.name,
                    username: currentUser.username,
                    avatar: currentUser.avatar,
                },
                content,
                created_at: new Date().toISOString(),
            }

            // Add to local state immediately
            setComments(prev => [...prev, tempComment])

            // Update post comment count optimistically
            const postComments = comments.filter(c => c.post_id === postId)
            const newCount = postComments.length + 1
            updatePostCommentsOptimistically?.(postId, newCount)

            const newComment = await createCommentDirect({
                post_id: postId,
                user_id: currentUser.id,
                content
            }, token || undefined)

            // Replace temp comment with real one
            setComments(prev =>
                prev.map(c => c.id === tempComment.id ? newComment : c)
            )

            // Refresh posts to get accurate counts
            refreshPosts()

            return true
        } catch (error) {
            console.error("Error creating comment:", error)
            // Remove temp comment on error
            setComments(prev => prev.filter(c => c.id !== `temp-${Date.now()}`))
            return false
        }
    }, [currentUser, refreshPosts, comments, updatePostCommentsOptimistically])

    const handleLike = useCallback(async (postId: string, currentLiked: boolean, currentCount: number) => {
        console.log('🔥 handleLike called with postId:', postId, 'user:', currentUser?.id)

        if (!currentUser) {
            console.log('❌ No current user, cannot like')
            return
        }

        // Optimistically update UI first
        const newLiked = !currentLiked
        const newCount = newLiked ? currentCount + 1 : currentCount - 1

        console.log(`🎯 Optimistic update: ${currentLiked} -> ${newLiked}, count: ${currentCount} -> ${newCount}`)
        updatePostLikeOptimistically?.(postId, newLiked, newCount)

        try {
            console.log('🔑 Getting user token for like operation...')
            const token = await getCurrentUserToken()
            console.log('🔑 Token obtained:', !!token, 'length:', token?.length || 0)

            if (!token) {
                console.error('❌ No user token available, cannot like')
                // Revert optimistic update
                updatePostLikeOptimistically?.(postId, currentLiked, currentCount)

                // Try to refresh the session and get a new token
                console.log('🔄 Attempting to refresh session...')
                window.location.reload() // Simple solution: reload to re-authenticate
                return null
            }

            const result = await toggleLikeDirect(postId, currentUser.id, token)
            console.log('✅ toggleLikeDirect result:', result)

            // Update with actual result from server (in case of discrepancy)
            updatePostLikeOptimistically?.(postId, result.liked, result.likesCount)

            return result
        } catch (error) {
            console.error("❌ Error toggling like:", error)

            // Revert optimistic update on error
            updatePostLikeOptimistically?.(postId, currentLiked, currentCount)

            // If it's an auth error, try refreshing the page
            if (error instanceof Error && error.message.includes('Session timeout')) {
                console.log('🔄 Session expired, reloading page...')
                window.location.reload()
            }
            return null
        }
    }, [currentUser, updatePostLikeOptimistically])

    return {
        comments,
        loadComments,
        handleComment,
        handleLike,
    }
}
