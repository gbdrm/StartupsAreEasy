import { useState, useCallback, useRef } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import type { Post } from '@/lib/types'

export function usePostsWithOptimisticUpdates(userId?: string) {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoaded = useRef(false)

    const loadPosts = useCallback(async () => {
        if (loading) {
            console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Skipping load - already loading`)
            return
        }

        console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Loading posts for user: ${userId || 'anonymous'}`)

        try {
            setLoading(true)

            const postsData = await getPostsDirect(userId)
            setPosts(postsData)

            console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Loaded ${postsData.length} posts, user: ${userId || 'anonymous'}`)

            // Log like status for debugging
            const likedPosts = postsData.filter(p => p.liked_by_user)
            if (likedPosts.length > 0) {
                console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Found ${likedPosts.length} liked posts:`, likedPosts.map(p => p.id))
            }

            hasLoaded.current = true
        } catch (error) {
            console.error(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Error loading posts:`, error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Setting loading to false`)
            setLoading(false)
        }
    }, [userId]) // Remove loading from dependencies to prevent infinite loop

    const refreshPosts = useCallback(() => {
        hasLoaded.current = false
        loadPosts()
    }, [loadPosts])

    // Optimistic like update
    const updatePostLikeOptimistically = useCallback((postId: string, liked: boolean, likesCount: number) => {
        console.log(`🎯 Optimistically updating post ${postId}: liked=${liked}, count=${likesCount}`)

        setPosts(prevPosts =>
            prevPosts.map(post =>
                post.id === postId
                    ? {
                        ...post,
                        liked_by_user: liked,
                        likes_count: likesCount
                    }
                    : post
            )
        )
    }, [])

    // Optimistic comment update
    const updatePostCommentsOptimistically = useCallback((postId: string, commentsCount: number) => {
        console.log(`💬 Optimistically updating post ${postId} comments: count=${commentsCount}`)

        setPosts(prevPosts =>
            prevPosts.map(post =>
                post.id === postId
                    ? { ...post, comments_count: commentsCount }
                    : post
            )
        )
    }, [])

    // Add new post optimistically
    const addPostOptimistically = useCallback((newPost: Post) => {
        console.log(`✨ Optimistically adding new post:`, newPost.id)

        setPosts(prevPosts => [newPost, ...prevPosts])
    }, [])

    return {
        posts,
        loading,
        loadPosts,
        refreshPosts,
        updatePostLikeOptimistically,
        updatePostCommentsOptimistically,
        addPostOptimistically,
    }
}
