"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile, signInWithTelegram, signOut } from '@/lib/auth'
import type { TelegramUser } from '@/lib/auth'
import type { User } from '@/lib/types'

// Global flag to prevent multiple initializations
let isAuthInitialized = false
let authSubscription: any = null
let globalUser: User | null = null
let globalLoading = true
let subscribers: Array<(user: User | null, loading: boolean) => void> = []

// Simple pub-sub for auth state
function notifySubscribers() {
    subscribers.forEach(callback => callback(globalUser, globalLoading))
}

function setGlobalUser(user: User | null) {
    globalUser = user
    notifySubscribers()
}

function setGlobalLoading(loading: boolean) {
    console.log(`[${new Date().toISOString()}] useSimpleAuth: Setting global loading to ${loading}`)
    globalLoading = loading
    notifySubscribers()
}

function resetAuth() {
    console.log(`[${new Date().toISOString()}] useSimpleAuth: Resetting auth state`)
    globalUser = null
    globalLoading = false
    notifySubscribers()
}

export function useSimpleAuth() {
    const [user, setUser] = useState<User | null>(globalUser)
    const [loading, setLoading] = useState(globalLoading)
    const hasInitialized = useRef(false)

    // Subscribe to global auth state changes
    useEffect(() => {
        const callback = (newUser: User | null, newLoading: boolean) => {
            setUser(newUser)
            setLoading(newLoading)
        }

        subscribers.push(callback)

        return () => {
            const index = subscribers.indexOf(callback)
            if (index > -1) {
                subscribers.splice(index, 1)
            }
        }
    }, [])

    useEffect(() => {
        // Only initialize once globally
        if (isAuthInitialized || hasInitialized.current) {
            return
        }

        console.log(`[${new Date().toISOString()}] useSimpleAuth: Initializing auth (singleton)...`)
        isAuthInitialized = true
        hasInitialized.current = true

        // Get initial session
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    console.log(`[${new Date().toISOString()}] useSimpleAuth: Found existing session`)
                    const profile = await getCurrentUserProfile()
                    setGlobalUser(profile)
                } else {
                    console.log(`[${new Date().toISOString()}] useSimpleAuth: No existing session`)
                    setGlobalUser(null)
                }
            } catch (error) {
                console.error(`[${new Date().toISOString()}] useSimpleAuth: Error getting session:`, error)
                setGlobalUser(null)
            } finally {
                console.log(`[${new Date().toISOString()}] useSimpleAuth: Setting loading to false`)
                setGlobalLoading(false)
            }
        }

        initAuth()

        // Failsafe: Ensure loading is set to false after maximum timeout
        const failsafeTimeout = setTimeout(() => {
            if (globalLoading) {
                console.warn(`[${new Date().toISOString()}] useSimpleAuth: Failsafe timeout - forcing loading to false`)
                setGlobalLoading(false)
            }
        }, 10000) // 10 second maximum

        // Listen for auth changes (only once globally)
        if (!authSubscription) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    console.log(`[${new Date().toISOString()}] useSimpleAuth: Auth event:`, event)

                    if (event === 'SIGNED_OUT') {
                        console.log(`[${new Date().toISOString()}] useSimpleAuth: User signed out`)
                        resetAuth()
                    } else if (event === 'SIGNED_IN' && session?.user) {
                        console.log(`[${new Date().toISOString()}] useSimpleAuth: User signed in`)
                        try {
                            const profile = await getCurrentUserProfile()
                            setGlobalUser(profile)
                        } catch (error) {
                            console.error(`[${new Date().toISOString()}] useSimpleAuth: Error getting profile:`, error)
                            setGlobalUser(null)
                        } finally {
                            // Ensure loading is set to false after SIGNED_IN event
                            console.log(`[${new Date().toISOString()}] useSimpleAuth: SIGNED_IN complete, setting loading to false`)
                            setGlobalLoading(false)
                        }
                    } else if (event === 'TOKEN_REFRESHED') {
                        // Don't change loading state for token refresh
                        console.log(`[${new Date().toISOString()}] useSimpleAuth: Token refreshed`)
                    } else {
                        // For any other event, ensure loading is false
                        console.log(`[${new Date().toISOString()}] useSimpleAuth: Other auth event (${event}), ensuring loading is false`)
                        setGlobalLoading(false)
                    }
                }
            )
            authSubscription = subscription
        }

        return () => {
            // Clear failsafe timeout
            clearTimeout(failsafeTimeout)
            // Don't unsubscribe on individual component unmount
            // Only when the entire app unmounts
        }
    }, [])

    const login = async (telegramUser: TelegramUser) => {
        try {
            const user = await signInWithTelegram(telegramUser)
            setGlobalUser(user)
        } catch (error) {
            console.error('Login failed:', error)
            throw error
        }
    }

    const logout = async () => {
        try {
            await signOut()
            resetAuth()
        } catch (error) {
            console.error('Logout failed:', error)
            throw error
        }
    }

    return {
        user,
        loading,
        login,
        logout
    }
}
