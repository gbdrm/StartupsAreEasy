"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile, signInWithTelegram, signOut } from '@/lib/auth'
import { logger } from '@/lib/logger'
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
    logger.debug(`useSimpleAuth: Setting global loading to ${loading}`)
    globalLoading = loading
    notifySubscribers()
}

function resetAuth() {
    logger.debug("useSimpleAuth: Resetting auth state")

    // Clear any localStorage items
    if (typeof window !== 'undefined') {
        localStorage.removeItem('sb-access-token')
        localStorage.removeItem('fake-user-session')
    }

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

        logger.debug("useSimpleAuth: Initializing auth (singleton)...")
        isAuthInitialized = true
        hasInitialized.current = true

        // Get initial session with timeout
        const initAuth = async () => {
            try {
                logger.debug("useSimpleAuth: Getting initial session...")

                // TEMPORARY: Skip session check only in production due to hanging issue
                const isProduction = process.env.NODE_ENV === 'production'
                if (isProduction) {
                    logger.info("useSimpleAuth: Bypassing session check due to production hanging issue")
                    logger.debug("useSimpleAuth: Starting with clean auth state")
                    setGlobalUser(null)
                    setGlobalLoading(false)
                    return
                }

                // Normal session check for development
                const sessionPromise = supabase.auth.getSession()
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Initial session timeout')), 5000) // 5 second timeout
                })

                logger.debug("useSimpleAuth: About to race session vs timeout...")
                let sessionResult
                try {
                    sessionResult = await Promise.race([sessionPromise, timeoutPromise])
                    logger.debug("useSimpleAuth: Session call completed successfully")
                } catch (timeoutError) {
                    logger.error("useSimpleAuth: Initial session timed out (5s), clearing auth", timeoutError)
                    setGlobalUser(null)
                    setGlobalLoading(false)
                    return
                }

                const { data: { session } } = sessionResult

                if (session?.user) {
                    logger.info("useSimpleAuth: Found existing session for user", { userId: session.user.id })
                    const profile = await getCurrentUserProfile()
                    logger.debug("useSimpleAuth: Got profile", {
                        profile: profile ? `${profile.first_name} ${profile.last_name} (@${profile.username})` : 'null'
                    })
                    setGlobalUser(profile)
                } else {
                    logger.debug("useSimpleAuth: No existing session")
                    setGlobalUser(null)
                }
            } catch (error) {
                logger.error("useSimpleAuth: Error getting session", error)
                setGlobalUser(null)
            } finally {
                logger.debug("useSimpleAuth: Setting loading to false")
                setGlobalLoading(false)
            }
        }

        initAuth()

        // Failsafe: Ensure loading is set to false after maximum timeout
        const failsafeTimeout = setTimeout(() => {
            if (globalLoading) {
                logger.warn("useSimpleAuth: Failsafe timeout - forcing loading to false")
                setGlobalLoading(false)
            }
        }, 10000) // 10 second maximum

        // Listen for auth changes (only once globally)
        if (!authSubscription) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    logger.info("useSimpleAuth: Auth event", { event })

                    if (event === 'SIGNED_OUT') {
                        logger.info("useSimpleAuth: User signed out")
                        resetAuth()
                    } else if (event === 'SIGNED_IN' && session?.user) {
                        logger.info("useSimpleAuth: User signed in", {
                            userId: session.user.id,
                            email: session.user.email
                        })
                        try {
                            const profile = await getCurrentUserProfile()
                            logger.debug("useSimpleAuth: Got profile after sign in", {
                                profile: profile ? `${profile.first_name} ${profile.last_name} (@${profile.username})` : 'null'
                            })
                            setGlobalUser(profile)

                            // Force a page reload after successful Telegram login to ensure UI consistency
                            // This addresses the issue where the button doesn't update after sign-in
                            logger.info("useSimpleAuth: Forcing page reload for UI consistency")
                            setTimeout(() => {
                                if (typeof window !== 'undefined') {
                                    window.location.reload()
                                }
                            }, 1000) // 1 second delay to let the auth state settle
                        } catch (error) {
                            logger.error("useSimpleAuth: Error getting profile", error)
                            setGlobalUser(null)
                        } finally {
                            // Ensure loading is set to false after SIGNED_IN event
                            logger.debug("useSimpleAuth: SIGNED_IN complete, setting loading to false")
                            setGlobalLoading(false)
                        }
                    } else if (event === 'TOKEN_REFRESHED') {
                        // Don't change loading state for token refresh
                        logger.debug("useSimpleAuth: Token refreshed")
                    } else {
                        // For any other event, ensure loading is false
                        logger.debug(`useSimpleAuth: Other auth event (${event}), ensuring loading is false`)
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
            // Force reload to ensure all state is cleared and UI updates
            if (typeof window !== 'undefined') {
                window.location.reload()
            }
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
