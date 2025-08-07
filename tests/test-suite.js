// Test suite for StartupsAreEasy functionality
// Run with: npm run test

const fs = require('fs');
const path = require('path');
const { runCryptoTests } = require('./crypto-utils.test.js');
const { runApiSecurityTests } = require('./api-security.test.js');

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

// Main test runner
async function runTests() {
    console.log('🚀 Starting StartupsAreEasy Test Suite\n')
    
    // Run crypto and security tests first
    console.log('🔐 Running Security & Crypto Tests...')
    const cryptoSuccess = await runCryptoTests()
    const securitySuccess = await runApiSecurityTests()
    
    if (!cryptoSuccess || !securitySuccess) {
        console.log('❌ Security tests failed - aborting integration tests')
        process.exit(1)
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
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test runner failed:', error)
        process.exit(1)
    })
}

module.exports = { runTests, testResults }
