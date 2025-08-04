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
        localStorage.removeItem('auth-reload-pending') // Clear reload state too
        localStorage.removeItem('telegram-login-complete') // Clear login completion flag
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
                // Check if we're in the middle of an auth reload
                if (typeof window !== 'undefined' && localStorage.getItem("auth-reload-pending")) {
                    logger.info("useSimpleAuth: Auth reload pending, waiting for page reload...")

                    // Failsafe: Clear the reload state after 5 seconds if page doesn't reload
                    setTimeout(() => {
                        if (localStorage.getItem("auth-reload-pending")) {
                            logger.warn("useSimpleAuth: Reload state timeout, clearing and continuing")
                            localStorage.removeItem("auth-reload-pending")
                            setGlobalLoading(false)
                        }
                    }, 5000)

                    // Keep loading state while waiting for reload
                    setGlobalUser(null)
                    setGlobalLoading(true)
                    return
                }

                logger.debug("useSimpleAuth: Getting initial session...")

                // TEMPORARY: Skip session check only in production due to hanging issue
                const isProduction = process.env.NODE_ENV === 'production'
                if (isProduction) {
                    logger.info("useSimpleAuth: Bypassing session check due to production hanging issue")

                    // Check if we have stored tokens from a successful login
                    const hasStoredToken = localStorage.getItem("sb-access-token")
                    const loginComplete = localStorage.getItem("telegram-login-complete")

                    if (hasStoredToken && loginComplete) {
                        logger.info("useSimpleAuth: Found stored tokens, loading user profile")
                        try {
                            const profile = await getCurrentUserProfile()
                            if (profile) {
                                logger.info("useSimpleAuth: Successfully loaded profile from stored tokens")
                                setGlobalUser(profile)
                                setGlobalLoading(false)
                                return
                            }
                        } catch (profileError) {
                            logger.error("useSimpleAuth: Error loading profile from stored tokens:", profileError)
                        }
                    }

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
                            // Clear any pending reload state since we successfully signed in
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem("auth-reload-pending")
                            }

                            const profile = await getCurrentUserProfile()
                            logger.debug("useSimpleAuth: Got profile after sign in", {
                                profile: profile ? `${profile.first_name} ${profile.last_name} (@${profile.username})` : 'null'
                            })
                            setGlobalUser(profile)

                            // Note: Don't reload here - auth.ts already handles the reload
                            // This prevents double-reloading which causes auth loops
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

            // If we got a temp user (production bypass), start loading the real profile
            if (user && user.id === 'temp-loading') {
                logger.info("useSimpleAuth: Got temp user, will load real profile shortly")
                setGlobalUser(user) // Show temp user immediately

                // Try to load real profile after a short delay
                setTimeout(async () => {
                    try {
                        const realProfile = await getCurrentUserProfile()
                        if (realProfile) {
                            logger.info("useSimpleAuth: Loaded real profile, replacing temp user")
                            setGlobalUser(realProfile)
                        }
                    } catch (profileError) {
                        logger.error("useSimpleAuth: Failed to load real profile:", profileError)
                    }
                }, 500) // Half-second delay

            } else {
                // Normal dev login
                setGlobalUser(user)
            }

        } catch (error) {
            if (error instanceof Error && error.message === "AUTH_RELOAD_IN_PROGRESS") {
                // This is expected during production bypass - don't show error
                logger.info('Auth reload in progress, waiting for page reload...')
                return
            }
            logger.error('Login failed:', error)
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
