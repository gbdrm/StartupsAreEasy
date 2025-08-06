import { useState, useCallback, useRef } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import type { Post } from '@/lib/types'
import { logger } from '@/lib/logger'

export function usePostsWithOptimisticUpdates(userId?: string) {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoaded = useRef(false)

    const loadPosts = useCallback(async () => {
        if (loading) {
            logger.debug('usePostsWithOptimisticUpdates: Skipping load - already loading')
            return
        }

        logger.info('usePostsWithOptimisticUpdates: Starting to load posts', { userId: userId || 'anonymous' })

        try {
            setLoading(true)

            logger.info('usePostsWithOptimisticUpdates: Calling getPostsDirect...')
            const postsData = await getPostsDirect(userId)

            logger.info('usePostsWithOptimisticUpdates: API call completed, setting posts', {
                count: postsData.length,
                userId: userId || 'anonymous'
            })
            setPosts(postsData)

            // Log like status for debugging
            const likedPosts = postsData.filter(p => p.liked_by_user)
            if (likedPosts.length > 0) {
                logger.debug('usePostsWithOptimisticUpdates: Found liked posts', {
                    count: likedPosts.length,
                    postIds: likedPosts.map(p => p.id)
                })
            }

            hasLoaded.current = true
            logger.info('usePostsWithOptimisticUpdates: Posts loaded successfully')
        } catch (error) {
            logger.error('usePostsWithOptimisticUpdates: Error loading posts', error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            logger.info('usePostsWithOptimisticUpdates: Setting loading to false')
            setLoading(false)
        }
    }, [userId]) // Remove loading from dependencies to prevent infinite loop

    const refreshPosts = useCallback(() => {
        hasLoaded.current = false
        loadPosts()
    }, [loadPosts])

    // Optimistic like update
    const updatePostLikeOptimistically = useCallback((postId: string, liked: boolean, likesCount: number) => {
        logger.debug('Optimistically updating post like', { postId, liked, likesCount })

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
        logger.debug('Optimistically updating post comments', { postId, commentsCount })

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
        logger.debug('Optimistically adding new post', { postId: newPost.id })

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
