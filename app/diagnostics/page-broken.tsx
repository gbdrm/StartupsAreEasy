"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Database, Users, FileText, Heart, MessageCircle, Building, CheckCircle, XCircle, AlertTriangle, Bug, Zap, Eye, LogOut, RefreshCw, Settings, Clock, RotateCcw, Trash2 } from "lucide-react"
import { useSimpleAuth, emergencyAuthReset } from "@/hooks/use-simple-auth"
import { supabase } from "@/lib/supabase"
import { API_ENDPOINTS } from "@/lib/constants"
import { getCurrentUserToken, signOut } from "@/lib/auth"
import { logger } from "@/lib/logger"

interface DiagnosticResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: any
  count?: number
  duration?: number
}

interface TestResult {
  name: string
  status: 'running' | 'success' | 'error' | 'warning'
  message: string
  timestamp?: string
  details?: any
}

interface AuthState {
  hasAccessToken: boolean
  hasRefreshToken: boolean
  hasLoginComplete: boolean
  hasLogoutFlag: boolean
  allLocalStorageKeys: string[]
  pageVisibility: {
    hidden: boolean
    visibilityState: string
  }
  environment: {
    nodeEnv: string
    hostname: string
    isProduction: boolean
  }
  isProduction: boolean
  loginComplete: boolean
  authReloadPending: boolean
  lastUpdate: string
  testResults: {
    tokenTest?: TestResult
    logoutTest?: TestResult  
    visibilityTest?: TestResult
    clearTest?: TestResult
    resetTest?: TestResult
    debugResult?: TestResult
  }
}

// Component to display test results
function TestResultsDisplay({ results }: { results: TestResult[] }) {
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No test results yet. Click "Run Tests" to start.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <div key={index} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  result.status === 'success' ? 'default' : 
                  result.status === 'error' ? 'destructive' : 
                  'secondary'
                }
              >
                {result.status}
              </Badge>
              <span className="font-medium text-sm">{result.name}</span>
            </div>
            {result.timestamp && (
              <span className="text-xs text-muted-foreground">
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          
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
        </div>
      ))}
    </div>
  )
}

