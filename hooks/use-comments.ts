import { useState, useCallback } from "react"
import { getBulkCommentsDirect, createCommentDirect } from "@/lib/api-direct"
import type { User, Post, Comment } from "@/lib/types"

export function useComments(currentUser: User | null, refreshPosts: () => void) {
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
            const newComment = await createCommentDirect({
                post_id: postId,
                user_id: currentUser.id,
                content
            })

            // Add the new comment to local state
            setComments(prev => [...prev, newComment])

            // Refresh posts to update comment counts
            refreshPosts()

            return true
        } catch (error) {
            console.error("Error creating comment:", error)
            return false
        }
    }, [currentUser, refreshPosts])

    const handleLike = useCallback(async (postId: string) => {
        if (!currentUser) return

        try {
            // For now, just log that like functionality is not yet implemented
            console.log("Like functionality not yet implemented with direct API")
        } catch (error) {
            console.error("Error toggling like:", error)
        }
    }, [currentUser])

    return {
        comments,
        loadComments,
        handleComment,
        handleLike,
    }
}
