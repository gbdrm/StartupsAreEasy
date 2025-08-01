"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { BuilderCard } from "@/components/builder-card"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getBuilders } from "@/lib/builders"
import { useRouter } from "next/navigation"
import type { User } from "@/lib/types"

export default function BuildersPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout, loading: authLoading } = useAuth()
  const [builders, setBuilders] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const router = useRouter()

  // Diagnostics - log all loading states
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] Builders page loading states:`, {
      authLoading,
      buildersLoading: loading,
      currentUser: currentUser ? `${currentUser.name} (${currentUser.id})` : 'null',
      buildersCount: builders.length,
    })
  }, [authLoading, loading, currentUser, builders.length])

  // Emergency fallback: if loading states are stuck for more than 15 seconds, force clear them
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      if (authLoading || loading) {
        console.error(`[${new Date().toISOString()}] EMERGENCY: Builders page loading states stuck for 15+ seconds, forcing clear`)
        setLoading(false)
        if (builders.length === 0) {
          setError("Loading timed out. Please refresh the page.")
        }
      }
    }, 15000) // 15 seconds

    return () => clearTimeout(emergencyTimeout)
  }, [authLoading, loading, builders.length])

  // Load builders
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Builders page effect triggered: loadBuilders()`)
    loadBuilders()
  }, [])

  const loadBuilders = async () => {
    const startTime = Date.now()
    console.log(`[${new Date().toISOString()}] Starting loadBuilders()`)
    
    try {
      setLoading(true)
      setError(null)
      
      console.log(`[${new Date().toISOString()}] Calling getBuilders()`)
      
      // Add timeout protection - if getBuilders takes longer than 10 seconds, bail out
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Builders loading timeout after 10 seconds')), 10000)
      )
      
      const buildersData = await Promise.race([
        getBuilders(),
        timeoutPromise
      ]) as User[]
      
      console.log(`[${new Date().toISOString()}] getBuilders() returned ${buildersData.length} builders`)
      setBuilders(buildersData)
      
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error loading builders:`, err)
      
      if (err instanceof Error && err.message.includes('timeout')) {
        setError("Loading is taking longer than expected. Please check your connection and try again.")
      } else {
        setError("Failed to load builders. Please try again.")
      }
    } finally {
      const endTime = Date.now()
      console.log(`[${new Date().toISOString()}] loadBuilders() completed in ${endTime - startTime}ms`)
      setLoading(false)
    }
  }

  const handleBuilderClick = (builder: User) => {
    // Navigate to the builder's profile
    router.push(`/profile/${builder.username}`)
  }

  // Show loading spinner only if both auth is loading AND we don't have any builders yet
  // This prevents the spinner from showing too long when auth takes time
  const showLoadingSpinner = (authLoading && !currentUser) || (loading && builders.length === 0)

  // Add diagnostic info in development
  const isDev = process.env.NODE_ENV === 'development'

  if (showLoadingSpinner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          {isDev && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <div>Auth loading: {authLoading ? 'true' : 'false'}</div>
              <div>Builders loading: {loading ? 'true' : 'false'}</div>
              <div>Current user: {currentUser ? currentUser.name : 'null'}</div>
              <div>Builders count: {builders.length}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">🧑‍💻 Builders</h1>
            <p className="text-muted-foreground">
              Connect with talented builders and entrepreneurs in the community
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Auth Dialog */}
          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
            onLogin={handleLogin}
          />

          <Separator />

          {/* Builders Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {builders.map((builder) => (
              <BuilderCard
                key={builder.id}
                builder={builder}
                onClick={() => handleBuilderClick(builder)}
              />
            ))}
          </div>

          {builders.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No builders found. Be the first to join our community!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
