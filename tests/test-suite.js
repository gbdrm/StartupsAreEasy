// Test suite for StartupsAreEasy functionality
// Run with: npm run test

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { runCryptoTests } = require('./crypto-utils.test.js');
const { runApiSecurityTests } = require('./api-security.test.js');
const { runAuthFlowTests } = require('./auth-flow.test.js');
const { runApiEndpointsTests } = require('./api-endpoints.test.js');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      let value = valueParts.join('=').trim();
      // Remove quotes from value
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}

const testResults = []

// Test configuration
const TEST_CONFIG = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    TEST_USER_ID: '6eb31970-00df-4049-9bab-409bed21962e' // Fake user for testing
}

// Helper function to make API calls
async function makeApiCall(url, options = {}) {
    const headers = {
        'apikey': TEST_CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${TEST_CONFIG.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
    }

    const response = await fetch(url, { ...options, headers })
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    return await response.json()
}

// Test function wrapper
function test(name, fn) {
    return async () => {
        console.log(`🧪 Running: ${name}`)
        try {
            await fn()
            console.log(`✅ PASS: ${name}`)
            testResults.push({ name, status: 'PASS' })
        } catch (error) {
            console.log(`❌ FAIL: ${name}`)
            console.error(`   Error: ${error.message}`)
            testResults.push({ name, status: 'FAIL', error: error.message })
        }
    }
}

// Test 1: Database connection
const testDatabaseConnection = test('Database Connection', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/profiles?limit=1`
    const data = await makeApiCall(url)
    
    if (!Array.isArray(data)) {
        throw new Error('Expected array response from profiles endpoint')
    }
    
    console.log(`   ✓ Database accessible, got ${data.length} profiles`)
})

// Test 2: Posts with details function (core fix)
const testPostsWithDetails = test('Posts With Details Function', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/get_posts_with_details`
    const requestBody = { user_id_param: null }
    
    const data = await makeApiCall(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
    })
    
    if (!Array.isArray(data)) {
        throw new Error('Expected array response from get_posts_with_details')
    }
    
    console.log(`   ✓ Function works, got ${data.length} posts`)
    
    if (data.length > 0) {
        const post = data[0]
        const requiredFields = ['id', 'user_id', 'type', 'content', 'likes_count', 'comments_count', 'liked_by_user']
        
        for (const field of requiredFields) {
            if (!(field in post)) {
                throw new Error(`Missing required field: ${field}`)
            }
        }
        
        console.log(`   ✓ Post structure valid: likes=${post.likes_count}, liked=${post.liked_by_user}`)
    }
})

// Test 3: Posts with user context (likes fix)
const testPostsWithUserContext = test('Posts With User Context (Likes)', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/get_posts_with_details`
    const requestBody = { user_id_param: TEST_CONFIG.TEST_USER_ID }
    
    const data = await makeApiCall(url, {
        method: 'POST',
        body: JSON.stringify(requestBody)
    })
    
    if (!Array.isArray(data)) {
        throw new Error('Expected array response')
    }
    
    console.log(`   ✓ User context works, got ${data.length} posts`)
    
    if (data.length > 0) {
        const post = data[0]
        if (typeof post.liked_by_user !== 'boolean') {
            throw new Error('liked_by_user should be boolean')
        }
        
        console.log(`   ✓ User likes properly calculated: ${post.liked_by_user}`)
    }
})

// Test 4: Startups data availability (startup info fix)
const testStartupsData = test('Startups Data Availability', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/startups?limit=5&select=id,name,description,slug,stage`
    const data = await makeApiCall(url)
    
    if (!Array.isArray(data)) {
        throw new Error('Expected array response from startups')
    }
    
    console.log(`   ✓ Startups accessible, got ${data.length} startups`)
    
    if (data.length > 0) {
        const startup = data[0]
        const requiredFields = ['id', 'name', 'slug']
        
        for (const field of requiredFields) {
            if (!(field in startup)) {
                throw new Error(`Missing required startup field: ${field}`)
            }
        }
        
        console.log(`   ✓ Startup structure valid: ${startup.name}`)
    }
})

// Test 5: Posts with startup_id (launch posts fix)
const testPostsWithStartups = test('Posts With Startup References', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/posts?startup_id=not.is.null&limit=5&select=id,type,startup_id`
    const data = await makeApiCall(url)
    
    if (!Array.isArray(data)) {
        throw new Error('Expected array response')
    }
    
    console.log(`   ✓ Found ${data.length} posts with startup references`)
    
    if (data.length > 0) {
        const post = data[0]
        if (!post.startup_id) {
            throw new Error('Expected startup_id to be present')
        }
        
        console.log(`   ✓ Launch posts have startup references: ${post.type}`)
    }
})

// Test 6: Environment variables
const testEnvironment = test('Environment Variables', async () => {
    const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
    const optional = ['NEXT_PUBLIC_DEV_EMAIL', 'NEXT_PUBLIC_DEV_PASSWORD']
    
    for (const envVar of required) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`)
        }
    }
    
    console.log('   ✓ Required environment variables present')
    
    const fakeLoginAvailable = process.env.NEXT_PUBLIC_DEV_EMAIL && process.env.NEXT_PUBLIC_DEV_PASSWORD
    console.log(`   ✓ Fake login ${fakeLoginAvailable ? 'enabled' : 'disabled'}`)
})

