"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, signInWithTelegram, signOut } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { usePageVisibility } from '@/hooks/use-page-visibility'
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
    const isVisible = usePageVisibility()

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

    // Handle page visibility changes - refresh auth when returning to tab
    useEffect(() => {
        if (isVisible && globalUser && !globalLoading) {
            logger.debug("useSimpleAuth: Page became visible, checking auth validity...")

            // Validate current auth state when returning to tab
            const validateAuth = async () => {
                try {
                    const profile = await getCurrentUser()
                    if (!profile && globalUser) {
                        logger.warn("useSimpleAuth: Auth validation failed after tab switch, clearing state")
                        resetAuth()
                        window.location.reload()
                    }
                } catch (error) {
                    logger.error("useSimpleAuth: Auth validation error after tab switch:", error)
                    resetAuth()
                    window.location.reload()
                }
            }

            // Debounce the validation to avoid too many calls
            const timeoutId = setTimeout(validateAuth, 1000)
            return () => clearTimeout(timeoutId)
        }
    }, [isVisible])

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
                            const profile = await getCurrentUser()
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

                // Smart session check for development with quick fallback
                const getSessionWithQuickFallback = async () => {
                    // First try: Quick session check (2 seconds)
                    try {
                        const quickPromise = supabase.auth.getSession()
                        const quickTimeout = new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new Error('Quick timeout')), 2000)
                        })
                        return await Promise.race([quickPromise, quickTimeout])
                    } catch (quickError) {
                        logger.warn("useSimpleAuth: Quick session check failed, checking stored tokens...")

                        // Immediate fallback: Check if we have valid stored tokens
                        const storedToken = localStorage.getItem("sb-access-token")
                        if (storedToken) {
                            try {
                                const payload = JSON.parse(atob(storedToken.split('.')[1]))
                                const now = Math.floor(Date.now() / 1000)

                                if (payload.exp && payload.exp > now) {
                                    logger.info("useSimpleAuth: Using valid stored token in development")
                                    const profile = await getCurrentUser()
                                    if (profile) {
                                        setGlobalUser(profile)
                                        setGlobalLoading(false)
                                        return { success: true }
                                    }
                                }
                            } catch (tokenError) {
                                logger.error("useSimpleAuth: Stored token validation failed:", tokenError)
                            }
                        }

                        throw quickError
                    }
                }

                logger.debug("useSimpleAuth: Starting smart session check...")
                let sessionResult
                try {
                    const result = await getSessionWithQuickFallback()
                    if (result && 'success' in result) {
                        return // Already handled by stored token path
                    }
                    sessionResult = result
                } catch (timeoutError) {
                    logger.error("useSimpleAuth: All session methods failed", timeoutError)
                    setGlobalUser(null)
                    setGlobalLoading(false)
                    return
                }

                const { data: { session } } = sessionResult

                if (session?.user) {
                    logger.info("useSimpleAuth: Found existing session for user", { userId: session.user.id })
                    const profile = await getCurrentUser()
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

                            const profile = await getCurrentUser()
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
                        const realProfile = await getCurrentUser()
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
