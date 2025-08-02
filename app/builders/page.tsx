"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { BuilderCard } from "@/components/builder-card"
import { AuthDialog } from "@/components/auth-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { getBuildersDirect } from "@/lib/api-direct"  
import { useRouter } from "next/navigation"
import type { User } from "@/lib/types"

export default function BuildersPage() {
  const { user, login, logout } = useSimpleAuth()
  const [builders, setBuilders] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadBuilders()
  }, [])

  const loadBuilders = async () => {
    try {
      setLoading(true)
      setError(null)
      const buildersData = await getBuildersDirect()
      setBuilders(buildersData)
    } catch (err) {
      console.error("Error loading builders:", err)
      setError("Failed to load builders. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleBuilderClick = (builder: User) => {
    router.push(`/profile/${builder.username}`)
  }

  if (loading && builders.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading builders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogin={login} onLogout={logout} />

      <main className="container max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Builders</h1>
            <p className="text-muted-foreground">
              Meet the amazing people building the future
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <p className="text-muted-foreground">No builders found.</p>
            </div>
          )}

          <AuthDialog
            open={showLoginDialog}
            onOpenChange={setShowLoginDialog}
            onLogin={login}
          />
        </div>
      </main>
    </div>
  )
}