export default function DiagnosticsPage() {
  const { user: currentUser, login: handleLogin, logout: handleLogout } = useSimpleAuth()
  const [activeCategory, setActiveCategory] = useState<string>('smoke')
  const [testResults, setTestResults] = useState<{ [key: string]: DiagnosticResult[] }>({})
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh minimal auth state for display
  const [authInfo, setAuthInfo] = useState<{
    hasTokens: boolean
    isAuthenticated: boolean
    userInfo: any
  }>({
    hasTokens: false,
    isAuthenticated: false,
    userInfo: null
  })

  useEffect(() => {
    const updateAuthInfo = () => {
      setAuthInfo({
        hasTokens: !!(localStorage.getItem('sb-access-token') || localStorage.getItem('sb-refresh-token')),
        isAuthenticated: !!currentUser,
        userInfo: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name
        } : null
      })
    }
    
    updateAuthInfo()
    const interval = setInterval(updateAuthInfo, 2000)
    return () => clearInterval(interval)
  }, [currentUser])

  const logToConsole = (category: string, testName: string, data: any) => {
    console.group(`🔬 DIAGNOSTICS [${category.toUpperCase()}]: ${testName}`)
    console.log('Results:', data)
    console.groupEnd()
  }

  const setTestResult = (category: string, results: DiagnosticResult[]) => {
    setTestResults(prev => ({
      ...prev,
      [category]: results
    }))
  }

  const addRunningTest = (testId: string) => {
    setRunningTests(prev => new Set(prev).add(testId))
  }

  const removeRunningTest = (testId: string) => {
    setRunningTests(prev => {
      const newSet = new Set(prev)
      newSet.delete(testId)
      return newSet
    })
  }

  // SMOKE TESTS - Basic system health
  const runSmokeTests = async () => {
    const testId = 'smoke'
    addRunningTest(testId)
    setError(null)

    const results: DiagnosticResult[] = []

    try {
      console.log('🔬 STARTING SMOKE TESTS')

      // Test 1: Environment Check
      const envCheck = {
        NODE_ENV: process.env.NODE_ENV,
        hostname: window.location.hostname,
        isProduction: window.location.hostname !== 'localhost',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasTelegramEndpoint: !!process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL
      }

      results.push({
        name: 'Environment Check',
        status: envCheck.hasSupabaseUrl ? 'success' : 'error',
        message: `Running in ${envCheck.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`,
        details: envCheck
      })

      // Test 2: Supabase Connection
      try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
        if (error) throw error
        
        results.push({
          name: 'Supabase Connection',
          status: 'success',
          message: 'Database connection successful',
          count: data?.length || 0
        })
      } catch (err: any) {
        results.push({
          name: 'Supabase Connection',
          status: 'error',
          message: `Database connection failed: ${err.message}`,
          details: err
        })
      }

      // Test 3: Telegram Function
      try {
        const response = await fetch(API_ENDPOINTS.TELEGRAM_LOGIN, { method: 'GET' })
        results.push({
          name: 'Telegram Function',
          status: response.status === 405 ? 'success' : 'warning',
          message: response.status === 405 
            ? 'Telegram function accessible (405 expected for GET)'
            : `Unexpected status: ${response.status}`,
          details: { status: response.status, url: API_ENDPOINTS.TELEGRAM_LOGIN }
        })
      } catch (err: any) {
        results.push({
          name: 'Telegram Function',
          status: 'error',
          message: `Telegram function not accessible: ${err.message}`,
          details: err
        })
      }

      logToConsole('smoke', 'All Tests', results)
      setTestResult(testId, results)

    } catch (err: any) {
      console.error('🔬 SMOKE TESTS FAILED:', err)
      setError(`Smoke tests failed: ${err.message}`)
    }

    removeRunningTest(testId)
  }

  // AUTH TESTS - General authentication testing
  const runAuthTests = async () => {
    const testId = 'auth'
    addRunningTest(testId)
    setError(null)

    const results: DiagnosticResult[] = []

    try {
      console.log('🔬 STARTING AUTH TESTS')

      // Test 1: Local Storage State
      const tokens = {
        accessToken: localStorage.getItem('sb-access-token'),
        refreshToken: localStorage.getItem('sb-refresh-token'),
        loginComplete: localStorage.getItem('telegram-login-complete'),
        authReloadPending: localStorage.getItem('auth-reload-pending')
      }

      results.push({
        name: 'LocalStorage Tokens',
        status: tokens.accessToken ? 'success' : 'warning',
        message: tokens.accessToken ? 'Auth tokens present' : 'No auth tokens found',
        details: {
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken,
          accessTokenLength: tokens.accessToken?.length,
          loginComplete: !!tokens.loginComplete,
          authReloadPending: !!tokens.authReloadPending
        }
      })

      // Test 2: Auth Hook State
      results.push({
        name: 'Auth Hook State',
        status: currentUser ? 'success' : 'warning',
        message: currentUser ? `Authenticated as ${currentUser.name}` : 'Not authenticated',
        details: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name
        } : null
      })

      // Test 3: Token Retrieval
      if (tokens.accessToken) {
        try {
          const { getCurrentUserToken } = await import('@/lib/auth')
          const retrievedToken = await getCurrentUserToken()
          
          results.push({
            name: 'Token Retrieval',
            status: retrievedToken ? 'success' : 'error',
            message: retrievedToken ? 'getCurrentUserToken() working' : 'Token retrieval failed',
            details: {
              hasToken: !!retrievedToken,
              tokensMatch: retrievedToken === tokens.accessToken
            }
          })
        } catch (err: any) {
          results.push({
            name: 'Token Retrieval',
            status: 'error',
            message: `Token retrieval error: ${err.message}`,
            details: err
          })
        }
      }

      logToConsole('auth', 'All Tests', results)
      setTestResult(testId, results)

    } catch (err: any) {
      console.error('🔬 AUTH TESTS FAILED:', err)
      setError(`Auth tests failed: ${err.message}`)
    }

    removeRunningTest(testId)
  }

  // TELEGRAM TESTS - Specific Telegram authentication debugging
  const runTelegramTests = async () => {
    const testId = 'telegram'
    addRunningTest(testId)
    setError(null)

    const results: DiagnosticResult[] = []

    try {
      console.log('🔬 STARTING TELEGRAM TESTS')

      const accessToken = localStorage.getItem('sb-access-token')

      // Test 1: JWT Analysis
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          
          const jwtAnalysis = {
            userId: payload.sub,
            email: payload.email,
            isTelegramEmail: payload.email && payload.email.includes('@telegram.local'),
            isExpired: payload.exp * 1000 < Date.now(),
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            userMetadata: payload.user_metadata,
            appMetadata: payload.app_metadata
          }

          console.log('🔬 JWT PAYLOAD ANALYSIS:', jwtAnalysis)

          results.push({
            name: 'JWT Token Analysis',
            status: jwtAnalysis.isExpired ? 'warning' : 'success',
            message: jwtAnalysis.isTelegramEmail 
              ? `Telegram user JWT (${jwtAnalysis.email})` 
              : `Real email JWT (${jwtAnalysis.email})`,
            details: jwtAnalysis
          })

        } catch (err) {
          results.push({
            name: 'JWT Token Analysis',
            status: 'error',
            message: 'Failed to decode JWT token',
            details: { error: err instanceof Error ? err.message : String(err) }
          })
        }
      } else {
        results.push({
          name: 'JWT Token Analysis',
          status: 'warning',
          message: 'No JWT token found',
          details: null
        })
      }

      // Test 2: Auth Hook vs JWT Comparison
      if (accessToken && currentUser) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          
          const comparison = {
            jwtUserId: payload.sub,
            hookUserId: currentUser.id,
            jwtEmail: payload.email,
            hookEmail: currentUser.username,
            userIdMatch: payload.sub === currentUser.id,
            emailMatch: payload.email === currentUser.username
          }

          console.log('🔬 JWT vs HOOK COMPARISON:', comparison)

          const hasUserMismatch = !comparison.userIdMatch
          const hasEmailMismatch = !comparison.emailMatch

          results.push({
            name: 'JWT vs Auth Hook Comparison',
            status: (hasUserMismatch || hasEmailMismatch) ? 'warning' : 'success',
            message: hasUserMismatch 
              ? `⚠️ USER MISMATCH: JWT shows ${comparison.jwtUserId} but hook shows ${comparison.hookUserId}`
              : hasEmailMismatch
                ? `⚠️ EMAIL MISMATCH: JWT shows ${comparison.jwtEmail} but hook shows ${comparison.hookEmail}`
                : 'JWT and auth hook data match',
            details: comparison
          })

        } catch (err) {
          results.push({
            name: 'JWT vs Auth Hook Comparison',
            status: 'error',
            message: 'Failed to compare JWT and auth hook data',
            details: { error: err instanceof Error ? err.message : String(err) }
          })
        }
      }

      // Test 3: Database Profile Lookup
      if (accessToken) {
        try {
          const token = await getCurrentUserToken()
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,email,telegram_id,first_name,last_name&order=created_at.desc`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const profiles = await response.json()
            
            const analysis = {
              totalProfiles: profiles.length,
              telegramProfiles: profiles.filter((p: any) => p.telegram_id).length,
              realEmailProfiles: profiles.filter((p: any) => p.email && !p.email.includes('@telegram.local')).length,
              fakeEmailProfiles: profiles.filter((p: any) => p.email && p.email.includes('@telegram.local')).length,
              conflicts: [] as any[]
            }

            // Check for email conflicts
            const emailGroups = profiles.reduce((groups: any, profile: any) => {
              const email = profile.email || profile.username
              if (!groups[email]) groups[email] = []
              groups[email].push(profile)
              return groups
            }, {})

            Object.entries(emailGroups).forEach(([email, profileList]: [string, any]) => {
              if (profileList.length > 1) {
                analysis.conflicts.push({
                  email,
                  count: profileList.length,
                  profiles: profileList
                })
              }
            })

            console.log('🔬 DATABASE ANALYSIS:', analysis)

            const hasConflicts = analysis.conflicts.length > 0
            
            results.push({
              name: 'Database Profile Analysis',
              status: hasConflicts ? 'warning' : 'success',
              message: hasConflicts 
                ? `⚠️ Found ${analysis.conflicts.length} email conflicts in database`
                : `Database OK: ${analysis.totalProfiles} profiles, ${analysis.telegramProfiles} Telegram users`,
              details: analysis
            })

          } else {
            results.push({
              name: 'Database Profile Analysis',
              status: 'error',
              message: `Database query failed: ${response.status}`,
              details: { status: response.status }
            })
          }

        } catch (err: any) {
          results.push({
            name: 'Database Profile Analysis',
            status: 'error',
            message: `Database analysis failed: ${err.message}`,
            details: err
          })
        }
      }

      logToConsole('telegram', 'All Tests', results)
      setTestResult(testId, results)

    } catch (err: any) {
      console.error('🔬 TELEGRAM TESTS FAILED:', err)
      setError(`Telegram tests failed: ${err.message}`)
    }

    removeRunningTest(testId)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">System Diagnostics</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive testing and debugging tools for authentication and system health
            </p>
          </div>

          {/* Auth Status Bar */}
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${authInfo.hasTokens ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span>Tokens: {authInfo.hasTokens ? 'Present' : 'Missing'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${authInfo.isAuthenticated ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span>User: {authInfo.isAuthenticated ? authInfo.userInfo.name : 'Not authenticated'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${window.location.hostname !== 'localhost' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    <span>Mode: {window.location.hostname !== 'localhost' ? 'Production' : 'Development'}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.clear()
                    console.log('🔬 CURRENT AUTH STATE:', {
                      tokens: {
                        access: localStorage.getItem('sb-access-token'),
                        refresh: localStorage.getItem('sb-refresh-token')
                      },
                      user: currentUser,
                      environment: {
                        hostname: window.location.hostname,
                        isProduction: window.location.hostname !== 'localhost'
                      }
                    })
                  }}
                >
                  Log Auth State
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Test Categories */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="smoke">Smoke Tests</TabsTrigger>
              <TabsTrigger value="auth">Auth Tests</TabsTrigger>
              <TabsTrigger value="telegram">Telegram Tests</TabsTrigger>
            </TabsList>

            {/* Smoke Tests */}
            <TabsContent value="smoke" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>🔥 Smoke Tests</span>
                    <Button 
                      onClick={runSmokeTests}
                      disabled={runningTests.has('smoke')}
                      size="sm"
                    >
                      {runningTests.has('smoke') ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        'Run Smoke Tests'
                      )}
                    </Button>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Basic system health checks - environment, database connection, and Telegram function accessibility
                  </p>
                </CardHeader>
                <CardContent>
                  {testResults.smoke && <TestResultsDisplay results={testResults.smoke} />}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auth Tests */}
            <TabsContent value="auth" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>🔐 Authentication Tests</span>
                    <Button 
                      onClick={runAuthTests}
                      disabled={runningTests.has('auth')}
                      size="sm"
                    >
                      {runningTests.has('auth') ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        'Run Auth Tests'
                      )}
                    </Button>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    General authentication testing - tokens, auth hook state, and token retrieval
                  </p>
                </CardHeader>
                <CardContent>
                  {testResults.auth && <TestResultsDisplay results={testResults.auth} />}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Telegram Tests */}
            <TabsContent value="telegram" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>📱 Telegram Authentication Tests</span>
                    <Button 
                      onClick={runTelegramTests}
                      disabled={runningTests.has('telegram')}
                      size="sm"
                    >
                      {runningTests.has('telegram') ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        'Run Telegram Tests'
                      )}
                    </Button>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Telegram-specific debugging - JWT analysis, user ID conflicts, and database profile checking
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <h4 className="text-sm font-semibold text-yellow-800 mb-2">🐛 Debugging Telegram Login Issues</h4>
                    <p className="text-xs text-yellow-700 mb-2">
                      Use these tests to debug when Telegram login authenticates as the wrong user:
                    </p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      <li>• <strong>Before login:</strong> Run tests to see current state</li>
                      <li>• <strong>After login:</strong> Run tests again to compare JWT vs auth hook</li>
                      <li>• <strong>Check for conflicts:</strong> Look for ⚠️ warnings about user/email mismatches</li>
                    </ul>
                  </div>
                  {testResults.telegram && <TestResultsDisplay results={testResults.telegram} />}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>🛠️ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem('sb-access-token')
                    localStorage.removeItem('sb-refresh-token')
                    localStorage.removeItem('telegram-login-complete')
                    localStorage.removeItem('auth-reload-pending')
                    console.log('🔬 CLEARED ALL AUTH DATA')
                    window.location.reload()
                  }}
                >
                  Clear Auth Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { emergencyAuthReset } = await import('@/hooks/use-simple-auth')
                      await emergencyAuthReset()
                      console.log('🔬 EMERGENCY AUTH RESET COMPLETED')
                    } catch (err) {
                      console.error('🔬 EMERGENCY AUTH RESET FAILED:', err)
                    }
                  }}
                >
                  Emergency Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.clear()
                    console.log('🔬 CONSOLE CLEARED')
                  }}
                >
                  Clear Console
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const token = localStorage.getItem('sb-access-token')
                    if (token) {
                      try {
                        const payload = JSON.parse(atob(token.split('.')[1]))
                        console.group('🔬 JWT TOKEN ANALYSIS')
                        console.log('Full Payload:', payload)
                        console.log('User ID:', payload.sub)
                        console.log('Email:', payload.email)
                        console.log('Is Telegram?:', payload.email && payload.email.includes('@telegram.local'))
                        console.log('Expires:', new Date(payload.exp * 1000))
                        console.groupEnd()
                      } catch (err) {
                        console.error('🔬 Failed to decode JWT:', err)
                      }
                    } else {
                      console.log('🔬 No JWT token found')
                    }
                  }}
                >
                  Decode JWT
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
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

  // Helper function to safely update auth state
  const updateAuthTestResult = (testName: keyof AuthState['testResults'], result: TestResult) => {
    setAuthState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        testResults: {
          ...prev.testResults,
          [testName]: result
        }
      }
    })
  }

  // Comprehensive Auth Testing Functions
  const testAuthTokenRetrieval = async (): Promise<void> => {
    setAuthState(prev => {
      if (!prev) return prev
      return { 
        ...prev, 
        testResults: { ...prev.testResults, tokenTest: { status: 'running', message: 'Testing token retrieval...', timestamp: new Date().toISOString() } }
      }
    })

    try {
      const startTime = performance.now()
      const { getCurrentUserToken } = await import('@/lib/auth')
      const token = await getCurrentUserToken()
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      const storedToken = localStorage.getItem('sb-access-token')
      
      setAuthState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          testResults: {
            ...prev.testResults,
            tokenTest: {
              status: token ? 'success' : 'error',
              message: token ? `Token retrieved successfully in ${duration}ms` : 'Failed to retrieve token',
              timestamp: new Date().toISOString(),
              details: {
                hasToken: !!token,
                tokenLength: token?.length,
                retrievalTime: `${duration}ms`,
                hasStoredToken: !!storedToken,
                tokensMatch: token === storedToken,
                isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
              }
            }
          }
        }
      })
    } catch (error) {
      setAuthState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          testResults: {
            ...prev.testResults,
            tokenTest: {
              status: 'error',
              message: `Token retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date().toISOString(),
              details: { error: error instanceof Error ? error.message : String(error) }
            }
          }
        }
      })
    }
  }

  const testLogoutFlow = async (): Promise<void> => {
    setAuthState(prev => {
      if (!prev) return prev
      return { 
        ...prev, 
        testResults: { ...prev.testResults, logoutTest: { status: 'running', message: 'Testing logout flow...', timestamp: new Date().toISOString() } }
      }
    })

    const events: string[] = []
    
    try {
      // Listen for manual signout events
      const eventListener = (event: Event) => {
        events.push(`Event received: ${event.type} at ${new Date().toISOString()}`)
      }
      
      window.addEventListener('manual-signout', eventListener)
      
      const startTime = performance.now()
      const { signOut } = await import('@/lib/auth')
      
      events.push(`Starting signOut() at ${new Date().toISOString()}`)
      await signOut()
      events.push(`signOut() completed at ${new Date().toISOString()}`)
      
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)
      
      // Check if tokens were cleared
      const hasAccessToken = !!localStorage.getItem('sb-access-token')
      const hasRefreshToken = !!localStorage.getItem('sb-refresh-token')
      
      // Wait a bit for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100))
      
      window.removeEventListener('manual-signout', eventListener)
      
      setAuthState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          testResults: {
            ...prev.testResults,
            logoutTest: {
              status: (!hasAccessToken && !hasRefreshToken) ? 'success' : 'warning',
              message: (!hasAccessToken && !hasRefreshToken) 
                ? `Logout completed successfully in ${duration}ms` 
                : `Logout completed but tokens may still be present (${hasAccessToken ? 'access' : ''}${hasAccessToken && hasRefreshToken ? '+' : ''}${hasRefreshToken ? 'refresh' : ''})`,
              timestamp: new Date().toISOString(),
              details: {
                duration: `${duration}ms`,
                tokensCleared: !hasAccessToken && !hasRefreshToken,
                hasAccessToken,
                hasRefreshToken,
                events,
                manualSignoutEventFired: events.some(e => e.includes('manual-signout'))
              }
            }
          }
        }
      })
    } catch (error) {
      setAuthState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          testResults: {
            ...prev.testResults,
            logoutTest: {
              status: 'error',
              message: `Logout test failed: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date().toISOString(),
              details: { error: error instanceof Error ? error.message : String(error), events }
            }
          }
        }
      })
    }
  }

  const testPageVisibilityTrigger = async (): Promise<void> => {
    updateAuthTestResult('visibilityTest', { status: 'running', message: 'Testing page visibility triggers...', timestamp: new Date().toISOString() })

    const events: string[] = []
    
    try {
      // Store original token for comparison
      const originalToken = localStorage.getItem('sb-access-token')
      events.push(`Original token present: ${!!originalToken}`)
      
      // Listen for visibility change events
      const visibilityListener = () => {
        events.push(`Visibility change: ${document.hidden ? 'hidden' : 'visible'} at ${new Date().toISOString()}`)
      }
      
      document.addEventListener('visibilitychange', visibilityListener)
      
      // Simulate tab switch by dispatching visibility change
      events.push(`Simulating tab hidden at ${new Date().toISOString()}`)
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      
      // Wait for any async processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Simulate tab return
      events.push(`Simulating tab visible at ${new Date().toISOString()}`)
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      
      // Wait for any token validation
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const finalToken = localStorage.getItem('sb-access-token')
      events.push(`Final token present: ${!!finalToken}`)
      
      document.removeEventListener('visibilitychange', visibilityListener)
      
      updateAuthTestResult('visibilityTest', {
        status: 'success',
        message: 'Page visibility simulation completed',
        timestamp: new Date().toISOString(),
        details: {
          originalTokenPresent: !!originalToken,
          finalTokenPresent: !!finalToken,
          tokenPersisted: originalToken === finalToken,
          events,
          note: 'This simulates tab switching behavior that was causing logout issues'
        }
      })
    } catch (error) {
      updateAuthTestResult('visibilityTest', {
        status: 'error',
        message: `Visibility test failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error), events }
      })
    }
  }

  const clearAllAuthData = async (): Promise<void> => {
    updateAuthTestResult('clearTest', { status: 'running', message: 'Clearing all auth data...', timestamp: new Date().toISOString() })

    try {
      const itemsBefore = {
        accessToken: !!localStorage.getItem('sb-access-token'),
        refreshToken: !!localStorage.getItem('sb-refresh-token'),
        loginComplete: !!localStorage.getItem('telegram-login-complete'),
        authReloadPending: !!localStorage.getItem('auth-reload-pending')
      }

      // Clear all auth-related localStorage items
      const authKeys = [
        'sb-access-token',
        'sb-refresh-token', 
        'telegram-login-complete',
        'auth-reload-pending'
      ]
      
      authKeys.forEach(key => localStorage.removeItem(key))
      
      const itemsAfter = {
        accessToken: !!localStorage.getItem('sb-access-token'),
        refreshToken: !!localStorage.getItem('sb-refresh-token'),
        loginComplete: !!localStorage.getItem('telegram-login-complete'),
        authReloadPending: !!localStorage.getItem('auth-reload-pending')
      }

      const allCleared = !itemsAfter.accessToken && !itemsAfter.refreshToken && !itemsAfter.loginComplete && !itemsAfter.authReloadPending
      
      updateAuthTestResult('clearTest', {
        status: allCleared ? 'success' : 'warning',
        message: allCleared ? 'All auth data cleared successfully' : 'Some auth data may still be present',
        timestamp: new Date().toISOString(),
        details: {
          itemsBefore,
          itemsAfter,
          keysCleared: authKeys,
          allCleared
        }
      })
    } catch (error) {
      updateAuthTestResult('clearTest', {
        status: 'error',
        message: `Failed to clear auth data: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  const forceAuthReset = async (): Promise<void> => {
    updateAuthTestResult('resetTest', { status: 'running', message: 'Performing emergency auth reset...', timestamp: new Date().toISOString() })

    try {
      const { emergencyAuthReset } = await import('@/hooks/use-simple-auth')
      
      const beforeReset = {
        currentUser: !!currentUser,
        hasTokens: !!(localStorage.getItem('sb-access-token') || localStorage.getItem('sb-refresh-token'))
      }
      
      await emergencyAuthReset()
      
      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const afterReset = {
        hasTokens: !!(localStorage.getItem('sb-access-token') || localStorage.getItem('sb-refresh-token'))
      }
      
      updateAuthTestResult('resetTest', {
        status: 'success',
        message: 'Emergency auth reset completed',
        timestamp: new Date().toISOString(),
        details: {
          beforeReset,
          afterReset,
          note: 'This function clears all auth state and forces a clean restart - useful when auth gets stuck'
        }
      })
    } catch (error) {
      updateAuthTestResult('resetTest', {
        status: 'error',
        message: `Auth reset failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  // Telegram-specific debugging functions
  const debugTelegramUser = async (): Promise<void> => {
    updateAuthTestResult('debugResult', { status: 'running', message: 'Debugging Telegram user authentication...', timestamp: new Date().toISOString() })

    try {
      const results: any = {
        currentAuthState: {},
        jwtPayload: null,
        databaseLookup: null,
        environment: {}
      }

      // 1. Check current auth state
      const accessToken = localStorage.getItem('sb-access-token')
      const refreshToken = localStorage.getItem('sb-refresh-token')
      
      results.currentAuthState = {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        loginComplete: !!localStorage.getItem('telegram-login-complete'),
        authReloadPending: !!localStorage.getItem('auth-reload-pending'),
        currentUser: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name
        } : null
      }

      // 2. Decode JWT payload if token exists
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          results.jwtPayload = {
            user_id: payload.sub,
            email: payload.email,
            aud: payload.aud,
            role: payload.role,
            exp: payload.exp,
            iat: payload.iat,
            iss: payload.iss,
            user_metadata: payload.user_metadata,
            app_metadata: payload.app_metadata
          }
        } catch (err) {
          results.jwtPayload = { error: 'Failed to decode JWT', details: err instanceof Error ? err.message : String(err) }
        }
      }

      // 3. Test database user lookup
      if (accessToken) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=*`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json'
            }
          })
          
          if (response.ok) {
            const profiles = await response.json()
            results.databaseLookup = {
              success: true,
              profileCount: profiles.length,
              profiles: profiles.map((p: any) => ({
                id: p.id,
                username: p.username,
                first_name: p.first_name,
                last_name: p.last_name,
                email: p.email,
                telegram_id: p.telegram_id,
                avatar_url: p.avatar_url
              }))
            }
          } else {
            results.databaseLookup = {
              success: false,
              status: response.status,
              statusText: response.statusText
            }
          }
        } catch (err) {
          results.databaseLookup = {
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }
        }
      }

      // 4. Environment detection
      results.environment = {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isProduction: typeof window !== 'undefined' ? window.location.hostname !== 'localhost' : false,
        productionBypassActive: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
      }

      // 5. Analysis
      const analysis: string[] = []
      
      if (results.jwtPayload && results.currentAuthState.currentUser) {
        const jwtUserId = results.jwtPayload.user_id
        const hookUserId = results.currentAuthState.currentUser.id
        
        if (jwtUserId !== hookUserId) {
          analysis.push(`⚠️ USER MISMATCH: JWT contains user ${jwtUserId} but auth hook shows ${hookUserId}`)
        }
        
        if (results.jwtPayload.email && results.currentAuthState.currentUser.username) {
          const jwtEmail = results.jwtPayload.email
          const hookEmail = results.currentAuthState.currentUser.username
          
          if (jwtEmail !== hookEmail) {
            analysis.push(`⚠️ EMAIL MISMATCH: JWT contains ${jwtEmail} but auth hook shows ${hookEmail}`)
          }
          
          if (jwtEmail.includes('@telegram.local')) {
            analysis.push(`📱 TELEGRAM USER: JWT contains fake Telegram email ${jwtEmail}`)
          } else {
            analysis.push(`📧 REAL EMAIL USER: JWT contains real email ${jwtEmail}`)
          }
        }
      }
      
      if (results.databaseLookup && results.databaseLookup.success) {
        const profiles = results.databaseLookup.profiles
        const telegramProfiles = profiles.filter((p: any) => p.telegram_id)
        const realEmailProfiles = profiles.filter((p: any) => p.email && !p.email.includes('@telegram.local'))
        
        analysis.push(`📊 DATABASE: Found ${profiles.length} total profiles, ${telegramProfiles.length} with telegram_id, ${realEmailProfiles.length} with real emails`)
        
        if (telegramProfiles.length > 0 && realEmailProfiles.length > 0) {
          analysis.push(`⚠️ POTENTIAL CONFLICT: Database has both Telegram and real email users`)
        }
      }

      updateAuthTestResult('debugResult', {
        status: analysis.some(a => a.includes('MISMATCH') || a.includes('CONFLICT')) ? 'warning' : 'success',
        message: `Telegram debug completed. ${analysis.length} findings.`,
        timestamp: new Date().toISOString(),
        details: {
          ...results,
          analysis
        }
      })
    } catch (error) {
      updateAuthTestResult('debugResult', {
        status: 'error',
        message: `Telegram debug failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  const checkEmailConflicts = async (): Promise<void> => {
    updateAuthTestResult('debugResult', { status: 'running', message: 'Checking for email conflicts...', timestamp: new Date().toISOString() })

    try {
      const token = await getCurrentUserToken()
      if (!token) {
        throw new Error('No auth token available')
      }

      // Query all profiles to check for conflicts
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,email,telegram_id,first_name,last_name&order=created_at.desc`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Database query failed: ${response.status}`)
      }

      const profiles = await response.json()
      
      const analysis = {
        totalProfiles: profiles.length,
        telegramProfiles: profiles.filter((p: any) => p.telegram_id).length,
        realEmailProfiles: profiles.filter((p: any) => p.email && !p.email.includes('@telegram.local')).length,
        fakeEmailProfiles: profiles.filter((p: any) => p.email && p.email.includes('@telegram.local')).length,
        conflicts: [] as any[]
      }

      // Check for specific conflicts
      const emailGroups = profiles.reduce((groups: any, profile: any) => {
        const email = profile.email || profile.username
        if (!groups[email]) groups[email] = []
        groups[email].push(profile)
        return groups
      }, {})

      Object.entries(emailGroups).forEach(([email, profileList]: [string, any]) => {
        if (profileList.length > 1) {
          analysis.conflicts.push({
            email,
            count: profileList.length,
            profiles: profileList.map((p: any) => ({
              id: p.id,
              username: p.username,
              telegram_id: p.telegram_id,
              name: `${p.first_name || ''} ${p.last_name || ''}`.trim()
            }))
          })
        }
      })

      const hasConflicts = analysis.conflicts.length > 0
      const status = hasConflicts ? 'warning' : 'success'
      const message = hasConflicts 
        ? `Found ${analysis.conflicts.length} email conflicts`
        : 'No email conflicts detected'

      updateAuthTestResult('debugResult', {
        status,
        message,
        timestamp: new Date().toISOString(),
        details: analysis
      })
    } catch (error) {
      updateAuthTestResult('debugResult', {
        status: 'error',
        message: `Email conflict check failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  const inspectJWTPayload = async (): Promise<void> => {
    updateAuthTestResult('debugResult', { status: 'running', message: 'Inspecting JWT token payload...', timestamp: new Date().toISOString() })

    try {
      const accessToken = localStorage.getItem('sb-access-token')
      
      if (!accessToken) {
        throw new Error('No access token found in localStorage')
      }

      // Decode JWT payload
      const parts = accessToken.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }

      const payload = JSON.parse(atob(parts[1]))
      
      const analysis = {
        tokenInfo: {
          header: JSON.parse(atob(parts[0])),
          payload: payload,
          isExpired: payload.exp * 1000 < Date.now(),
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          issuedAt: new Date(payload.iat * 1000).toISOString()
        },
        userInfo: {
          userId: payload.sub,
          email: payload.email,
          role: payload.role,
          aud: payload.aud,
          userMetadata: payload.user_metadata,
          appMetadata: payload.app_metadata
        },
        flags: {
          isTelegramEmail: payload.email && payload.email.includes('@telegram.local'),
          hasUserMetadata: !!payload.user_metadata && Object.keys(payload.user_metadata).length > 0,
          hasAppMetadata: !!payload.app_metadata && Object.keys(payload.app_metadata).length > 0
        }
      }

      updateAuthTestResult('debugResult', {
        status: analysis.tokenInfo.isExpired ? 'warning' : 'success',
        message: analysis.tokenInfo.isExpired 
          ? 'JWT token is expired' 
          : `JWT token is valid (expires ${analysis.tokenInfo.expiresAt})`,
        timestamp: new Date().toISOString(),
        details: analysis
      })
    } catch (error) {
      updateAuthTestResult('debugResult', {
        status: 'error',
        message: `JWT inspection failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error.message : String(error) }
      })
    }
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

          {/* Comprehensive Auth Testing */}
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle className="text-purple-800">🧪 Comprehensive Auth Testing</CardTitle>
              <p className="text-sm text-purple-600">
                Advanced authentication testing tools for debugging auth issues
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="test-functions" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="test-functions">Test Functions</TabsTrigger>
                  <TabsTrigger value="auth-state">Live Auth State</TabsTrigger>
                  <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
                  <TabsTrigger value="debug-tools">Debug Tools</TabsTrigger>
                </TabsList>

                <TabsContent value="test-functions" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Token Retrieval Test
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Tests getCurrentUserToken() function with timing metrics
                        </p>
                        <Button 
                          onClick={testAuthTokenRetrieval} 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                        >
                          Test Token Retrieval
                        </Button>
                        {authState?.testResults?.tokenTest && (
                          <div className={`p-2 rounded text-xs ${
                            authState.testResults.tokenTest.status === 'success' ? 'bg-green-100 text-green-800' :
                            authState.testResults.tokenTest.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className="font-medium">{authState.testResults.tokenTest.message}</div>
                            <div className="text-xs opacity-75 mt-1">{authState.testResults.tokenTest.timestamp}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <LogOut className="h-4 w-4" />
                          Logout Flow Test
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Tests complete logout process with event monitoring
                        </p>
                        <Button 
                          onClick={testLogoutFlow} 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                        >
                          Test Logout Flow
                        </Button>
                        {authState?.testResults?.logoutTest && (
                          <div className={`p-2 rounded text-xs ${
                            authState.testResults.logoutTest.status === 'success' ? 'bg-green-100 text-green-800' :
                            authState.testResults.logoutTest.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className="font-medium">{authState.testResults.logoutTest.message}</div>
                            <div className="text-xs opacity-75 mt-1">{authState.testResults.logoutTest.timestamp}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Page Visibility Test
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Simulates tab switching to test visibility change handling
                        </p>
                        <Button 
                          onClick={testPageVisibilityTrigger} 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                        >
                          Test Tab Switching
                        </Button>
                        {authState?.testResults?.visibilityTest && (
                          <div className={`p-2 rounded text-xs ${
                            authState.testResults.visibilityTest.status === 'success' ? 'bg-green-100 text-green-800' :
                            authState.testResults.visibilityTest.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className="font-medium">{authState.testResults.visibilityTest.message}</div>
                            <div className="text-xs opacity-75 mt-1">{authState.testResults.visibilityTest.timestamp}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Emergency Reset
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Forces complete auth state reset when stuck
                        </p>
                        <Button 
                          onClick={forceAuthReset} 
                          size="sm" 
                          variant="destructive"
                          className="w-full"
                        >
                          Emergency Reset
                        </Button>
                        {authState?.testResults?.resetTest && (
                          <div className={`p-2 rounded text-xs ${
                            authState.testResults.resetTest.status === 'success' ? 'bg-green-100 text-green-800' :
                            authState.testResults.resetTest.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            <div className="font-medium">{authState.testResults.resetTest.message}</div>
                            <div className="text-xs opacity-75 mt-1">{authState.testResults.resetTest.timestamp}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Clear Auth Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Manually clears all authentication data from localStorage
                      </p>
                      <Button 
                        onClick={clearAllAuthData} 
                        size="sm" 
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        Clear All Auth Data
                      </Button>
                      {authState?.testResults?.clearTest && (
                        <div className={`p-2 rounded text-xs ${
                          authState.testResults.clearTest.status === 'success' ? 'bg-green-100 text-green-800' :
                          authState.testResults.clearTest.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          <div className="font-medium">{authState.testResults.clearTest.message}</div>
                          <div className="text-xs opacity-75 mt-1">{authState.testResults.clearTest.timestamp}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="auth-state" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Live Authentication State</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Auto-refreshing view of current auth state (updates every 2 seconds)
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <strong>Current User:</strong>
                              <div className="mt-1 p-2 bg-muted rounded">
                                {currentUser ? (
                                  <div>
                                    <div>ID: {currentUser.id}</div>
                                    <div>Name: {currentUser.name}</div>
                                    <div>Username: {currentUser.username}</div>
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">Not authenticated</div>
                                )}
                              </div>
                            </div>
                            <div>
                              <strong>Tokens:</strong>
                              <div className="mt-1 p-2 bg-muted rounded">
                                <div>Access: {authState?.hasAccessToken ? '✅ Present' : '❌ Missing'}</div>
                                <div>Refresh: {authState?.hasRefreshToken ? '✅ Present' : '❌ Missing'}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <strong className="text-xs">Environment:</strong>
                            <div className="mt-1 p-2 bg-muted rounded text-xs">
                              <div>Production Mode: {authState?.isProduction ? '✅ Yes' : '❌ No'}</div>
                              <div>NODE_ENV: {process.env.NODE_ENV}</div>
                              <div>Hostname: {typeof window !== 'undefined' ? window.location.hostname : 'SSR'}</div>
                            </div>
                          </div>

                          <div>
                            <strong className="text-xs">Auth Flags:</strong>
                            <div className="mt-1 p-2 bg-muted rounded text-xs">
                              <div>Login Complete: {authState?.loginComplete ? '✅ Yes' : '❌ No'}</div>
                              <div>Reload Pending: {authState?.authReloadPending ? '⚠️ Yes' : '✅ No'}</div>
                            </div>
                          </div>

                          <div>
                            <strong className="text-xs">Last Updated:</strong>
                            <div className="mt-1 p-2 bg-muted rounded text-xs">
                              {authState?.lastUpdate}
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="troubleshooting" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Common Issues & Solutions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-xs">
                        <div className="border-l-4 border-red-500 pl-4">
                          <h4 className="font-semibold text-red-700">Logout doesn't work after tab switching</h4>
                          <p className="text-muted-foreground mt-1">
                            This was caused by page visibility detection interfering with logout process.
                            Fixed by implementing production bypasses and manual event system.
                          </p>
                          <div className="mt-2">
                            <strong>Test:</strong> Use "Page Visibility Test" to simulate tab switching
                          </div>
                        </div>

                        <div className="border-l-4 border-yellow-500 pl-4">
                          <h4 className="font-semibold text-yellow-700">Auth state gets stuck</h4>
                          <p className="text-muted-foreground mt-1">
                            Sometimes auth state can become inconsistent between localStorage and React state.
                          </p>
                          <div className="mt-2">
                            <strong>Solution:</strong> Use "Emergency Reset" to force clean auth state
                          </div>
                        </div>

                        <div className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-semibold text-blue-700">Slow token retrieval</h4>
                          <p className="text-muted-foreground mt-1">
                            getCurrentUserToken() should be fast (&lt;10ms) in production due to bypasses.
                          </p>
                          <div className="mt-2">
                            <strong>Test:</strong> Use "Token Retrieval Test" to measure performance
                          </div>
                        </div>

                        <div className="border-l-4 border-green-500 pl-4">
                          <h4 className="font-semibold text-green-700">Production vs Development</h4>
                          <p className="text-muted-foreground mt-1">
                            Production mode uses auth bypasses to avoid Supabase hanging issues.
                            Development should use real Supabase auth when possible.
                          </p>
                          <div className="mt-2">
                            <strong>Check:</strong> Environment detection in "Live Auth State" tab
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="debug-tools" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Telegram Auth Debugging</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Specific tools for debugging Telegram authentication issues in production
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <h4 className="text-sm font-semibold text-yellow-800 mb-2">🐛 Production Telegram Issue</h4>
                          <p className="text-xs text-yellow-700 mb-3">
                            Telegram login may authenticate as wrong user due to email conflicts between real emails and fake Telegram emails (`telegram-ID@telegram.local`).
                          </p>
                          <div className="grid gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => debugTelegramUser()}
                              className="text-xs"
                            >
                              🔍 Debug Current Telegram User
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => checkEmailConflicts()}
                              className="text-xs"
                            >
                              📧 Check Email Conflicts
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => inspectJWTPayload()}
                              className="text-xs"
                            >
                              🔐 Inspect JWT Token Payload
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold mb-2">Debug Commands for Browser Console:</h4>
                          <div className="space-y-3">
                            <div>
                              <h5 className="text-xs font-semibold mb-1">Check Current Auth State:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                console.log(&#123;<br/>
                                &nbsp;&nbsp;accessToken: localStorage.getItem('sb-access-token'),<br/>
                                &nbsp;&nbsp;refreshToken: localStorage.getItem('sb-refresh-token'),<br/>
                                &nbsp;&nbsp;loginComplete: localStorage.getItem('telegram-login-complete'),<br/>
                                &nbsp;&nbsp;authReloadPending: localStorage.getItem('auth-reload-pending')<br/>
                                &#125;)
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Decode JWT Token:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                const token = localStorage.getItem('sb-access-token')<br/>
                                if (token) &#123;<br/>
                                &nbsp;&nbsp;const payload = JSON.parse(atob(token.split('.')[1]))<br/>
                                &nbsp;&nbsp;console.log('JWT Payload:', payload)<br/>
                                &#125;
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Check Database User Lookup:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                // In browser console after login:<br/>
                                fetch(window.location.origin + '/api/debug-user', &#123;<br/>
                                &nbsp;&nbsp;headers: &#123; 'Authorization': `Bearer $&#123;localStorage.getItem('sb-access-token')&#125;` &#125;<br/>
                                &#125;).then(r =&gt; r.json()).then(console.log)
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Force Manual Signout Event:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                window.dispatchEvent(new CustomEvent('manual-signout'))
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Test Token Retrieval:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                import('/lib/auth').then(auth =&gt; auth.getCurrentUserToken()).then(console.log)
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Clear All Auth Data:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                ['sb-access-token', 'sb-refresh-token', 'telegram-login-complete', 'auth-reload-pending']<br/>
                                &nbsp;&nbsp;.forEach(key =&gt; localStorage.removeItem(key))
                              </code>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold mb-1">Emergency Auth Reset:</h5>
                              <code className="block p-2 bg-muted rounded text-xs">
                                import('/hooks/use-simple-auth').then(auth =&gt; auth.emergencyAuthReset())
                              </code>
                            </div>
                          </div>
                        </div>

                        {authState?.testResults?.debugResult && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <h4 className="text-sm font-semibold text-blue-800 mb-2">Debug Results</h4>
                            <div className={`p-2 rounded text-xs ${
                              authState.testResults.debugResult.status === 'success' ? 'bg-green-100 text-green-800' :
                              authState.testResults.debugResult.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              <div className="font-medium">{authState.testResults.debugResult.message}</div>
                              <div className="text-xs opacity-75 mt-1">{authState.testResults.debugResult.timestamp}</div>
                              {authState.testResults.debugResult.details && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer">Show details</summary>
                                  <pre className="mt-1 text-xs overflow-auto">
                                    {JSON.stringify(authState.testResults.debugResult.details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
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
