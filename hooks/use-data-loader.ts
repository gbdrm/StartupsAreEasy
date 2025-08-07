"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import { useSimpleAuth } from '@/hooks/use-simple-auth'
import type { Post, Startup } from '@/lib/types'
import { logger } from '@/lib/logger'

export function useDataLoader() {
    const { user } = useSimpleAuth()
    const [posts, setPosts] = useState<Post[]>([])
    const [userStartups, setUserStartups] = useState<Startup[]>([])
    const [postsLoading, setPostsLoading] = useState(false)
    const hasLoaded = useRef(false)

    const loadPosts = useCallback(async () => {
        if (postsLoading || hasLoaded.current) return

        logger.debug('useDataLoader: Loading posts')

        try {
            setPostsLoading(true)
            hasLoaded.current = true

            const postsData = await getPostsDirect(user?.id)
            setPosts(postsData)

            logger.debug('API', 'useDataLoader: Loaded posts', { count: postsData.length })
        } catch (error) {
            logger.error('useDataLoader: Error loading posts', error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            setPostsLoading(false)
        }
    }, [user?.id]) // Remove postsLoading from dependencies to prevent infinite loop

    // Load posts once when component mounts
    useEffect(() => {
        if (posts.length === 0 && !postsLoading && !hasLoaded.current) {
            loadPosts()
        }
    }, [posts.length, postsLoading, loadPosts])

    // Load user startups when user changes  
    useEffect(() => {
        if (user && userStartups.length === 0) {
            // For simplicity, just set empty array for now
            setUserStartups([])
        }
    }, [user, userStartups.length])

    const refreshPosts = useCallback(() => {
        hasLoaded.current = false
        setPosts([]) // Clear posts to force reload
        loadPosts()
    }, [loadPosts])

    return {
        posts,
        userStartups,
        loading: postsLoading,
        loadPosts,
        refreshPosts,
    }
}
