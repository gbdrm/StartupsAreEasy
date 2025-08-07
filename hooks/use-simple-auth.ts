"use client"

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, signOut } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { User } from '@/lib/types'

// Global state with proper cleanup tracking
let isAuthInitialized = false
let authSubscription: any = null
let globalUser: User | null = null
let globalLoading = true
let subscribers: Array<(user: User | null, loading: boolean) => void> = []
let cleanupCallbacks: Array<() => void> = []
let initializationPromise: Promise<void> | null = null

// Simple pub-sub for auth state
function notifySubscribers() {
    subscribers.forEach(callback => callback(globalUser, globalLoading))
}

function setGlobalUser(user: User | null) {
    globalUser = user
    notifySubscribers()
}

function setGlobalLoading(loading: boolean) {
    logger.debug('AUTH', `Setting global loading to ${loading}`)
    globalLoading = loading
    notifySubscribers()
}

function resetAuth() {
    logger.debug('AUTH', 'Resetting auth state')

    // Use storage manager for consistent cleanup
    if (typeof window !== 'undefined') {
        const { clearAuthStorage } = require('@/lib/storage-utils')
        clearAuthStorage()
    }

    globalUser = null
    globalLoading = false
    notifySubscribers()
}

// Emergency auth reset for stuck states
export function emergencyAuthReset() {
    logger.warn('AUTH', 'Forcing complete auth reset')
    resetAuth()

    // Clear any remaining localStorage items
    if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('auth') || key.includes('telegram') || key.includes('logout')) {
                localStorage.removeItem(key)
            }
        })
    }

    // Force page reload
    window.location.reload()
} export function useSimpleAuth() {
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

        const cleanup = () => {
            const index = subscribers.indexOf(callback)
            if (index > -1) {
                subscribers.splice(index, 1)
            }
        }

        cleanupCallbacks.push(cleanup)

        return cleanup
    }, [])

    useEffect(() => {
        // Only initialize once globally, handle race conditions
        if (hasInitialized.current) {
            return
        }

        if (initializationPromise) {
            // Another component is already initializing, wait for it
            initializationPromise.then(() => {
                // Initialization complete, we can proceed
                hasInitialized.current = true
            })
            return
        }

        if (isAuthInitialized) {
            hasInitialized.current = true
            return
        }

        logger.debug('AUTH', 'Initializing auth (singleton)')
        isAuthInitialized = true
        hasInitialized.current = true

        // Create initialization promise to handle race conditions
        initializationPromise = (async () => {
            try {
                // Check if we're in the middle of an auth reload
                if (typeof window !== 'undefined' && localStorage.getItem("auth-reload-pending")) {
                    logger.info('AUTH', 'Auth reload pending, waiting for page reload')

                    // Failsafe: Clear the reload state after 5 seconds if page doesn't reload
                    setTimeout(() => {
                        if (localStorage.getItem("auth-reload-pending")) {
                            logger.warn('AUTH', 'Reload state timeout, clearing and continuing')
                            localStorage.removeItem("auth-reload-pending")
                            setGlobalLoading(false)
                        }
                    }, 5000)

                    // Keep loading state while waiting for reload
                    setGlobalUser(null)
                    setGlobalLoading(true)
                    return
                }

                logger.debug('AUTH', 'Getting initial session')

                // TEMPORARY: Skip session check only in production due to hanging issue
                const isProduction = process.env.NODE_ENV === 'production'
                if (isProduction) {
                    logger.info('AUTH', 'Bypassing session check due to production hanging issue')

                    // Check if we have stored tokens from a successful login
                    const hasStoredToken = localStorage.getItem("sb-access-token")
                    const loginComplete = localStorage.getItem("telegram-login-complete")

                    if (hasStoredToken && loginComplete) {
                        logger.info('AUTH', 'Found stored tokens, loading user profile')
                        try {
                            const profile = await getCurrentUser()
                            if (profile) {
                                logger.info('AUTH', 'Successfully loaded profile from stored tokens')
                                setGlobalUser(profile)
                                setGlobalLoading(false)
                                return
                            }
                        } catch (profileError) {
                            logger.error('AUTH', 'Error loading profile from stored tokens', profileError)
                        }
                    }

                    logger.debug('AUTH', 'Starting with clean auth state')
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
                        logger.debug('AUTH', 'Quick session check failed, checking stored tokens')

                        // Immediate fallback: Check if we have valid stored tokens
                        const storedToken = localStorage.getItem("sb-access-token")
                        if (storedToken) {
                            try {
                                const payload = JSON.parse(atob(storedToken.split('.')[1]))
                                const now = Math.floor(Date.now() / 1000)

                                if (payload.exp && payload.exp > now) {
                                    logger.info('AUTH', 'Using valid stored token in development')
                                    const profile = await getCurrentUser()
                                    if (profile) {
                                        setGlobalUser(profile)
                                        setGlobalLoading(false)
                                        return { success: true }
                                    }
                                }
                            } catch (tokenError) {
                                logger.error('AUTH', 'Stored token validation failed', tokenError)
                            }
                        }

                        throw quickError
                    }
                }

                logger.debug('AUTH', 'Starting smart session check')
                let sessionResult
                try {
                    const result = await getSessionWithQuickFallback()
                    if (result && 'success' in result) {
                        return // Already handled by stored token path
                    }
                    sessionResult = result
                } catch (timeoutError) {
                    logger.debug('AUTH', 'Session check timed out, proceeding with no session')
                    setGlobalUser(null)
                    setGlobalLoading(false)
                    return
                }

                const { data: { session } } = sessionResult

                if (session?.user) {
                    logger.info('AUTH', 'Found existing session for user', { userId: session.user.id })
                    const profile = await getCurrentUser()
                    logger.debug('AUTH', "useSimpleAuth: Got profile", {
                        profile: profile ? `${profile.first_name} ${profile.last_name} (@${profile.username})` : 'null'
                    })
                    setGlobalUser(profile)
                } else {
                    logger.debug('AUTH', 'No existing session')
                    setGlobalUser(null)
                }
            } catch (error) {
                logger.error('AUTH', 'Error getting session', error)
                setGlobalUser(null)
            } finally {
                logger.debug('AUTH', 'Setting loading to false')
                setGlobalLoading(false)
            }
        })()

        // Wait for initialization to complete
        initializationPromise.finally(() => {
            initializationPromise = null
        })

        // Failsafe: Ensure loading is set to false after maximum timeout
        const failsafeTimeout = setTimeout(() => {
            if (globalLoading) {
                logger.warn('AUTH', 'Failsafe timeout - forcing loading to false')
                setGlobalLoading(false)
            }
        }, 10000) // 10 second maximum

        // Listen for auth changes (only once globally)
        if (!authSubscription) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event, session) => {
                    logger.info('AUTH', 'Auth event', { event })

                    if (event === 'SIGNED_OUT') {
                        logger.info('AUTH', 'User signed out')
                        resetAuth()
                    } else if (event === 'SIGNED_IN' && session?.user) {
                        logger.info('AUTH', 'User signed in', {
                            userId: session.user.id,
                            email: session.user.email
                        })
                        try {
                            // Clear any pending reload state since we successfully signed in
                            if (typeof window !== 'undefined') {
                                localStorage.removeItem("auth-reload-pending")
                            }

                            const profile = await getCurrentUser()
                            logger.debug('AUTH', "useSimpleAuth: Got profile after sign in", {
                                profile: profile ? `${profile.first_name} ${profile.last_name} (@${profile.username})` : 'null'
                            })
                            setGlobalUser(profile)

                            // Note: Don't reload here - auth.ts already handles the reload
                            // This prevents double-reloading which causes auth loops
                        } catch (error) {
                            logger.error('AUTH', 'Error getting profile', error)
                            setGlobalUser(null)
                        } finally {
                            // Ensure loading is set to false after SIGNED_IN event
                            logger.debug('AUTH', 'SIGNED_IN complete, setting loading to false')
                            setGlobalLoading(false)
                        }
                    } else if (event === 'TOKEN_REFRESHED') {
                        // Don't change loading state for token refresh
                        logger.debug('AUTH', 'Token refreshed')
                    } else {
                        // For any other event, ensure loading is false
                        logger.debug('AUTH', `Other auth event (${event}), ensuring loading is false`)
                        setGlobalLoading(false)
                    }
                }
            )
            authSubscription = subscription
        }

        // Listen for manual signout events (since we bypass supabase.auth.signOut)
        const handleManualSignout = () => {
            logger.info('AUTH', 'Manual signout event detected')
            resetAuth()
        }
        window.addEventListener('manual-signout', handleManualSignout)

        return () => {
            // Clear failsafe timeout
            clearTimeout(failsafeTimeout)
            // Remove manual signout listener
            window.removeEventListener('manual-signout', handleManualSignout)
            
            // Clean up subscription when last component unmounts
            if (subscribers.length <= 1 && authSubscription) {
                logger.debug('AUTH', 'Last subscriber unmounting, cleaning up auth subscription')
                authSubscription.unsubscribe()
                authSubscription = null
                isAuthInitialized = false
                
                // Run all cleanup callbacks
                cleanupCallbacks.forEach(cleanup => {
                    try {
                        cleanup()
                    } catch (error) {
                        logger.warn('AUTH', 'Error during cleanup', error)
                    }
                })
                cleanupCallbacks = []
            }
        }
    }, [])


    const logout = async () => {
        logger.info('AUTH', 'Starting logout process')
        try {
            // Set a flag to prevent page visibility from interfering
            localStorage.setItem('logout-in-progress', 'true')
            logger.debug('AUTH', 'Set logout flag')

            logger.debug('AUTH', 'Calling signOut()')
            await signOut()
            logger.debug('AUTH', 'signOut() completed')

            logger.debug('AUTH', 'Calling resetAuth()')
            resetAuth()
            logger.debug('AUTH', 'resetAuth() completed')

            // Force reload to ensure all state is cleared and UI updates
            if (typeof window !== 'undefined') {
                logger.debug('AUTH', 'Triggering page reload')
                window.location.reload()
            }
        } catch (error) {
            // Clear the flag if logout fails
            localStorage.removeItem('logout-in-progress')
            logger.error('AUTH', 'Logout failed', error)
            throw error
        }
    }

    return {
        user,
        loading,
        logout
    }
}
