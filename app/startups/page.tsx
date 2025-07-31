"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { StartupCard } from "@/components/startup-card"
import { StartupDetailDialog } from "@/components/startup-detail-dialog"
import { CollapsibleStartupForm } from "@/components/collapsible-startup-form"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { getStartups, createStartup } from "@/lib/startups"
import type { Startup } from "@/lib/types"

interface StartupFormData {
  name: string
  description: string
  website_url: string
  industry: string
  stage: "idea" | "planning" | "building" | "mvp" | "beta" | "launched" | "scaling" | "acquired" | "paused"
  logo_url: string
}

export default function StartupsPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useAuth()
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingStartup, setIsCreatingStartup] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  useEffect(() => {
    loadStartups()
  }, [])

  const loadStartups = async () => {
    try {
      setLoading(true)
      setError(null)
      const startupsData = await getStartups()
      setStartups(startupsData)
    } catch (err) {
      console.error("Error loading startups:", err)
      setError("Failed to load startups. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStartup = async (data: StartupFormData) => {
    if (!currentUser) return

    try {
      setIsCreatingStartup(true)
      setError(null)
      
      const startup = await createStartup({
        userId: currentUser.id,
        name: data.name,
        description: data.description || undefined,
        website_url: data.website_url || undefined,
        logo_url: data.logo_url || undefined,
        industry: data.industry || undefined,
        stage: data.stage,
        is_public: true,
      })

      // Add the new startup to the top of the list
      setStartups(prevStartups => [startup, ...prevStartups])
    } catch (err) {
      console.error("Error creating startup:", err)
      setError("Failed to create startup. Please try again.")
    } finally {
      setIsCreatingStartup(false)
    }
  }

  const handleStartupClick = (startup: Startup) => {
    setSelectedStartup(startup)
    setShowDetailDialog(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
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
            <h1 className="text-3xl font-bold">Startups</h1>
            <p className="text-muted-foreground">
              Discover innovative startups and share your own
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Collapsible Startup Form - Always visible */}
          <CollapsibleStartupForm
            user={currentUser}
            onSubmit={handleCreateStartup}
            isSubmitting={isCreatingStartup}
            onLoginRequired={() => setShowLoginDialog(true)}
          />

          {/* Auth Dialog */}
          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
            onLogin={handleLogin}
          />

          {/* Startup Detail Dialog */}
          <StartupDetailDialog
            startup={selectedStartup}
            open={showDetailDialog}
            onOpenChange={setShowDetailDialog}
          />

          <Separator />

          {/* Startups Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {startups.map((startup) => (
              <StartupCard
                key={startup.id}
                startup={startup}
                onClick={() => handleStartupClick(startup)}
              />
            ))}
          </div>

          {startups.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No startups yet. Be the first to share yours!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
