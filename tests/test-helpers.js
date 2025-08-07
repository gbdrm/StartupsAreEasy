// Shared test utilities and helpers

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if not already loaded
function loadEnvironment() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
    }
}

// Ensure environment is loaded
loadEnvironment();

// Test configuration
const TEST_CONFIG = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    TEST_USER_ID: '6eb31970-00df-4049-9bab-409bed21962e', // Fake user for testing
    DEV_SERVER_URL: 'http://localhost:3000'
}

// Helper function to make API calls with proper headers
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

// Helper function to make requests to local development server
async function makeLocalApiCall(endpoint, options = {}) {
    const url = `${TEST_CONFIG.DEV_SERVER_URL}${endpoint}`
    const response = await fetch(url, options)
    
    return {
        response,
        data: response.headers.get('content-type')?.includes('application/json') 
            ? await response.json()
            : await response.text()
    }
}

// Performance timing helper
function timeFunction(fn) {
    return async (...args) => {
        const start = Date.now()
        const result = await fn(...args)
        const duration = Date.now() - start
        return { result, duration }
    }
}

// Mock data generators
const mockDataGenerators = {
    // Generate a secure token-like string
    generateMockToken: (length = 48) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
        let result = ''
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    },
    
    // Generate mock user data
    generateMockUser: () => ({
        id: `test-user-${Date.now()}`,
        name: 'Test User',
        username: `testuser${Date.now()}`,
        avatar: '/placeholder-avatar.svg',
        email: `test${Date.now()}@example.com`
    }),
    
    // Generate mock post data
    generateMockPost: () => ({
        id: `test-post-${Date.now()}`,
        type: 'post',
        content: 'This is a test post',
        likes_count: 0,
        comments_count: 0,
        liked_by_user: false,
        created_at: new Date().toISOString()
    })
}

// Validation helpers
const validators = {
    isValidUUID: (str) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(str)
    },
    
    isValidEmail: (str) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(str)
    },
    
    isValidToken: (str) => {
        // Check for base64url format (48 chars) or legacy login_ format
        const newFormat = /^[A-Za-z0-9_-]{48}$/
        const legacyFormat = str.startsWith('login_') && str.length >= 20
        return newFormat.test(str) || legacyFormat
    },
    
    hasRequiredPostFields: (post) => {
        const required = ['id', 'user_id', 'type', 'content', 'created_at']
        return required.every(field => field in post)
    },
    
    hasRequiredUserFields: (user) => {
        const required = ['id', 'name', 'username']
        return required.every(field => field in user)
    }
}

// Test environment helpers
const testEnvironment = {
    isDevelopment: () => process.env.NODE_ENV === 'development',
    isProduction: () => process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
    hasRequiredEnvVars: () => {
        const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
        return required.every(envVar => !!process.env[envVar])
    }
}

// Response time tracker
class ResponseTimeTracker {
    constructor() {
        this.times = []
    }
    
    async track(fn) {
        const start = Date.now()
        const result = await fn()
        const duration = Date.now() - start
        this.times.push(duration)
        return { result, duration }
    }
    
    getStats() {
        if (this.times.length === 0) return { avg: 0, min: 0, max: 0, count: 0 }
        
        const sum = this.times.reduce((a, b) => a + b, 0)
        const avg = sum / this.times.length
        const min = Math.min(...this.times)
        const max = Math.max(...this.times)
        
        return { avg: Math.round(avg), min, max, count: this.times.length }
    }
}

// Error assertion helpers
const assertions = {
    assertEquals: (actual, expected, message) => {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`)
        }
    },
    
    assertTrue: (condition, message) => {
        if (!condition) {
            throw new Error(message || 'Assertion failed: expected true')
        }
    },
    
    assertFalse: (condition, message) => {
        if (condition) {
            throw new Error(message || 'Assertion failed: expected false')
        }
    },
    
    assertThrows: async (fn, message) => {
        let threw = false
        try {
            await fn()
        } catch (error) {
            threw = true
        }
        if (!threw) {
            throw new Error(message || 'Expected function to throw an error')
        }
    },
    
    assertContains: (array, item, message) => {
        if (!array.includes(item)) {
            throw new Error(message || `Expected array to contain ${item}`)
        }
    }
}

module.exports = {
    TEST_CONFIG,
    makeApiCall,
    makeLocalApiCall,
    timeFunction,
    mockDataGenerators,
    validators,
    testEnvironment,
    ResponseTimeTracker,
    assertions,
    loadEnvironment
}