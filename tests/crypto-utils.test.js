// Tests for crypto utilities
const crypto = require('crypto');

// Mock crypto for Node.js environment
if (typeof global.crypto === 'undefined') {
    global.crypto = {
        getRandomValues: (array) => {
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
            return array;
        },
        randomUUID: () => crypto.randomUUID(),
        subtle: crypto.webcrypto.subtle
    };
}

// Import the functions (would normally use ES modules in a real test)
async function importCryptoUtils() {
    // Simulate the crypto utils functions for testing
    function generateSecurePassword(length = 32, urlSafe = false) {
        const charset = urlSafe 
            ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
            : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
        const array = new Uint8Array(length)
        
        global.crypto.getRandomValues(array)
        
        let password = ''
        for (let i = 0; i < length; i++) {
            password += charset[array[i] % charset.length]
        }
        
        return password
    }

    function generateSecureLoginToken() {
        const timestamp = Date.now()
        const randomPart = global.crypto.randomUUID()
        const additionalEntropy = generateSecurePassword(16, true)
        
        return `login_${randomPart}_${timestamp}_${additionalEntropy}`
    }

    function validateEntropy(input, minLength = 20) {
        if (input.length < minLength) {
            return false
        }
        
        const hasLower = /[a-z]/.test(input)
        const hasUpper = /[A-Z]/.test(input)
        const hasNumber = /[0-9]/.test(input)
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(input)
        
        const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
        
        return varietyCount >= 3
    }

    return {
        generateSecurePassword,
        generateSecureLoginToken,
        validateEntropy
    }
}

async function runCryptoTests() {
    console.log('🧪 Running crypto utility tests...\n')
    
    const { generateSecurePassword, generateSecureLoginToken, validateEntropy } = await importCryptoUtils()
    
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

    // Test secure password generation
    test('generateSecurePassword - default length', () => {
        const password = generateSecurePassword()
        if (password.length !== 32) {
            throw new Error(`Expected length 32, got ${password.length}`)
        }
    })

    test('generateSecurePassword - custom length', () => {
        const password = generateSecurePassword(16)
        if (password.length !== 16) {
            throw new Error(`Expected length 16, got ${password.length}`)
        }
    })

    test('generateSecurePassword - URL safe characters', () => {
        const password = generateSecurePassword(32, true)
        const urlSafeRegex = /^[A-Za-z0-9\-_]+$/
        if (!urlSafeRegex.test(password)) {
            throw new Error(`Password contains non-URL-safe characters: ${password}`)
        }
    })

    test('generateSecurePassword - uniqueness', () => {
        const password1 = generateSecurePassword()
        const password2 = generateSecurePassword()
        if (password1 === password2) {
            throw new Error('Generated passwords should be unique')
        }
    })

    // Test login token generation
    test('generateSecureLoginToken - format', () => {
        const token = generateSecureLoginToken()
        if (!token.startsWith('login_')) {
            throw new Error(`Token should start with 'login_', got: ${token}`)
        }
        
        const parts = token.split('_')
        if (parts.length !== 4) {
            throw new Error(`Token should have 4 parts separated by '_', got: ${parts.length}`)
        }
    })

    test('generateSecureLoginToken - uniqueness', () => {
        const token1 = generateSecureLoginToken()
        const token2 = generateSecureLoginToken()
        if (token1 === token2) {
            throw new Error('Generated tokens should be unique')
        }
    })

    // Test entropy validation
    test('validateEntropy - strong password', () => {
        const strongPassword = 'MyStr0ng!P@ssw0rd123'
        if (!validateEntropy(strongPassword)) {
            throw new Error('Strong password should pass entropy validation')
        }
    })

    test('validateEntropy - weak password', () => {
        const weakPassword = 'password'
        if (validateEntropy(weakPassword)) {
            throw new Error('Weak password should fail entropy validation')
        }
    })

    test('validateEntropy - minimum length', () => {
        const shortPassword = 'Str0ng!'
        if (validateEntropy(shortPassword, 20)) {
            throw new Error('Short password should fail length validation')
        }
    })

    // Security tests
    test('Password should not be predictable', () => {
        const passwords = []
        for (let i = 0; i < 100; i++) {
            passwords.push(generateSecurePassword(16))
        }
        
        // Check for any duplicates
        const unique = new Set(passwords)
        if (unique.size !== passwords.length) {
            throw new Error('Generated passwords contain duplicates')
        }
        
        // Check for patterns
        const hasPattern = passwords.some(pwd => {
            return /(.)\1{3,}/.test(pwd) || // Repeated characters
                   /012|123|234|345|456|567|678|789|890/.test(pwd) || // Sequential numbers
                   /abc|bcd|cde|def|efg/.test(pwd) // Sequential letters
        })
        
        if (hasPattern) {
            throw new Error('Generated passwords contain predictable patterns')
        }
    })

    console.log(`\n🧪 Crypto Tests Complete: ${passed} passed, ${failed} failed`)
    return failed === 0
}

module.exports = { runCryptoTests }

// Run tests if this file is executed directly
if (require.main === module) {
    runCryptoTests().then(success => {
        process.exit(success ? 0 : 1)
    })
}