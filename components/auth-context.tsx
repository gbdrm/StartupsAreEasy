"use client"

import { createContext, useContext } from "react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (telegramUser: TelegramUser) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useSimpleAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
