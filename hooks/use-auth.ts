import { useState, useEffect } from "react"
import { signInWithTelegram, getCurrentUserProfile, signOut } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial user
        async function fetchUser() {
            const user = await getCurrentUserProfile()
            setCurrentUser(user)
            setLoading(false)
        }
        fetchUser()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    const user = await getCurrentUserProfile()
                    setCurrentUser(user)
                } else {
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
