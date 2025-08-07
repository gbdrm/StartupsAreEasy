/**
 * Cryptographic utilities for secure password generation and validation
 */

/**
 * Generates a cryptographically secure random password
 * @param length Password length (default: 32)
 * @param urlSafe Whether to use URL-safe characters only (default: false)
 * @returns Secure random password
 */
export function generateSecurePassword(length: number = 32, urlSafe: boolean = false): string {
    const charset = urlSafe 
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const array = new Uint8Array(length)
    
    // Use crypto.getRandomValues for cryptographically secure randomness
    crypto.getRandomValues(array)
    
    let password = ''
    for (let i = 0; i < length; i++) {
        password += charset[array[i] % charset.length]
    }
    
    return password
}

/**
 * Generates a secure login token optimized for Telegram (under 64 chars)
 * Uses base64url encoding for maximum entropy in minimal space
 * @returns Secure login token safe for Telegram start parameters
 */
export function generateSecureLoginToken(): string {
    // Create 36 bytes of random data to get exactly 48 base64url chars
    // (36 bytes * 4/3 = 48 characters)
    const randomBytes = new Uint8Array(36)
    crypto.getRandomValues(randomBytes)
    
    // Convert to base64url (no padding, URL-safe)
    const base64 = btoa(String.fromCharCode(...randomBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    
    // Should be exactly 48 characters
    return base64
}

/**
 * Generates a secure session token
 * @returns Secure session token  
 */
export function generateSecureSessionToken(): string {
    const uuid = crypto.randomUUID()
    const timestamp = Date.now()
    const entropy = generateSecurePassword(20)
    
    return `session_${uuid}_${timestamp}_${entropy}`
}

/**
 * Hash a password using Web Crypto API (for client-side hashing)
 * Note: This should primarily be used for validation, not storage
 * @param password Password to hash
 * @param salt Optional salt (generated if not provided)
 * @returns Promise with hash and salt
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string, salt: string }> {
    const encoder = new TextEncoder()
    
    // Generate salt if not provided
    if (!salt) {
        const saltArray = new Uint8Array(16)
        crypto.getRandomValues(saltArray)
        salt = Array.from(saltArray, byte => byte.toString(16).padStart(2, '0')).join('')
    }
    
    // Combine password and salt
    const data = encoder.encode(password + salt)
    
    // Hash using SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = new Uint8Array(hashBuffer)
    const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('')
    
    return { hash, salt }
}

/**
 * Verify a password against a hash
 * @param password Password to verify
 * @param hash Expected hash
 * @param salt Salt used in original hash
 * @returns Promise<boolean> indicating if password matches
 */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const result = await hashPassword(password, salt)
    return result.hash === hash
}

/**
 * Generate a secure API key
 * @param prefix Optional prefix (default: 'sk')
 * @returns Secure API key
 */
export function generateApiKey(prefix: string = 'sk'): string {
    const randomPart = generateSecurePassword(48)
    const timestamp = Date.now().toString(36)
    
    return `${prefix}_${timestamp}_${randomPart}`
}

/**
 * Validate that a string has sufficient entropy for security
 * @param input String to validate
 * @param minLength Minimum required length
 * @returns boolean indicating if string is sufficiently secure
 */
export function validateEntropy(input: string, minLength: number = 20): boolean {
    if (input.length < minLength) {
        return false
    }
    
    // Check for character variety
    const hasLower = /[a-z]/.test(input)
    const hasUpper = /[A-Z]/.test(input)
    const hasNumber = /[0-9]/.test(input)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(input)
    
    const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
    
    // Require at least 3 types of characters for good entropy
    return varietyCount >= 3
}