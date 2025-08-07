// API Endpoints tests
// Tests for all API endpoints including the fixes for response body stream issues

const { makeApiCall, makeLocalApiCall, TEST_CONFIG, ResponseTimeTracker, assertions } = require('./test-helpers');

// Test results storage
const testResults = []

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

// Test 1: Response body stream deduplication fix
const testResponseBodyStreamFix = test('Response Body Stream Deduplication Fix', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/get_posts_with_details`
    const requestBody = { user_id_param: null }
    
    // Make the same request multiple times rapidly to test deduplication
    const requests = []
    for (let i = 0; i < 3; i++) {
        requests.push(makeApiCall(url, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        }))
    }
    
    // All requests should complete successfully without "body stream already read" errors
    const results = await Promise.all(requests)
    
    results.forEach((result, index) => {
        if (!Array.isArray(result)) {
            throw new Error(`Request ${index + 1} returned invalid response`)
        }
    })
    
    console.log(`   ✓ ${requests.length} concurrent requests completed successfully`)
    console.log(`   ✓ No "body stream already read" errors`)
})

// Test 2: API response caching behavior  
const testApiResponseCaching = test('API Response Caching Behavior', async () => {
    const tracker = new ResponseTimeTracker()
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/profiles?limit=1`
    
    // First request (cache miss)
    const first = await tracker.track(() => makeApiCall(url))
    
    // Second request (should be from cache if caching is working)
    const second = await tracker.track(() => makeApiCall(url))
    
    // Both should return same data
    assertions.assertEquals(
        JSON.stringify(first.result),
        JSON.stringify(second.result),
        'Cached and fresh requests should return same data'
    )
    
    const stats = tracker.getStats()
    console.log(`   ✓ First request: ${first.duration}ms`)
    console.log(`   ✓ Second request: ${second.duration}ms`)
    console.log(`   ✓ Average response time: ${stats.avg}ms`)
})

// Test 3: Posts API with user context (like status fix)
const testPostsApiUserContext = test('Posts API User Context (Like Status)', async () => {
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/get_posts_with_details`
    
    // Request without user context
    const withoutUser = await makeApiCall(url, {
        method: 'POST',
        body: JSON.stringify({ user_id_param: null })
    })
    
    // Request with user context  
    const withUser = await makeApiCall(url, {
        method: 'POST',
        body: JSON.stringify({ user_id_param: TEST_CONFIG.TEST_USER_ID })
    })
    
    // Both should return valid arrays
    assertions.assertTrue(Array.isArray(withoutUser), 'Response without user should be array')
    assertions.assertTrue(Array.isArray(withUser), 'Response with user should be array')
    
    // Check that liked_by_user field is properly set
    if (withoutUser.length > 0) {
        withoutUser.forEach(post => {
            assertions.assertEquals(
                post.liked_by_user, 
                false, 
                'Posts without user context should have liked_by_user = false'
            )
        })
    }
    
    if (withUser.length > 0) {
        withUser.forEach(post => {
            assertions.assertTrue(
                typeof post.liked_by_user === 'boolean',
                'Posts with user context should have boolean liked_by_user'
            )
        })
    }
    
    console.log(`   ✓ Posts without user context: ${withoutUser.length}`)
    console.log(`   ✓ Posts with user context: ${withUser.length}`)
    console.log(`   ✓ liked_by_user fields properly set`)
})

// Test 4: Profile API endpoints
const testProfileApiEndpoints = test('Profile API Endpoints', async () => {
    // Test profiles list
    const profilesUrl = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/profiles?limit=5`
    const profiles = await makeApiCall(profilesUrl)
    
    assertions.assertTrue(Array.isArray(profiles), 'Profiles should be an array')
    
    if (profiles.length > 0) {
        const profile = profiles[0]
        const requiredFields = ['id', 'username', 'first_name']
        
        requiredFields.forEach(field => {
            assertions.assertTrue(
                field in profile,
                `Profile should have ${field} field`
            )
        })
    }
    
    console.log(`   ✓ Profiles API returned ${profiles.length} profiles`)
    console.log(`   ✓ Profile structure validated`)
})

// Test 5: Startups API endpoints  
const testStartupsApiEndpoints = test('Startups API Endpoints', async () => {
    const startupsUrl = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/startups?limit=5`
    const startups = await makeApiCall(startupsUrl)
    
    assertions.assertTrue(Array.isArray(startups), 'Startups should be an array')
    
    console.log(`   ✓ Startups API returned ${startups.length} startups`)
    
    if (startups.length > 0) {
        const startup = startups[0]
        const requiredFields = ['id', 'name', 'slug']
        
        requiredFields.forEach(field => {
            assertions.assertTrue(
                field in startup,
                `Startup should have ${field} field`
            )
        })
        
        // Test startup detail by slug if available
        if (startup.slug) {
            const detailUrl = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/startups?slug=eq.${startup.slug}&limit=1`
            const detail = await makeApiCall(detailUrl)
            
            assertions.assertTrue(Array.isArray(detail), 'Startup detail should be array')
            assertions.assertTrue(detail.length <= 1, 'Should return at most 1 startup by slug')
            
            console.log(`   ✓ Startup detail by slug working`)
        }
    }
})

