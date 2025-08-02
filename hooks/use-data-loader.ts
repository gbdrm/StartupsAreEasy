"use client"

import { useState, useEffect, useRef } from 'react'
import { getPostsDirect } from '@/lib/api-direct'
import { useSimpleAuth } from '@/hooks/use-simple-auth'
import type { Post, Startup } from '@/lib/types'

export function useDataLoader() {
    const { user } = useSimpleAuth()
    const [posts, setPosts] = useState<Post[]>([])
    const [userStartups, setUserStartups] = useState<Startup[]>([])
    const [postsLoading, setPostsLoading] = useState(false)
    const hasLoaded = useRef(false)

    // Load posts once when component mounts
    useEffect(() => {
        if (posts.length === 0 && !postsLoading && !hasLoaded.current) {
            loadPosts()
        }
    }, [])

    // Load user startups when user changes  
    useEffect(() => {
        if (user && userStartups.length === 0) {
            // For simplicity, just set empty array for now
            setUserStartups([])
        }
    }, [user])

    const loadPosts = async () => {
        if (postsLoading || hasLoaded.current) return

        console.log(`[${new Date().toISOString()}] useDataLoader: Loading posts...`)

        try {
            setPostsLoading(true)
            hasLoaded.current = true

            const postsData = await getPostsDirect(user?.id)
            setPosts(postsData)

            console.log(`[${new Date().toISOString()}] useDataLoader: Loaded ${postsData.length} posts`)
        } catch (error) {
            console.error(`[${new Date().toISOString()}] useDataLoader: Error loading posts:`, error)
            hasLoaded.current = false // Allow retry
            throw error
        } finally {
            setPostsLoading(false)
        }
    }

    const refreshPosts = () => {
        hasLoaded.current = false
        setPosts([]) // Clear posts to force reload
        loadPosts()
    }

    return {
        posts,
        userStartups,
        loading: postsLoading,
        loadPosts,
        refreshPosts,
    }
}
