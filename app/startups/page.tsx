"use client"

import { AuthButton } from "@/components/auth-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import { signInWithTelegram, getCurrentUserProfile, signOut } from "@/lib/auth"
import type { User } from "@/lib/types"
import type { TelegramUser } from "@/lib/auth"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

interface Startup {
  id: string
  name: string
  slug: string
  description?: string
  website_url?: string
  logo_url?: string
  industry?: string
  stage?: string
  founded_date?: string
  location?: string
  team_size?: number
  funding_raised?: number
}

export default function StartupsPage() {
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: "", description: "", website_url: "" })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // Check for missing API keys
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError("Supabase API keys are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.")
      setLoading(false)
      return
    }
    const fetchStartups = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("startups")
        .select("id, name, slug, description, website_url, logo_url, industry, stage, founded_date, location, team_size, funding_raised")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
      if (error) {
        setError(error.message || "Failed to load startups")
        setLoading(false)
        return
      }
      setStartups(data || [])
      setLoading(false)
    }
    fetchStartups()
  }, [])

  useEffect(() => {
    async function fetchUser() {
      const profile = await getCurrentUserProfile()
      if (profile) {
        setCurrentUser({
          id: profile.id,
          name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
          username: profile.username ?? "",
          avatar: profile.avatar_url ?? "",
          first_name: profile.first_name,
          last_name: profile.last_name,
        })
      } else {
        setCurrentUser(null)
      }
    }
    fetchUser()
  }, [])

  const handleLogin = async (telegramUser: TelegramUser) => {
    try {
      setError(null)
      const user = await signInWithTelegram(telegramUser)
      setCurrentUser(user)
    } catch (err) {
      setError(`Failed to log in: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setCurrentUser(null)
    } catch (err) {
      // Optionally handle error
    }
  }

  const handleCreateStartup = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const { data, error } = await supabase.from("startups").insert({
        name: formData.name,
        description: formData.description,
        website_url: formData.website_url,
        is_public: true,
      }).select().single()
      if (error) throw error
      setStartups([data, ...startups])
      setShowForm(false)
      setFormData({ name: "", description: "", website_url: "" })
    } catch (err: any) {
      setError(err.message || "Failed to create startup")
    } finally {
      setCreating(false)
    }
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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 ml-4">
            <h1 className="text-xl font-bold">Startups Are Easy</h1>
            <span className="text-2xl">🚀</span>
            <Link href="/startups" className="text-blue-600 hover:underline text-sm">Startups</Link>
          </div>
          <AuthButton user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />
        </div>
      </header>
      <main className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Discover Startups</h1>
        {currentUser && (
          <div className="flex justify-center mb-8">
            <button
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg shadow hover:bg-primary/80 transition"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancel" : "Create Startup"}
            </button>
          </div>
        )}
        {showForm && currentUser && (
          <form onSubmit={handleCreateStartup} className="mb-8 p-6 border rounded-xl bg-white/90 dark:bg-muted flex flex-col gap-4 shadow-lg max-w-lg mx-auto">
            <input
              type="text"
              placeholder="Startup Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              className="border rounded px-3 py-2 text-lg"
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="border rounded px-3 py-2 text-base"
            />
            <input
              type="url"
              placeholder="Website URL"
              value={formData.website_url}
              onChange={e => setFormData({ ...formData, website_url: e.target.value })}
              className="border rounded px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={creating || !formData.name.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-base font-semibold"
            >
              {creating ? "Creating..." : "Add Startup"}
            </button>
          </form>
        )}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-8 md:grid-cols-2">
          {startups.map((startup) => (
            <div key={startup.id} className="flex flex-col gap-3 border rounded-xl p-6 bg-white/90 dark:bg-muted shadow-lg">
              <div className="flex items-center gap-4">
                {startup.logo_url && (
                  <img src={startup.logo_url} alt={startup.name} className="w-16 h-16 object-contain rounded" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{startup.name}</h2>
                    {startup.website_url && (
                      <a href={startup.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Website</a>
                    )}
                  </div>
                  {startup.description && <p className="text-muted-foreground text-base mt-1">{startup.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                {startup.industry && <span className="bg-muted px-2 py-1 rounded">Industry: {startup.industry}</span>}
                {startup.stage && <span className="bg-muted px-2 py-1 rounded">Stage: {startup.stage}</span>}
                {startup.location && <span className="bg-muted px-2 py-1 rounded">Location: {startup.location}</span>}
                {startup.team_size && <span className="bg-muted px-2 py-1 rounded">Team: {startup.team_size}</span>}
                {startup.funding_raised && <span className="bg-muted px-2 py-1 rounded">Funding: ${startup.funding_raised.toLocaleString()}</span>}
              </div>
            </div>
          ))}
          {!loading && startups.length === 0 && !error && (
            <div className="text-center text-muted-foreground py-12 col-span-2">No startups found.</div>
          )}
        </div>
      </main>
    </div>
  )
}