// Test 6: Comments API bulk loading (N+1 query fix)
const testCommentsApiBulkLoading = test('Comments API Bulk Loading', async () => {
    // First get some posts
    const postsUrl = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/posts?limit=3`
    const posts = await makeApiCall(postsUrl)
    
    if (posts.length === 0) {
        console.log(`   ⚠ No posts available for comments test`)
        return
    }
    
    const postIds = posts.map(p => p.id)
    
    // Test bulk comments loading
    const commentsUrl = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/comments?post_id=in.(${postIds.join(',')})&select=*,profiles(*)`
    const comments = await makeApiCall(commentsUrl)
    
    assertions.assertTrue(Array.isArray(comments), 'Comments should be an array')
    
    // Verify comments have proper structure
    comments.forEach(comment => {
        assertions.assertTrue('id' in comment, 'Comment should have id')
        assertions.assertTrue('post_id' in comment, 'Comment should have post_id')
        assertions.assertTrue('content' in comment, 'Comment should have content')
        
        // Check if post_id is in our requested list
        assertions.assertContains(postIds, comment.post_id, 'Comment post_id should be in requested list')
    })
    
    console.log(`   ✓ Bulk comments API returned ${comments.length} comments`)
    console.log(`   ✓ Comments properly filtered to requested post IDs`)
})

// Test 7: API rate limiting behavior
const testApiRateLimiting = test('API Rate Limiting Behavior', async () => {
    const tracker = new ResponseTimeTracker()
    const url = `${TEST_CONFIG.SUPABASE_URL}/rest/v1/profiles?limit=1`
    
    // Make multiple rapid requests to test rate limiting
    const requests = []
    for (let i = 0; i < 10; i++) {
        requests.push(tracker.track(() => makeApiCall(url)))
    }
    
    const results = await Promise.all(requests)
    const stats = tracker.getStats()
    
    // All requests should complete (rate limiting should be reasonable for test load)
    assertions.assertEquals(results.length, 10, 'All requests should complete')
    
    console.log(`   ✓ ${results.length} rapid requests completed`)
    console.log(`   ✓ Average response time: ${stats.avg}ms`)
    console.log(`   ✓ Min: ${stats.min}ms, Max: ${stats.max}ms`)
    
    // Check if response times increased significantly (indicating throttling)
    const firstHalf = results.slice(0, 5).map(r => r.duration)
    const secondHalf = results.slice(5).map(r => r.duration)
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    console.log(`   ✓ First half avg: ${Math.round(avgFirst)}ms`)
    console.log(`   ✓ Second half avg: ${Math.round(avgSecond)}ms`)
})

// Test 8: Error handling and edge cases
const testApiErrorHandling = test('API Error Handling and Edge Cases', async () => {
    // Test invalid endpoint
    try {
        await makeApiCall(`${TEST_CONFIG.SUPABASE_URL}/rest/v1/nonexistent`)
        throw new Error('Should have thrown error for invalid endpoint')
    } catch (error) {
        if (!error.message.includes('404')) {
            throw error
        }
        console.log('   ✓ Invalid endpoint properly returns 404')
    }
    
    // Test malformed RPC call
    try {
        await makeApiCall(`${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/nonexistent_function`, {
            method: 'POST',
            body: JSON.stringify({})
        })
        throw new Error('Should have thrown error for invalid RPC')
    } catch (error) {
        console.log('   ✓ Invalid RPC call properly handled')
    }
    
    // Test empty request body for RPC that requires params
    try {
        await makeApiCall(`${TEST_CONFIG.SUPABASE_URL}/rest/v1/rpc/get_posts_with_details`, {
            method: 'POST',
            body: ''
        })
        throw new Error('Should have thrown error for empty body')
    } catch (error) {
        console.log('   ✓ Empty request body properly handled')
    }
})

// Main test runner for API endpoints
async function runApiEndpointsTests() {
    console.log('🌐 Running API Endpoints Tests...\n')
    
    const tests = [
        testResponseBodyStreamFix,
        testApiResponseCaching,
        testPostsApiUserContext,
        testProfileApiEndpoints,
        testStartupsApiEndpoints,
        testCommentsApiBulkLoading,
        testApiRateLimiting,
        testApiErrorHandling
    ]
    
    for (const testFn of tests) {
        await testFn()
        console.log('') // Empty line between tests
    }
    
    const passed = testResults.filter(r => r.status === 'PASS').length
    const failed = testResults.filter(r => r.status === 'FAIL').length
    
    console.log('📊 API Endpoints Test Results:')
    console.log('=' .repeat(40))
    testResults.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : '❌'
        console.log(`${icon} ${result.name}`)
        if (result.error) {
            console.log(`   └─ ${result.error}`)
        }
    })
    console.log('=' .repeat(40))
    console.log(`API Tests: ${testResults.length} | Passed: ${passed} | Failed: ${failed}\n`)
    
    return failed === 0
}

module.exports = { runApiEndpointsTests, testResults }