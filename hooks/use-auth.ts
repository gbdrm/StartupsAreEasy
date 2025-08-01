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

        // Get initial user with timeout protection
        async function fetchUser() {
            const startTime = Date.now()
            console.log(`[${new Date().toISOString()}] useAuth: Fetching current user profile`)

            try {
                // Add timeout protection - if getCurrentUserProfile takes longer than 5 seconds, bail out
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth timeout after 5 seconds')), 5000)
                )

                const user = await Promise.race([
                    getCurrentUserProfile(),
                    timeoutPromise
                ]) as User | null

                const endTime = Date.now()
                console.log(`[${new Date().toISOString()}] useAuth: Got user profile in ${endTime - startTime}ms:`, user ? `${user.name} (${user.id})` : 'null')
                setCurrentUser(user)
            } catch (error) {
                console.error(`[${new Date().toISOString()}] useAuth: Error fetching user:`, error)
                setCurrentUser(null)

                // If it's a timeout, we still want to continue without auth
                if (error instanceof Error && error.message.includes('timeout')) {
                    console.log(`[${new Date().toISOString()}] useAuth: Continuing without authentication due to timeout`)
                }
            } finally {
                setLoading(false)
                console.log(`[${new Date().toISOString()}] useAuth: Auth loading completed`)
            }
        }
        fetchUser()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log(`[${new Date().toISOString()}] useAuth: Auth state changed - event:`, event, 'session:', session ? 'exists' : 'null')

                if (session?.user) {
                    try {
                        const user = await getCurrentUserProfile()
                        console.log(`[${new Date().toISOString()}] useAuth: Updated user profile:`, user ? `${user.name} (${user.id})` : 'null')
                        setCurrentUser(user)
                    } catch (error) {
                        console.error(`[${new Date().toISOString()}] useAuth: Error updating user profile:`, error)
                        setCurrentUser(null)
                    }
                } else {
                    console.log(`[${new Date().toISOString()}] useAuth: No session, clearing user`)
                    setCurrentUser(null)
                }
                setLoading(false)
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