// Dev server management for tests
let devServer = null
let serverStarted = false

async function checkServerRunning() {
    try {
        const response = await fetch('http://localhost:3000/api/check-login?token=test-ping')
        return response.status === 400 // Expect 400 for invalid token, means server is running
    } catch (error) {
        return false // Server not running
    }
}

async function startDevServer() {
    console.log('🚀 Starting development server for tests...')
    
    // Use npm run dev with shell enabled for Windows compatibility
    console.log(`   Starting: npm run dev`)
    devServer = spawn('npm', ['run', 'dev'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: true // Enable shell for Windows compatibility
    })
    
    return new Promise((resolve, reject) => {
        
        let output = ''
        const timeout = setTimeout(() => {
            console.log('❌ Server startup timeout - continuing anyway')
            resolve()
        }, 15000) // 15 second timeout
        
        devServer.stdout.on('data', (data) => {
            output += data.toString()
            if (output.includes('Ready') || output.includes('localhost:3000')) {
                clearTimeout(timeout)
                console.log('✅ Development server started')
                serverStarted = true
                resolve()
            }
        })
        
        devServer.stderr.on('data', (data) => {
            const error = data.toString()
            if (error.includes('EADDRINUSE')) {
                clearTimeout(timeout)
                console.log('✅ Development server already running on port 3000')
                serverStarted = false // Don't need to stop it since we didn't start it
                resolve()
            }
        })
        
        devServer.on('error', (error) => {
            clearTimeout(timeout)
            console.error('❌ Failed to start dev server:', error.message)
            reject(error)
        })
    })
}

async function stopDevServer() {
    if (devServer && serverStarted) {
        console.log('🛑 Stopping development server...')
        devServer.kill('SIGTERM')
        
        // Give it time to shut down gracefully
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        if (!devServer.killed) {
            devServer.kill('SIGKILL')
        }
        
        devServer = null
        serverStarted = false
        console.log('✅ Development server stopped')
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting StartupsAreEasy Test Suite\n')
    
    let needsServerManagement = false
    
    try {
        // Run crypto and security tests first (these don't need server)
        console.log('🔐 Running Security & Crypto Tests...')
        const cryptoSuccess = await runCryptoTests()
        const securitySuccess = await runApiSecurityTests()
        
        if (!cryptoSuccess || !securitySuccess) {
            console.log('❌ Security tests failed - aborting other tests')
            process.exit(1)
        }
        
        // Check if dev server is needed and start if necessary
        console.log('🔍 Checking if development server is running...')
        const serverRunning = await checkServerRunning()
        
        if (!serverRunning) {
            needsServerManagement = true
            await startDevServer()
            // Wait a bit more for server to be fully ready
            await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
            console.log('✅ Development server already running')
        }
        
        // Run authentication flow tests (these need server)
        const authSuccess = await runAuthFlowTests()
        
        // Run API endpoints tests
        const apiSuccess = await runApiEndpointsTests()
        
        if (!authSuccess || !apiSuccess) {
            console.log('❌ Some test suites failed')
        }
        
        console.log('\n🌐 Running Integration Tests...')
        
        const tests = [
            testEnvironment,
            testDatabaseConnection,
            testPostsWithDetails,
            testPostsWithUserContext,
            testStartupsData,
            testPostsWithStartups
        ]
        
        for (const testFn of tests) {
            await testFn()
            console.log('') // Empty line between tests
        }
        
        // Summary
        console.log('📊 Test Results Summary:')
        console.log('=' .repeat(50))
        
        const passed = testResults.filter(r => r.status === 'PASS').length
        const failed = testResults.filter(r => r.status === 'FAIL').length
        
        testResults.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : '❌'
            console.log(`${icon} ${result.name}`)
            if (result.error) {
                console.log(`   └─ ${result.error}`)
            }
        })
        
        console.log('=' .repeat(50))
        console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`)
        
        if (failed > 0) {
            process.exit(1)
        }
        
    } catch (error) {
        console.error('💥 Test execution failed:', error)
        throw error
    } finally {
        // Always cleanup server if we started it
        if (needsServerManagement) {
            await stopDevServer()
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test runner failed:', error)
        process.exit(1)
    })
}

module.exports = { runTests, testResults }
