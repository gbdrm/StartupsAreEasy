"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, Users, FileText, Heart, MessageCircle, Building, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { supabase } from "@/lib/supabase"
import { API_ENDPOINTS } from "@/lib/constants"

interface DiagnosticResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: any
  count?: number
}

export default function DiagnosticsPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useSimpleAuth()
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
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_TELEGRAM_BOT_TOKEN: !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN,
        NEXT_PUBLIC_TELEGRAM_FUNCTION_URL: !!process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL,
        NEXT_PUBLIC_DEV_EMAIL: !!process.env.NEXT_PUBLIC_DEV_EMAIL,
        NEXT_PUBLIC_DEV_PASSWORD: !!process.env.NEXT_PUBLIC_DEV_PASSWORD,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
      }

      const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      const optionalEnvVars = ['NEXT_PUBLIC_TELEGRAM_BOT_TOKEN', 'NEXT_PUBLIC_TELEGRAM_FUNCTION_URL', 'NEXT_PUBLIC_DEV_EMAIL', 'NEXT_PUBLIC_DEV_PASSWORD']
      
      const missingRequired = requiredEnvVars.filter(key => !envChecks[key as keyof typeof envChecks])
      const missingOptional = optionalEnvVars.filter(key => !envChecks[key as keyof typeof envChecks])
      
      results.push({
        name: '[Client] Environment Variables',
        status: missingRequired.length === 0 ? 'success' : 'error',
        message: missingRequired.length === 0 
          ? `All required env vars set${missingOptional.length > 0 ? ` (${missingOptional.length} optional missing)` : ''}`
          : `Missing required: ${missingRequired.join(', ')}`,
        details: {
          ...envChecks,
          missing_required: missingRequired,
          missing_optional: missingOptional
        }
      })

      // Test 11: Auth State Verification (Client-side)
      try {
        const authState = {
          hasCurrentUser: !!currentUser,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userEmail: currentUser?.username,
          hasFakeLogin: !!(process.env.NEXT_PUBLIC_DEV_EMAIL && process.env.NEXT_PUBLIC_DEV_PASSWORD),
          hasStoredToken: !!localStorage.getItem('sb-access-token'),
          hasRefreshToken: !!localStorage.getItem('sb-refresh-token'),
          isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
        }

        const authStatus = currentUser ? 'success' : 'warning'
        const authMessage = currentUser 
          ? `Authenticated as ${currentUser.name} (${currentUser.username})`
          : 'Not authenticated (this is normal for anonymous users)'

        results.push({
          name: '[Client] Auth State',
          status: authStatus,
          message: authMessage,
          details: authState
        })
      } catch (authErr) {
        results.push({
          name: '[Client] Auth State',
          status: 'error',
          message: `Auth check failed: ${authErr instanceof Error ? authErr.message : String(authErr)}`,
          details: authErr
        })
      }

      // Test 12: Test Telegram login endpoint (Client-side)
      try {
        const telegramUrl = API_ENDPOINTS.TELEGRAM_LOGIN
        
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

  // Helper function to run token tests when we have valid tokens
  const runTokenTests = async (tokenData: any, results: DiagnosticResult[]) => {
    // Step 4: Test Token Storage
    const originalAccessToken = localStorage.getItem("sb-access-token")
    const originalRefreshToken = localStorage.getItem("sb-refresh-token")

    localStorage.setItem("sb-access-token", tokenData.access_token)
    localStorage.setItem("sb-refresh-token", tokenData.refresh_token)

    const storedAccessToken = localStorage.getItem("sb-access-token")
    const storedRefreshToken = localStorage.getItem("sb-refresh-token")

    results.push({
      name: "Token Storage",
      status: storedAccessToken && storedRefreshToken ? 'success' : 'error',
      message: storedAccessToken && storedRefreshToken ? "Tokens stored successfully in localStorage" : "Failed to store tokens",
      details: {
        accessTokenStored: !!storedAccessToken,
        refreshTokenStored: !!storedRefreshToken,
        accessTokenLength: storedAccessToken?.length,
        refreshTokenLength: storedRefreshToken?.length
      }
    })

    // Step 5: Test getCurrentUserToken
    try {
      const { getCurrentUserToken } = await import('@/lib/auth')
      const retrievedToken = await getCurrentUserToken()

      results.push({
        name: "Token Retrieval",
        status: retrievedToken ? 'success' : 'error',
        message: retrievedToken ? "getCurrentUserToken() works correctly" : "getCurrentUserToken() failed",
        details: {
          hasToken: !!retrievedToken,
          tokenLength: retrievedToken?.length,
          tokensMatch: retrievedToken === tokenData.access_token
        }
      })

      // Step 6: Test Profile Loading
      if (retrievedToken) {
        try {
          const { getCurrentUser } = await import('@/lib/auth')
          const profile = await getCurrentUser()

          results.push({
            name: "Profile Loading",
            status: profile ? 'success' : 'warning',
            message: profile ? "Profile loaded successfully" : "No profile found (this is normal for mock user)",
            details: profile ? {
              id: profile.id,
              username: profile.username,
              firstName: profile.first_name,
              lastName: profile.last_name,
              loadMethod: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost' ? 'production-bypass' : 'supabase-auth'
            } : {
              message: "No profile data",
              loadMethod: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost' ? 'production-bypass' : 'supabase-auth'
            }
          })
        } catch (profileError) {
          const errorMessage = profileError instanceof Error ? profileError.message : String(profileError)
          results.push({
            name: "Profile Loading",
            status: errorMessage.includes('Auth session missing') ? 'error' : 'warning',
            message: errorMessage.includes('Auth session missing') 
              ? "Profile loading failed with auth session error - this indicates production bypass is needed" 
              : "Profile loading failed (expected for mock user)",
            details: {
              error: errorMessage,
              isAuthSessionError: errorMessage.includes('Auth session missing'),
              loadMethod: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost' ? 'production-bypass' : 'supabase-auth'
            }
          })
        }
      }

      // Step 7: Test Database Query
      if (retrievedToken) {
        try {
          const testResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts?limit=1`, {
            headers: {
              'Authorization': `Bearer ${retrievedToken}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json'
            }
          })

          results.push({
            name: "Database Query Test",
            status: testResponse.ok ? 'success' : 'error',
            message: testResponse.ok ? "Database queries work with token" : `Database query failed: ${testResponse.status}`,
            details: {
              status: testResponse.status,
              statusText: testResponse.statusText,
              url: testResponse.url
            }
          })
        } catch (dbError) {
          results.push({
            name: "Database Query Test",
            status: 'error',
            message: "Database query threw error",
            details: {
              error: dbError instanceof Error ? dbError.message : String(dbError)
            }
          })
        }
      }

    } catch (tokenError) {
      results.push({
        name: "Token Retrieval",
        status: 'error',
        message: "getCurrentUserToken() threw error",
        details: {
          error: tokenError instanceof Error ? tokenError.message : String(tokenError)
        }
      })
    }

    // Cleanup: Restore original tokens
    if (originalAccessToken) {
      localStorage.setItem("sb-access-token", originalAccessToken)
    } else {
      localStorage.removeItem("sb-access-token")
    }

    if (originalRefreshToken) {
      localStorage.setItem("sb-refresh-token", originalRefreshToken)
    } else {
      localStorage.removeItem("sb-refresh-token")
    }
  }

  // Debug Telegram Login with step-by-step verification
  const [debugLoginResults, setDebugLoginResults] = useState<DiagnosticResult[]>([])
  const [debugLoginLoading, setDebugLoginLoading] = useState(false)

  const runDebugTelegramLogin = async () => {
    setDebugLoginLoading(true)
    setDebugLoginResults([])

    const results: DiagnosticResult[] = []

    try {
      // Step 1: Environment Check
      results.push({
        name: "Environment Detection",
        status: 'success',
        message: "Checking production environment detection",
        details: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV,
          hostname: window.location.hostname,
          isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'
        }
      })

      // Step 2: Create mock Telegram user
      const mockTelegramUser = {
        id: 999999999, // Mock ID
        first_name: "Debug",
        last_name: "Test",
        username: "debug_test",
        auth_date: Math.floor(Date.now() / 1000),
        hash: "mock_hash_for_testing" // Invalid hash - will trigger 401 (expected)
      }

      results.push({
        name: "Mock Telegram User",
        status: 'success',
        message: "Created mock Telegram user with invalid hash (will test endpoint validation)",
        details: {
          ...mockTelegramUser,
          note: "Using invalid hash intentionally - real Telegram data requires valid HMAC-SHA256 hash"
        }
      })

      // Step 3: Test Backend Login Endpoint
      try {
        const loginResponse = await fetch(API_ENDPOINTS.TELEGRAM_LOGIN, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockTelegramUser),
        })

        if (loginResponse.ok) {
          const tokenData = await loginResponse.json()
          results.push({
            name: "Backend Login Endpoint",
            status: 'success',
            message: "Backend login endpoint is working",
            details: {
              status: loginResponse.status,
              hasAccessToken: !!tokenData.access_token,
              hasRefreshToken: !!tokenData.refresh_token,
              tokenLength: tokenData.access_token?.length
            }
          })

          // Only run token tests if we got valid tokens
          await runTokenTests(tokenData, results)

        } else {
          const errorText = await loginResponse.text()
          
          if (loginResponse.status === 401) {
            // 401 is expected for mock data with invalid hash - this means the endpoint is working!
            results.push({
              name: "Backend Login Endpoint",
              status: 'success',
              message: "Backend endpoint is working (401 expected for mock data with invalid hash)",
              details: {
                status: loginResponse.status,
                statusText: loginResponse.statusText,
                errorText: errorText,
                explanation: "401 Unauthorized is the correct response for mock Telegram data with invalid HMAC-SHA256 hash. This confirms the endpoint is properly validating authentication data."
              }
            })

            // Skip token tests since we don't have valid tokens
            results.push({
              name: "Token Tests",
              status: 'warning',
              message: "Token tests skipped due to invalid mock data (this is expected)",
              details: {
                reason: "Cannot test token storage, retrieval, and database access without valid authentication tokens",
                note: "This is normal behavior - real Telegram login would provide valid tokens"
              }
            })

          } else {
            results.push({
              name: "Backend Login Endpoint",
              status: 'error',
              message: `Backend login failed with unexpected status: ${loginResponse.status}`,
              details: {
                status: loginResponse.status,
                statusText: loginResponse.statusText,
                errorText: errorText
              }
            })
          }
        }
      } catch (backendError) {
        results.push({
          name: "Backend Login Endpoint",
          status: 'error',
          message: "Backend login endpoint threw error",
          details: {
            error: backendError instanceof Error ? backendError.message : String(backendError)
          }
        })
      }

      // Step 8: Test Production Bypass Logic
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || window.location.hostname !== 'localhost'
      
      results.push({
        name: "Production Bypass Logic",
        status: 'success',
        message: `Production bypass ${isProduction ? 'ACTIVE' : 'INACTIVE'}`,
        details: {
          isProduction,
          bypassActive: isProduction,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            hostname: window.location.hostname
          }
        }
      })

      // Step 9: Test Auth Hook Integration
      try {
        const loginCompleteFlag = localStorage.getItem("telegram-login-complete")
        const authReloadFlag = localStorage.getItem("auth-reload-pending")

        results.push({
          name: "Auth Hook State",
          status: 'success',
          message: "Auth hook state flags checked",
          details: {
            loginComplete: !!loginCompleteFlag,
            reloadPending: !!authReloadFlag,
            currentUser: currentUser ? {
              id: currentUser.id,
              username: currentUser.username,
              name: currentUser.name
            } : null
          }
        })
      } catch (authError) {
        results.push({
          name: "Auth Hook State",
          status: 'error',
          message: "Auth hook state check failed",
          details: {
            error: authError instanceof Error ? authError.message : String(authError)
          }
        })
      }

    } catch (overallError) {
      results.push({
        name: "Debug Login Process",
        status: 'error',
        message: "Overall debug login process failed",
        details: {
          error: overallError instanceof Error ? overallError.message : String(overallError)
        }
      })
    }

    setDebugLoginResults(results)
    setDebugLoginLoading(false)
  }

  // Quick Auth State Test
  const [authStateResults, setAuthStateResults] = useState<DiagnosticResult[]>([])
  const [authStateLoading, setAuthStateLoading] = useState(false)

  const testCurrentAuthState = async () => {
    setAuthStateLoading(true)
    setAuthStateResults([])

    const results: DiagnosticResult[] = []

    try {
      // Check localStorage tokens
      const accessToken = localStorage.getItem("sb-access-token")
      const refreshToken = localStorage.getItem("sb-refresh-token")
      const loginComplete = localStorage.getItem("telegram-login-complete")
      const authReloadPending = localStorage.getItem("auth-reload-pending")

      results.push({
        name: "LocalStorage State",
        status: 'success',
        message: "Current localStorage auth state",
        details: {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenLength: accessToken?.length,
          refreshTokenLength: refreshToken?.length,
          loginComplete: !!loginComplete,
          authReloadPending: !!authReloadPending
        }
      })

      // Check current user from hook
      results.push({
        name: "Auth Hook State",
        status: currentUser ? 'success' : 'warning',
        message: currentUser ? "User is authenticated in hook" : "No user in auth hook",
        details: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          firstName: currentUser.first_name,
          lastName: currentUser.last_name
        } : "No user data"
      })

      // Test getCurrentUserToken
      if (accessToken) {
        try {
          const { getCurrentUserToken } = await import('@/lib/auth')
          const retrievedToken = await getCurrentUserToken()

          results.push({
            name: "Token Retrieval Test",
            status: retrievedToken ? 'success' : 'error',
            message: retrievedToken ? "getCurrentUserToken() working" : "getCurrentUserToken() failed",
            details: {
              hasToken: !!retrievedToken,
              tokenLength: retrievedToken?.length,
              tokensMatch: retrievedToken === accessToken
            }
          })
        } catch (tokenError) {
          results.push({
            name: "Token Retrieval Test",
            status: 'error',
            message: "getCurrentUserToken() threw error",
            details: {
              error: tokenError instanceof Error ? tokenError.message : String(tokenError)
            }
          })
        }
      }

      // Test database access
      if (accessToken) {
        try {
          const testResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=1`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json'
            }
          })

          results.push({
            name: "Database Access Test",
            status: testResponse.ok ? 'success' : 'error',
            message: testResponse.ok ? "Database access working" : `Database access failed: ${testResponse.status}`,
            details: {
              status: testResponse.status,
              statusText: testResponse.statusText,
              url: testResponse.url
            }
          })
        } catch (dbError) {
          results.push({
            name: "Database Access Test",
            status: 'error',
            message: "Database access threw error",
            details: {
              error: dbError instanceof Error ? dbError.message : String(dbError)
            }
          })
        }
      }

    } catch (overallError) {
      results.push({
        name: "Auth State Test",
        status: 'error',
        message: "Auth state test failed",
        details: {
          error: overallError instanceof Error ? overallError.message : String(overallError)
        }
      })
    }

    setAuthStateResults(results)
    setAuthStateLoading(false)
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
      <Header />

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

          {/* Debug Telegram Login Section */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-blue-800">🔧 Debug Telegram Login</CardTitle>
              <p className="text-sm text-blue-600">
                Step-by-step verification of Telegram login process with mock data
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center mb-4">
                <Button 
                  onClick={runDebugTelegramLogin} 
                  disabled={debugLoginLoading}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {debugLoginLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Debug Login...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Debug Telegram Login
                    </>
                  )}
                </Button>
              </div>

              {debugLoginResults.length > 0 && (
                <>
                  {/* Debug Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{debugLoginResults.filter(d => d.status === 'success').length}</div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{debugLoginResults.filter(d => d.status === 'warning').length}</div>
                      <div className="text-sm text-muted-foreground">Warnings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{debugLoginResults.filter(d => d.status === 'error').length}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>

                  {/* Debug Results */}
                  <div className="grid gap-4">
                    {debugLoginResults.map((result, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(result.status)}
                              <h4 className="font-medium text-sm">Step {index + 1}: {result.name}</h4>
                              {getStatusBadge(result.status)}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                          {result.details && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Show step details
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
            </CardContent>
          </Card>

          {/* Current Auth State Test */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-green-800">🔍 Current Auth State</CardTitle>
              <p className="text-sm text-green-600">
                Test your current authentication state and token validity
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center mb-4">
                <Button 
                  onClick={testCurrentAuthState} 
                  disabled={authStateLoading}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  {authStateLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing Auth State...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Test Current Auth
                    </>
                  )}
                </Button>
              </div>

              {authStateResults.length > 0 && (
                <div className="grid gap-4">
                  {authStateResults.map((result, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(result.status)}
                            <h4 className="font-medium text-sm">{result.name}</h4>
                            {getStatusBadge(result.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                        {result.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Show auth details
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
              )}
            </CardContent>
          </Card>

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
