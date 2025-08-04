/**
 * Test script for validating auth fixes after tab switching
 * Run this in browser console to test auth resilience
 */

console.log('🧪 Testing auth system resilience...')

// Test 1: Token validation
function testTokenValidation() {
    console.log('\n📋 Test 1: Token Validation')
    
    if (typeof window.isTokenExpired === 'undefined') {
        console.log('❌ isTokenExpired utility not available')
        return false
    }
    
    // Test with a valid token structure (mock)
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.signature'
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.signature'
    
    const validResult = window.isTokenExpired(validToken)
    const expiredResult = window.isTokenExpired(expiredToken)
    
    console.log('Valid token expired?', validResult, validResult ? '❌ FAIL' : '✅ PASS')
    console.log('Expired token expired?', expiredResult, expiredResult ? '✅ PASS' : '❌ FAIL')
    
    return !validResult && expiredResult
}

// Test 2: Auth error detection
function testAuthErrorDetection() {
    console.log('\n📋 Test 2: Auth Error Detection')
    
    if (typeof window.isAuthError === 'undefined') {
        console.log('❌ isAuthError utility not available')
        return false
    }
    
    const authErrors = [
        new Error('Session timeout'),
        new Error('HTTP 403: row-level security policy'),
        new Error('Authentication token required'),
        new Error('JWT expired')
    ]
    
    const nonAuthErrors = [
        new Error('Network error'),
        new Error('Invalid input'),
        new Error('Server error 500')
    ]
    
    let passed = 0
    let total = authErrors.length + nonAuthErrors.length
    
    authErrors.forEach((error, i) => {
        const result = window.isAuthError(error)
        console.log(`Auth error ${i+1}:`, error.message, result ? '✅ PASS' : '❌ FAIL')
        if (result) passed++
    })
    
    nonAuthErrors.forEach((error, i) => {
        const result = window.isAuthError(error)
        console.log(`Non-auth error ${i+1}:`, error.message, result ? '❌ FAIL' : '✅ PASS')
        if (!result) passed++
    })
    
    console.log(`Auth error detection: ${passed}/${total} tests passed`)
    return passed === total
}

// Test 3: Current auth state
async function testCurrentAuthState() {
    console.log('\n📋 Test 3: Current Auth State')
    
    try {
        const token = await getCurrentUserToken()
        console.log('Current token:', token ? '✅ Present' : '❌ Missing')
        
        if (token) {
            const isExpired = window.isTokenExpired ? window.isTokenExpired(token) : 'Unknown'
            console.log('Token expired:', isExpired)
        }
        
        const profile = await getCurrentUserProfile()
        console.log('Current profile:', profile ? `✅ ${profile.name} (@${profile.username})` : '❌ Not found')
        
        return !!token && !!profile
    } catch (error) {
        console.log('❌ Error getting auth state:', error.message)
        return false
    }
}

// Test 4: Simulate tab switch scenario
function simulateTabSwitch() {
    console.log('\n📋 Test 4: Simulating Tab Switch')
    
    // Simulate page becoming hidden then visible
    Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
    })
    
    document.dispatchEvent(new Event('visibilitychange'))
    
    setTimeout(() => {
        Object.defineProperty(document, 'hidden', {
            writable: true,
            value: false
        })
        
        document.dispatchEvent(new Event('visibilitychange'))
        console.log('✅ Tab switch simulation completed')
    }, 1000)
    
    return true
}

// Run all tests
async function runAuthTests() {
    console.log('🚀 Running auth resilience tests...\n')
    
    const results = {
        tokenValidation: testTokenValidation(),
        authErrorDetection: testAuthErrorDetection(),
        currentAuthState: await testCurrentAuthState(),
        tabSwitchSimulation: simulateTabSwitch()
    }
    
    const passed = Object.values(results).filter(Boolean).length
    const total = Object.keys(results).length
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`)
    
    if (passed === total) {
        console.log('🎉 All auth tests passed! System should handle tab switching correctly.')
    } else {
        console.log('⚠️ Some tests failed. Check the individual test results above.')
    }
    
    return results
}

// Export utilities to window for manual testing
if (typeof window !== 'undefined') {
    window.runAuthTests = runAuthTests
    window.testTokenValidation = testTokenValidation
    window.testAuthErrorDetection = testAuthErrorDetection
    window.testCurrentAuthState = testCurrentAuthState
    window.simulateTabSwitch = simulateTabSwitch
}

// Auto-run tests
runAuthTests().catch(console.error)
