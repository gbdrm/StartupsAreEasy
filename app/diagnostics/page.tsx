"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"
import { logger } from "@/lib/logger"

interface TestResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  timestamp?: string
  details?: any
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
  const { user: currentUser } = useSimpleAuth()
  const [activeCategory, setActiveCategory] = useState<string>('smoke')
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult[] }>({})
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
    userInfo: { name: 'Unknown' }
  })

  // Update auth info when component mounts or user changes
  useEffect(() => {
    const updateAuthInfo = () => {
      if (typeof window !== 'undefined') {
        const hasTokens = !!(localStorage.getItem('sb-access-token') && localStorage.getItem('sb-refresh-token'))
        setAuthInfo({
          hasTokens,
          isAuthenticated: !!currentUser,
          userInfo: currentUser ? { name: currentUser.name || currentUser.username || 'User' } : { name: 'Not authenticated' }
        })
      }
    }
    
    updateAuthInfo()
    const interval = setInterval(updateAuthInfo, 2000)
    return () => clearInterval(interval)
  }, [currentUser])

  // Test functions
  const runSmokeTests = async () => {
    setRunningTests(prev => new Set([...prev, 'smoke']))
    setError(null)
    const results: TestResult[] = []
    
    console.group('🔥 SMOKE TESTS')
    
    try {
      // Environment check
      results.push({
        name: "Environment Check",
        status: 'success',
        message: `Running in ${window.location.hostname !== 'localhost' ? 'production' : 'development'} mode`,
        timestamp: new Date().toISOString(),
        details: {
          hostname: window.location.hostname,
          environment: process.env.NODE_ENV,
          isProduction: window.location.hostname !== 'localhost'
        }
      })
      
      // Database connectivity
      try {
        const response = await fetch('/api/diagnostics')
        const status = response.ok ? 'success' : 'error'
        results.push({
          name: "Database Connectivity",
          status,
          message: response.ok ? 'Database accessible via API' : `Database connection failed (${response.status})`,
          timestamp: new Date().toISOString(),
          details: { status: response.status, statusText: response.statusText }
        })
      } catch (err) {
        results.push({
          name: "Database Connectivity",
          status: 'error',
          message: 'Failed to test database connectivity',
          timestamp: new Date().toISOString(),
          details: err
        })
      }

      // Telegram function check
      try {
        const telegramUrl = process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL || 'https://zkbhmsemckuvraudsyza.supabase.co/functions/v1/telegram-login'
        const response = await fetch(telegramUrl, { method: 'GET' })
        results.push({
          name: "Telegram Function",
          status: response.status === 405 ? 'success' : 'warning',
          message: response.status === 405 ? 'Telegram function accessible (405 expected for GET)' : `Unexpected status: ${response.status}`,
          timestamp: new Date().toISOString(),
          details: { status: response.status, url: telegramUrl }
        })
      } catch (err) {
        results.push({
          name: "Telegram Function",
          status: 'error',
          message: 'Telegram function not accessible',
          timestamp: new Date().toISOString(),
          details: err
        })
      }

      console.log('🔥 Smoke test results:', results)
      
    } catch (err) {
      console.error('🔥 Smoke tests failed:', err)
      results.push({
        name: "Smoke Tests",
        status: 'error',
        message: `Test execution failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
        details: err
      })
    }
    
    console.groupEnd()
    setTestResults(prev => ({ ...prev, smoke: results }))
    setRunningTests(prev => {
      const newSet = new Set(prev)
      newSet.delete('smoke')
      return newSet
    })
  }

  const runAuthTests = async () => {
    setRunningTests(prev => new Set([...prev, 'auth']))
    setError(null)
    const results: TestResult[] = []
    
    console.group('🔐 AUTH TESTS')
    
    try {
      // Token presence check
      const hasAccessToken = typeof window !== 'undefined' && !!localStorage.getItem('sb-access-token')
      const hasRefreshToken = typeof window !== 'undefined' && !!localStorage.getItem('sb-refresh-token')
      
      results.push({
        name: "Token Presence",
        status: hasAccessToken && hasRefreshToken ? 'success' : 'warning',
        message: `Access: ${hasAccessToken ? 'Present' : 'Missing'}, Refresh: ${hasRefreshToken ? 'Present' : 'Missing'}`,
        timestamp: new Date().toISOString(),
        details: { hasAccessToken, hasRefreshToken }
      })

      // Auth hook state
      results.push({
        name: "Auth Hook State",
        status: currentUser ? 'success' : 'warning',
        message: currentUser ? `Authenticated as ${currentUser.name || currentUser.username}` : 'Not authenticated',
        timestamp: new Date().toISOString(),
        details: currentUser ? {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name
        } : null
      })

      // Token retrieval test
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('sb-access-token') : null
        results.push({
          name: "Token Retrieval",
          status: token ? 'success' : 'warning',
          message: token ? 'Token found in localStorage' : 'No token found in localStorage',
          timestamp: new Date().toISOString(),
          details: { hasToken: !!token, tokenLength: token?.length }
        })
      } catch (err) {
        results.push({
          name: "Token Retrieval",
          status: 'error',
          message: `Token retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
          details: err
        })
      }

      console.log('🔐 Auth test results:', results)
      
    } catch (err) {
      console.error('🔐 Auth tests failed:', err)
      results.push({
        name: "Auth Tests",
        status: 'error',
        message: `Test execution failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
        details: err
      })
    }
    
    console.groupEnd()
    setTestResults(prev => ({ ...prev, auth: results }))
    setRunningTests(prev => {
      const newSet = new Set(prev)
      newSet.delete('auth')
      return newSet
    })
  }

  const runTelegramTests = async () => {
    setRunningTests(prev => new Set([...prev, 'telegram']))
    setError(null)
    const results: TestResult[] = []
    
    console.group('📱 TELEGRAM TESTS')
    
    try {
      // JWT analysis
      const token = typeof window !== 'undefined' ? localStorage.getItem('sb-access-token') : null
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const isTelegramEmail = payload.email && payload.email.includes('@telegram.local')
          
          results.push({
            name: "JWT Analysis",
            status: 'success',
            message: `JWT contains ${isTelegramEmail ? 'Telegram' : 'regular'} email`,
            timestamp: new Date().toISOString(),
            details: {
              userId: payload.sub,
              email: payload.email,
              isTelegram: isTelegramEmail,
              expires: new Date(payload.exp * 1000)
            }
          })

          // Check for user/email mismatch
          if (currentUser && currentUser.username !== payload.email) {
            results.push({
              name: "⚠️ User/Email Mismatch",
              status: 'warning',
              message: `JWT email (${payload.email}) differs from auth user email (${currentUser.username})`,
              timestamp: new Date().toISOString(),
              details: {
                jwtEmail: payload.email,
                jwtUserId: payload.sub,
                authUserEmail: currentUser.username,
                authUserId: currentUser.id
              }
            })
          }

          console.log('📱 JWT Payload Analysis:')
          console.log('  User ID:', payload.sub)
          console.log('  Email:', payload.email)
          console.log('  Is Telegram?:', isTelegramEmail)
          console.log('  Auth User:', currentUser)
          
        } catch (parseErr) {
          results.push({
            name: "JWT Analysis",
            status: 'error',
            message: 'Failed to parse JWT token',
            timestamp: new Date().toISOString(),
            details: parseErr
          })
        }
      } else {
        results.push({
          name: "JWT Analysis",
          status: 'warning',
          message: 'No JWT token found',
          timestamp: new Date().toISOString()
        })
      }

      // Database profile check (if authenticated)
      if (currentUser) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}`, {
            headers: {
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            const profiles = await response.json()
            const profile = profiles[0]
            
            results.push({
              name: "Database Profile",
              status: profile ? 'success' : 'warning',
              message: profile ? 'Profile found in database' : 'No profile found',
              timestamp: new Date().toISOString(),
              details: profile ? {
                id: profile.id,
                username: profile.username,
                telegramId: profile.telegram_id,
                firstName: profile.first_name,
                lastName: profile.last_name
              } : null
            })
          } else {
            results.push({
              name: "Database Profile",
              status: 'error',
              message: `Failed to fetch profile: ${response.status}`,
              timestamp: new Date().toISOString(),
              details: { status: response.status }
            })
          }
        } catch (dbErr) {
          results.push({
            name: "Database Profile",
            status: 'error',
            message: 'Database query failed',
            timestamp: new Date().toISOString(),
            details: dbErr
          })
        }
      }

      console.log('📱 Telegram test results:', results)
      
    } catch (err) {
      console.error('📱 Telegram tests failed:', err)
      results.push({
        name: "Telegram Tests",
        status: 'error',
        message: `Test execution failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
        details: err
      })
    }
    
    console.groupEnd()
    setTestResults(prev => ({ ...prev, telegram: results }))
    setRunningTests(prev => {
      const newSet = new Set(prev)
      newSet.delete('telegram')
      return newSet
    })
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
                    <div className={`w-2 h-2 rounded-full ${typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    <span>Mode: {typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'Production' : 'Development'}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.clear()
                    if (typeof window !== 'undefined') {
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
                    }
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
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('sb-access-token')
                      localStorage.removeItem('sb-refresh-token')
                      localStorage.removeItem('telegram-login-complete')
                      localStorage.removeItem('auth-reload-pending')
                      console.log('🔬 CLEARED ALL AUTH DATA')
                      window.location.reload()
                    }
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
                    if (typeof window !== 'undefined') {
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
