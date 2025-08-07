// Tests for API security and error handling
async function runApiSecurityTests() {
    console.log('🔒 Running API security tests...\n')

    let passed = 0
    let failed = 0

    function test(name, fn) {
        try {
            fn()
            console.log(`✅ ${name}`)
            passed++
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`)
            failed++
        }
    }

    // Test rate limiting functionality
    test('Rate limiting - basic functionality', () => {
        // Simulate the rate limiting logic
        const rateLimitMap = new Map()
        const RATE_LIMIT_WINDOW = 1000 // 1 second
        const MAX_REQUESTS_PER_WINDOW = 10

        function checkRateLimit(key) {
            const now = Date.now()
            const requests = rateLimitMap.get(key) || 0

            if (requests >= MAX_REQUESTS_PER_WINDOW) {
                return false
            }

            rateLimitMap.set(key, requests + 1)
            return true
        }

        // Should allow initial requests
        if (!checkRateLimit('test-key')) {
            throw new Error('Should allow initial requests')
        }

        // Should block after limit
        for (let i = 0; i < MAX_REQUESTS_PER_WINDOW; i++) {
            checkRateLimit('test-key')
        }

        if (checkRateLimit('test-key')) {
            throw new Error('Should block requests after limit exceeded')
        }
    })

    // Test CSRF token validation
    test('CSRF token format validation', () => {
        // Simulate CSRF token validation
        function validateCSRFToken(token) {
            if (!token || typeof token !== 'string') {
                return false
            }

            if (token.length < 20) {
                return false
            }

            // Should contain only safe characters
            const safeCharsRegex = /^[A-Za-z0-9\-_]+$/
            return safeCharsRegex.test(token)
        }

        // Valid tokens
        const validToken = 'abc123def456ghi789jkl012mno345pqr678stu901'
        if (!validateCSRFToken(validToken)) {
            throw new Error('Valid token should pass validation')
        }

        // Invalid tokens
        const invalidTokens = [
            '',
            'short',
            'invalid!@#$%',
            null,
            undefined,
            123
        ]

        invalidTokens.forEach((token, index) => {
            if (validateCSRFToken(token)) {
                throw new Error(`Invalid token ${index} should fail validation`)
            }
        })
    })

    // Test SQL injection prevention
    test('Input sanitization', () => {
        // Simulate input validation
        function sanitizeInput(input) {
            if (typeof input !== 'string') {
                return String(input)
            }

            // Check for SQL injection patterns
            const sqlPatterns = [
                /(\b(select|insert|update|delete|drop|union|exec|execute)\b)/i,
                /(;|--|\/\*|\*\/)/,
                /(\bor\b|\band\b).*[=<>]/i
            ]

            const hasSqlPattern = sqlPatterns.some(pattern => pattern.test(input))
            if (hasSqlPattern) {
                throw new Error('Input contains potentially dangerous SQL patterns')
            }

            return input.replace(/[<>&"']/g, '').trim()
        }

        // Safe inputs
        const safeInputs = [
            'Hello World',
            'user123',
            'My startup idea',
            ''
        ]

        safeInputs.forEach(input => {
            try {
                sanitizeInput(input)
            } catch (error) {
                throw new Error(`Safe input "${input}" was rejected: ${error.message}`)
            }
        })

        // Dangerous inputs
        const dangerousInputs = [
            "'; DROP TABLE users; --",
            "1 OR 1=1",
            "UNION SELECT * FROM passwords",
            "exec xp_cmdshell 'dir'"
        ]

        dangerousInputs.forEach(input => {
            try {
                sanitizeInput(input)
                throw new Error(`Dangerous input "${input}" was not caught`)
            } catch (error) {
                // Expected to throw
                if (!error.message.includes('SQL patterns')) {
                    throw error
                }
            }
        })
    })

    // Test error handling patterns
    test('Error message sanitization', () => {
        function sanitizeErrorMessage(error) {
            const message = error.message || 'Unknown error'

            // Remove sensitive information patterns
            const sanitized = message
                .replace(/password[:\s=][\w\d]+/gi, 'password: [REDACTED]')
                .replace(/token[:\s=][\w\d\-_\.]+/gi, 'token: [REDACTED]')
                .replace(/key[:\s=][\w\d\-_\.]+/gi, 'key: [REDACTED]')
                .replace(/secret[:\s=][\w\d\-_\.]+/gi, 'secret: [REDACTED]')
                .replace(/\b\d{4,}\b/g, '[REDACTED]') // Long numbers (could be IDs)

            return sanitized
        }

        const sensitiveError = new Error('Login failed: password=mySecret123 token=abc123def456 user_id=12345')
        const sanitized = sanitizeErrorMessage(sensitiveError)

        if (sanitized.includes('mySecret123') || sanitized.includes('abc123def456') || sanitized.includes('12345')) {
            throw new Error('Error message still contains sensitive information')
        }

        if (!sanitized.includes('[REDACTED]')) {
            throw new Error('Sensitive parts should be redacted')
        }
    })

    // Test request validation
    test('Request payload validation', () => {
        function validatePostPayload(payload) {
            if (!payload || typeof payload !== 'object') {
                throw new Error('Invalid payload format')
            }

            const requiredFields = ['type', 'content']
            const allowedTypes = ['post', 'idea', 'launch', 'progress']

            requiredFields.forEach(field => {
                if (!payload[field]) {
                    throw new Error(`Missing required field: ${field}`)
                }
            })

            if (!allowedTypes.includes(payload.type)) {
                throw new Error(`Invalid post type: ${payload.type}`)
            }

            if (payload.content.length > 5000) {
                throw new Error('Content too long')
            }

            if (payload.link && !isValidURL(payload.link)) {
                throw new Error('Invalid URL format')
            }

            return true
        }

        function isValidURL(string) {
            try {
                new URL(string)
                return true
            } catch (_) {
                return false
            }
        }

        // Valid payload
        const validPayload = {
            type: 'post',
            content: 'This is a valid post',
            link: 'https://example.com'
        }

        if (!validatePostPayload(validPayload)) {
            throw new Error('Valid payload should pass validation')
        }

        // Invalid payloads
        const invalidPayloads = [
            { type: 'post' }, // Missing content
            { content: 'test' }, // Missing type
            { type: 'invalid', content: 'test' }, // Invalid type
            { type: 'post', content: 'a'.repeat(5001) }, // Too long
            { type: 'post', content: 'test', link: 'not-a-url' } // Invalid URL
        ]

        invalidPayloads.forEach((payload, index) => {
            try {
                validatePostPayload(payload)
                throw new Error(`Invalid payload ${index} should fail validation`)
            } catch (error) {
                // Expected to throw
                if (error.message.includes('should fail validation')) {
                    throw error
                }
            }
        })
    })

    console.log(`\n🔒 API Security Tests Complete: ${passed} passed, ${failed} failed`)
    return failed === 0
}

module.exports = { runApiSecurityTests }

// Run tests if this file is executed directly
if (require.main === module) {
    runApiSecurityTests().then(success => {
        process.exit(success ? 0 : 1)
    })
}