"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { StartupCard } from "@/components/startup-card"
import { CollapsibleStartupForm } from "@/components/collapsible-startup-form"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { getStartupsDirect, createStartupDirect } from "@/lib/api-direct"
import { getCurrentUserToken } from "@/lib/auth"
import { logger } from "@/lib/logger"
import type { Startup } from "@/lib/types"

interface StartupFormData {
  name: string
  description: string
  website_url: string
  industry: string
  stage: "idea" | "planning" | "building" | "mvp" | "beta" | "launched" | "scaling" | "acquired" | "paused"
  logo_url: string
  location: string
  founded_date: string
}

export default function StartupsPage() {
  const { user } = useSimpleAuth()
  const router = useRouter()
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingStartup, setIsCreatingStartup] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  useEffect(() => {
    loadStartups()
  }, [])

  const loadStartups = async () => {
    try {
      logger.debug('UI', 'Starting to load startups')
      setLoading(true)
      setError(null)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
      )
      
      const startupsPromise = getStartupsDirect()
      
      const startupsData = await Promise.race([startupsPromise, timeoutPromise]) as Startup[]
      logger.debug('UI', 'Loaded startups', { count: startupsData.length })
      setStartups(startupsData)
    } catch (err) {
      logger.error('UI', 'Error loading startups', err)
      setError(`Failed to load startups: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      logger.debug('UI', 'Finished loading startups')
      setLoading(false)
    }
  }

  const handleCreateStartup = async (data: StartupFormData): Promise<boolean> => {
    if (!user) return false

    try {
      setIsCreatingStartup(true)
      setError(null)
      
      const token = await getCurrentUserToken()
      const startup = await createStartupDirect({
        ...data,
        userId: user.id
      }, token || undefined)

      setStartups(prev => [startup, ...prev])
      return true // Return success
    } catch (err) {
      logger.error('UI', 'Error creating startup', err)
      
      // The API now handles all error categorization, so just pass through the message
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      return false
    } finally {
      setIsCreatingStartup(false)
    }
  }

  const handleStartupClick = (startup: Startup) => {
    router.push(`/startups/${startup.slug}`)
  }


  if (loading && startups.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading startups...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Startups
              {loading && (
                <Loader2 className="inline-block ml-2 h-5 w-5 animate-spin" />
              )}
            </h1>
            <p className="text-muted-foreground">
              Discover amazing startups and share your own
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <CollapsibleStartupForm
            user={user}
            onSubmit={handleCreateStartup}
            isSubmitting={isCreatingStartup}
            onLoginRequired={() => setShowLoginDialog(true)}
          />

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <p className="text-muted-foreground">
                No startups yet. Be the first to share yours!
              </p>
            </div>
          )}

          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
          />

        </div>
      </main>
    </div>
  )
}
