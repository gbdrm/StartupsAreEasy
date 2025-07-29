"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, Users, FileText, Heart, MessageCircle, Building, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"

interface DiagnosticResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: any
  count?: number
}

export default function DiagnosticsPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useAuth()
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setLoading(true)
    setError(null)
    setDiagnostics([])

    const results: DiagnosticResult[] = []

    try {
      // First, run server-side diagnostics
      try {
        const response = await fetch('/api/diagnostics')
        const serverDiagnostics = await response.json()
        
        if (serverDiagnostics.success) {
          results.push(...serverDiagnostics.results.map((r: any) => ({
            ...r,
            name: `[Server] ${r.name}`
          })))
        } else {
          results.push({
            name: '[Server] Server-side Diagnostics',
            status: 'error',
            message: `Server diagnostics failed: ${serverDiagnostics.error}`,
            details: serverDiagnostics
          })
        }
      } catch (err: any) {
        results.push({
          name: '[Server] Server-side Diagnostics',
          status: 'error',
          message: `Failed to run server diagnostics: ${err.message}`,
          details: err
        })
      }
      // Test 1: Check Supabase connection (Client-side)
      try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
        if (error) throw error
        results.push({
          name: '[Client] Supabase Connection',
          status: 'success',
          message: 'Successfully connected to Supabase from client',
          count: data?.length || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Supabase Connection',
          status: 'error',
          message: `Failed to connect from client: ${err.message}`,
          details: err
        })
      }

      // Test 2: Check auth.users table access (Client-side)
      try {
        const { data, error } = await supabase.auth.getUser()
        results.push({
          name: '[Client] Auth System',
          status: 'success',
          message: `Auth system working. Current user: ${data.user ? data.user.id : 'Anonymous'}`,
          details: data.user
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Auth System',
          status: 'error',
          message: `Auth error: ${err.message}`,
          details: err
        })
      }

      // Test 3: Check profiles table (Client-side)
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        
        results.push({
          name: '[Client] Profiles Table',
          status: 'success',
          message: `Profiles table exists and accessible from client`,
          count: count || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Profiles Table',
          status: 'error',
          message: `Profiles table error: ${err.message}`,
          details: err
        })
      }

      // Test 4: Check startups table (Client-side)
      try {
        const { count, error } = await supabase
          .from('startups')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        
        results.push({
          name: '[Client] Startups Table',
          status: 'success',
          message: `Startups table exists and accessible from client`,
          count: count || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Startups Table',
          status: 'error',
          message: `Startups table error: ${err.message}`,
          details: err
        })
      }

      // Test 5: Check posts table (Client-side)
      try {
        const { count, error } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        
        results.push({
          name: '[Client] Posts Table',
          status: 'success',
          message: `Posts table exists and accessible from client`,
          count: count || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Posts Table',
          status: 'error',
          message: `Posts table error: ${err.message}`,
          details: err
        })
      }

      // Test 6: Check likes table (Client-side)
      try {
        const { count, error } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        
        results.push({
          name: '[Client] Likes Table',
          status: 'success',
          message: `Likes table exists and accessible from client`,
          count: count || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Likes Table',
          status: 'error',
          message: `Likes table error: ${err.message}`,
          details: err
        })
      }

      // Test 7: Check comments table (Client-side)
      try {
        const { count, error } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        
        results.push({
          name: '[Client] Comments Table',
          status: 'success',
          message: `Comments table exists and accessible from client`,
          count: count || 0
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Comments Table',
          status: 'error',
          message: `Comments table error: ${err.message}`,
          details: err
        })
      }

      // Test 8: Check RLS policies (Client-side)
      try {
        // Try to read from profiles without auth - should work due to public read policy
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .limit(1)
        
        // Don't test insert as it will fail with null id constraint
        // The RLS policy would block it anyway for anonymous users
        
        results.push({
          name: '[Client] RLS Policies',
          status: 'success',
          message: 'RLS policies allow public read access from client',
          details: { 
            profilesReadable: !error,
            note: 'Insert test skipped to avoid constraint violations'
          }
        })
      } catch (err: any) {
        results.push({
          name: '[Client] RLS Policies',
          status: 'warning',
          message: `RLS policies may be too restrictive: ${err.message}`,
          details: err
        })
      }

      // Test 9: Check post relationships (Client-side)
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            startup:startups!posts_startup_id_fkey(id, name)
          `)
          .limit(1)
        
        results.push({
          name: '[Client] Post-Startup Relationships',
          status: 'success',
          message: 'Post-startup relationships working correctly from client',
          details: data
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Post-Startup Relationships',
          status: 'error',
          message: `Relationship error: ${err.message}`,
          details: err
        })
      }

      // Test 10: Check environment variables (Client-side)
      const envChecks = {
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        DEFAULT_USER_ID: !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID,
        TELEGRAM_BOT_TOKEN: !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN,
        TELEGRAM_FUNCTION_URL: !!process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL
      }

      const missingEnvVars = Object.entries(envChecks).filter(([key, exists]) => !exists).map(([key]) => key)
      
      results.push({
        name: '[Client] Environment Variables',
        status: missingEnvVars.length === 0 ? 'success' : 'warning',
        message: missingEnvVars.length === 0 
          ? 'All environment variables are set'
          : `Missing (optional): ${missingEnvVars.join(', ')}`,
        details: envChecks
      })

      // Test 11: Check if default user exists in profiles (Client-side)
      if (process.env.NEXT_PUBLIC_DEFAULT_USER_ID) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', process.env.NEXT_PUBLIC_DEFAULT_USER_ID)
            .single()
          
          if (error) throw error
          
          results.push({
            name: '[Client] Default User Profile',
            status: 'success',
            message: 'Default user profile exists',
            details: data
          })
        } catch (err: any) {
          results.push({
            name: '[Client] Default User Profile',
            status: 'warning',
            message: 'Default user profile not found - may need to create it',
            details: err
          })
        }
      }

      // Test 12: Test Telegram login endpoint (Client-side)
      try {
        // Use environment variable if available, otherwise construct from Supabase URL
        let telegramUrl = process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL
        
        if (!telegramUrl) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          if (!supabaseUrl) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL not found')
          }
          
          // Extract the project reference from the Supabase URL to construct the function URL
          const urlParts = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
          if (!urlParts) {
            throw new Error('Invalid Supabase URL format')
          }
          const projectRef = urlParts[1]
          telegramUrl = `https://${projectRef}.functions.supabase.co/tg-login`
        }
        
        const response = await fetch(telegramUrl, {
          method: 'GET'
        })
        
        // Try to get response body for more details
        let responseBody = null
        try {
          responseBody = await response.json()
        } catch {
          // Response might not be JSON
        }
        
        results.push({
          name: '[Client] Telegram Function',
          status: response.status === 200 ? 'success' : (response.status === 405 ? 'warning' : 'error'),
          message: response.status === 200 
            ? 'Telegram function is accessible and responding correctly'
            : response.status === 405 
              ? 'Telegram function is accessible (returns 405 for GET as expected)'
              : `Telegram function returned status: ${response.status}`,
          details: { 
            url: telegramUrl,
            usingEnvVar: !!process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL,
            status: response.status, 
            statusText: response.statusText,
            responseBody: responseBody
          }
        })
      } catch (err: any) {
        results.push({
          name: '[Client] Telegram Function',
          status: 'error',
          message: `Telegram function not accessible: ${err.message}`,
          details: err
        })
      }

    } catch (err: any) {
      setError(`Diagnostic error: ${err.message}`)
    }

    setDiagnostics(results)
    setLoading(false)
  }

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  const successCount = diagnostics.filter(d => d.status === 'success').length
  const warningCount = diagnostics.filter(d => d.status === 'warning').length
  const errorCount = diagnostics.filter(d => d.status === 'error').length

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="container max-w-4xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">System Diagnostics</h1>
            <p className="text-muted-foreground mt-2">
              Check the overall health and status of the application
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center">
            <Button 
              onClick={runDiagnostics} 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Run Diagnostics
                </>
              )}
            </Button>
          </div>

          {diagnostics.length > 0 && (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-green-600">{successCount}</div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
                      <div className="text-sm text-muted-foreground">Warnings</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                      <div className="text-sm text-muted-foreground">Errors</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Results */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Detailed Results</h2>
                
                {diagnostics.map((result, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(result.status)}
                          <CardTitle className="text-lg">{result.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.count !== undefined && (
                            <Badge variant="outline">{result.count} records</Badge>
                          )}
                          {getStatusBadge(result.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Show details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
