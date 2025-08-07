"use client"

import { createContext, useContext } from "react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { logger } from "@/lib/logger"
import type { User } from "@/lib/types"
interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useSimpleAuth()
  
  // Debug logging - only shows in development
  logger.debug('AUTH', 'AuthProvider: auth state', auth)
  
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
