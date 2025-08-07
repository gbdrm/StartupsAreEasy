/**
 * CSRF protection utilities for state-changing operations
 */

import { logger } from './logger'
import { generateSecurePassword } from './crypto-utils'

// CSRF token management
class CSRFManager {
    private static instance: CSRFManager
    private token: string | null = null
    private readonly TOKEN_KEY = 'csrf-token'
    private readonly TOKEN_EXPIRY = 'csrf-token-expiry'
    private readonly TOKEN_LIFETIME = 60 * 60 * 1000 // 1 hour

    private constructor() {
        this.initializeToken()
    }

    static getInstance(): CSRFManager {
        if (!CSRFManager.instance) {
            CSRFManager.instance = new CSRFManager()
        }
        return CSRFManager.instance
    }

    private initializeToken(): void {
        // Skip initialization on server-side
        if (typeof window === 'undefined') {
            return
        }
        
        const storedToken = localStorage.getItem(this.TOKEN_KEY)
        const expiry = localStorage.getItem(this.TOKEN_EXPIRY)
        
        if (storedToken && expiry && Date.now() < parseInt(expiry)) {
            this.token = storedToken
            logger.debug('SYSTEM', 'CSRF: Using existing valid token')
        } else {
            this.generateNewToken()
        }
    }

    private generateNewToken(): void {
        // Skip token generation on server-side
        if (typeof window === 'undefined') {
            return
        }
        
        this.token = generateSecurePassword(32)
        const expiry = Date.now() + this.TOKEN_LIFETIME
        
        localStorage.setItem(this.TOKEN_KEY, this.token)
        localStorage.setItem(this.TOKEN_EXPIRY, expiry.toString())
        
        logger.debug('SYSTEM', 'CSRF: Generated new token')
    }

    getToken(): string {
        // Return empty string on server-side
        if (typeof window === 'undefined') {
            return ''
        }
        
        if (!this.token) {
            this.generateNewToken()
        }
        
        // Check if token is expired
        const expiry = localStorage.getItem(this.TOKEN_EXPIRY)
        if (!expiry || Date.now() >= parseInt(expiry)) {
            this.generateNewToken()
        }
        
        return this.token || ''
    }

    validateToken(receivedToken: string): boolean {
        const currentToken = this.getToken()
        return receivedToken === currentToken
    }

    refreshToken(): string {
        this.generateNewToken()
        return this.token!
    }

    clearToken(): void {
        this.token = null
        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.TOKEN_KEY)
            localStorage.removeItem(this.TOKEN_EXPIRY)
        }
    }
}

// Singleton instance
const csrfManager = CSRFManager.getInstance()

/**
 * Get current CSRF token
 */
export function getCSRFToken(): string {
    return csrfManager.getToken()
}

/**
 * Add CSRF token to request headers
 */
export function addCSRFHeaders(headers: HeadersInit = {}): HeadersInit {
    return {
        ...headers,
        'X-CSRF-Token': getCSRFToken(),
        'X-Requested-With': 'XMLHttpRequest'
    }
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(token: string): boolean {
    return csrfManager.validateToken(token)
}

/**
 * Refresh CSRF token (call after successful login)
 */
export function refreshCSRFToken(): string {
    return csrfManager.refreshToken()
}

/**
 * Clear CSRF token (call on logout)
 */
export function clearCSRFToken(): void {
    csrfManager.clearToken()
}

/**
 * Enhanced fetch function with CSRF protection
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method?.toLowerCase() || 'get'
    
    // Add CSRF protection for state-changing methods
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
        options.headers = addCSRFHeaders(options.headers)
    }
    
    const response = await fetch(url, options)
    
    // Handle CSRF token mismatch
    if (response.status === 403) {
        const errorText = await response.text()
        if (errorText.includes('CSRF') || errorText.includes('csrf')) {
            logger.warn('SYSTEM', 'CSRF token mismatch, refreshing token')
            refreshCSRFToken()
            
            // Retry with new token
            if (['post', 'put', 'patch', 'delete'].includes(method)) {
                options.headers = addCSRFHeaders(options.headers)
            }
            return fetch(url, options)
        }
    }
    
    return response
}

/**
 * Form data helper with CSRF token
 */
export function addCSRFToFormData(formData: FormData): FormData {
    formData.append('csrf_token', getCSRFToken())
    return formData
}

/**
 * URL search params helper with CSRF token
 */
export function addCSRFToParams(params: URLSearchParams): URLSearchParams {
    params.append('csrf_token', getCSRFToken())
    return params
}