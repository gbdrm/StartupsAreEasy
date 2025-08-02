import { useState, useEffect } from "react"
import { signInWithTelegram, getCurrentUserProfile, signOut } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"
import { logger } from "@/lib/logger"

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        logger.log(`[${new Date().toISOString()}] useAuth: Starting auth initialization`)

        // Listen for auth changes (this will also fire initially with current session)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                logger.log(`[${new Date().toISOString()}] useAuth: Auth state changed - event:`, event, 'session:', session ? 'exists' : 'null')

                if (session?.user) {
                    try {
                        // Only fetch profile for actual sign-in events, not tab recovery
                        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                            logger.log(`[${new Date().toISOString()}] useAuth: Fetching user profile for event:`, event)

                            const user = await getCurrentUserProfile()

                            logger.log(`[${new Date().toISOString()}] useAuth: Got user profile:`, user ? `${user.name} (${user.id})` : 'null')
                            setCurrentUser(user)
                        } else {
                            logger.log(`[${new Date().toISOString()}] useAuth: Skipping profile fetch for event:`, event)
                        }
                    } catch (error) {
                        logger.error(`[${new Date().toISOString()}] useAuth: Error fetching user profile:`, error)
                        setCurrentUser(null)
                    }
                } else {
                    logger.log(`[${new Date().toISOString()}] useAuth: No session, clearing user`)
                    setCurrentUser(null)
                }

                // Always ensure loading is false after auth state changes
                setLoading(false)
                logger.log(`[${new Date().toISOString()}] useAuth: Auth loading completed`)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const handleLogin = async (telegramUser: TelegramUser) => {
        try {
            const user = await signInWithTelegram(telegramUser)
            setCurrentUser(user)
        } catch (err) {
            // Handle error if needed
            logger.error("Login failed:", err)
        }
    }

    const handleLogout = async () => {
        try {
            await signOut()
            setCurrentUser(null)
        } catch (err) {
            // Handle error if needed
            logger.error("Logout failed:", err)
        }
    }

    return {
        user: currentUser,
        loading,
        login: handleLogin,
        logout: handleLogout
    }
}
