import { useState, useCallback, useRef } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import type { Post } from '@/lib/types'

export function usePostsWithOptimisticUpdates(userId?: string) {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoaded = useRef(false)

    const loadPosts = useCallback(async () => {
        if (loading || hasLoaded.current) return

        console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Loading posts...`)

        try {
            setLoading(true)
            hasLoaded.current = true

            const postsData = await getPostsDirect(userId)
            setPosts(postsData)

            console.log(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Loaded ${postsData.length} posts`)
        } catch (error) {
            console.error(`[${new Date().toISOString()}] usePostsWithOptimisticUpdates: Error loading posts:`, error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            setLoading(false)
        }
    }, [userId, loading])

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
