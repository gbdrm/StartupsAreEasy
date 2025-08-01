import { useState, useEffect } from "react"
import { signInWithTelegram, getCurrentUserProfile, signOut } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        console.log(`[${new Date().toISOString()}] useAuth: Starting auth initialization`)

        // Listen for auth changes (this will also fire initially with current session)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log(`[${new Date().toISOString()}] useAuth: Auth state changed - event:`, event, 'session:', session ? 'exists' : 'null')

                if (session?.user) {
                    try {
                        // Only fetch profile if we don't already have user data or if it's a sign-in event
                        if (!currentUser || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                            console.log(`[${new Date().toISOString()}] useAuth: Fetching user profile for event:`, event)

                            // Add timeout protection
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Auth timeout after 2 seconds')), 2000)
                            )

                            const user = await Promise.race([
                                getCurrentUserProfile(),
                                timeoutPromise
                            ]) as User | null

                            console.log(`[${new Date().toISOString()}] useAuth: Got user profile:`, user ? `${user.name} (${user.id})` : 'null')
                            setCurrentUser(user)
                        } else {
                            console.log(`[${new Date().toISOString()}] useAuth: Skipping profile fetch, already have user data`)
                        }
                    } catch (error) {
                        console.error(`[${new Date().toISOString()}] useAuth: Error fetching user profile:`, error)
                        setCurrentUser(null)
                    }
                } else {
                    console.log(`[${new Date().toISOString()}] useAuth: No session, clearing user`)
                    setCurrentUser(null)
                }

                // Always ensure loading is false after auth state changes
                setLoading(false)
                console.log(`[${new Date().toISOString()}] useAuth: Auth loading completed`)
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
            console.error("Login failed:", err)
        }
    }

    const handleLogout = async () => {
        try {
            await signOut()
            setCurrentUser(null)
        } catch (err) {
            // Handle error if needed
            console.error("Logout failed:", err)
        }
    }

    return {
        user: currentUser,
        loading,
        login: handleLogin,
        logout: handleLogout
    }
}
