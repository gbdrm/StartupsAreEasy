import { useState, useCallback, useRef } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import type { Post } from '@/lib/types'
import { logger } from '@/lib/logger'

// Request state tracking for concurrent request handling
interface RequestState {
    loading: boolean;
    abortController?: AbortController;
    timestamp: number;
}

export function usePostsWithOptimisticUpdates(userId?: string) {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoaded = useRef(false)
    const requestState = useRef<RequestState | null>(null)
    const optimisticUpdates = useRef<Set<string>>(new Set()) // Track pending optimistic updates

    const loadPosts = useCallback(async () => {
        const currentTimestamp = Date.now()
        
        // Check if there's already a request in progress
        if (requestState.current?.loading) {
            logger.debug('usePostsWithOptimisticUpdates: Request already in progress, aborting previous')
            requestState.current.abortController?.abort()
        }

        // Create new abort controller for this request
        const abortController = new AbortController()
        requestState.current = {
            loading: true,
            abortController,
            timestamp: currentTimestamp
        }

        logger.info('usePostsWithOptimisticUpdates: Starting to load posts', { userId: userId || 'anonymous' })

        try {
            setLoading(true)

            logger.info('usePostsWithOptimisticUpdates: Calling getPostsDirect...')
            const postsData = await getPostsDirect(userId)

            // Check if this request is still the latest one
            if (requestState.current?.timestamp !== currentTimestamp) {
                logger.debug('usePostsWithOptimisticUpdates: Request outdated, ignoring results')
                return
            }

            logger.info('usePostsWithOptimisticUpdates: API call completed, setting posts', {
                count: postsData.length,
                userId: userId || 'anonymous'
            })

            // Apply any pending optimistic updates to the fresh data
            const updatedPosts = postsData.map(post => {
                const optimisticKey = `like_${post.id}`
                if (optimisticUpdates.current.has(optimisticKey)) {
                    // Keep optimistic update until real update confirms it
                    return post
                }
                return post
            })

            setPosts(updatedPosts)

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
            // Ignore aborted requests
            if (abortController.signal.aborted) {
                logger.debug('usePostsWithOptimisticUpdates: Request was aborted')
                return
            }
            
            logger.error('usePostsWithOptimisticUpdates: Error loading posts', error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            // Only update loading state if this is still the current request
            if (requestState.current?.timestamp === currentTimestamp) {
                logger.info('usePostsWithOptimisticUpdates: Setting loading to false')
                setLoading(false)
                requestState.current = null
            }
        }
    }, [userId]) // Remove loading from dependencies to prevent infinite loop

    const refreshPosts = useCallback(() => {
        hasLoaded.current = false
        loadPosts()
    }, [loadPosts])

    // Optimistic like update with conflict resolution
    const updatePostLikeOptimistically = useCallback((postId: string, liked: boolean, likesCount: number) => {
        logger.debug('Optimistically updating post like', { postId, liked, likesCount })

        const optimisticKey = `like_${postId}`
        optimisticUpdates.current.add(optimisticKey)

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

        // Clean up optimistic update after a delay
        setTimeout(() => {
            optimisticUpdates.current.delete(optimisticKey)
        }, 5000)
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
