import { useState, useCallback } from "react"
import { getBulkCommentsDirect, createCommentDirect, toggleLikeDirect } from "@/lib/api-direct"
import { getCurrentUserToken } from "@/lib/auth"
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
            const token = await getCurrentUserToken()
            const newComment = await createCommentDirect({
                post_id: postId,
                user_id: currentUser.id,
                content
            }, token || undefined)

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
        console.log('🔥 handleLike called with postId:', postId, 'user:', currentUser?.id)

        if (!currentUser) {
            console.log('❌ No current user, cannot like')
            return
        }

        try {
            console.log('🔑 Getting user token...')

            // Add timeout to getCurrentUserToken
            let token: string | null = null
            try {
                const tokenPromise = getCurrentUserToken()
                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error('Token timeout')), 3000)
                )

                token = await Promise.race([tokenPromise, timeoutPromise])
                console.log('🔑 Token obtained:', token ? 'YES' : 'NO')
            } catch (tokenError) {
                console.warn('⚠️ Token fetch failed:', tokenError, 'proceeding without token')
                token = null
            }

            console.log('🚀 Calling toggleLikeDirect...')
            const result = await toggleLikeDirect(postId, currentUser.id, token || undefined)
            console.log('✅ toggleLikeDirect result:', result)

            // Refresh posts to update like counts and state
            console.log('🔄 Refreshing posts...')
            refreshPosts()

            return result
        } catch (error) {
            console.error("❌ Error toggling like:", error)
            return null
        }
    }, [currentUser, refreshPosts])

    return {
        comments,
        loadComments,
        handleComment,
        handleLike,
    }
}
