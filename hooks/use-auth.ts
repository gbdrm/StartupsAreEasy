import { useState, useEffect } from "react"
import { signInWithTelegram, getCurrentUserProfile, signOut } from "@/lib/auth"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)

    useEffect(() => {
        async function fetchUser() {
            const user = await getCurrentUserProfile()
            setCurrentUser(user)
        }
        fetchUser()
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
        login: handleLogin,
        logout: handleLogout
    }
}
