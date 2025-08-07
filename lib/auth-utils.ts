/**
 * Authentication utility functions for handling token validation and recovery
 */

import { logger } from './logger'
import { getCurrentUserToken } from './auth'

/**
 * Validates if a JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const now = Math.floor(Date.now() / 1000)
        return payload.exp && payload.exp < now
    } catch (error) {
        logger.error('AUTH', 'Error parsing token for expiration check:', error)
        return true // Assume expired if we can't parse it
    }
}

/**
 * Checks if an error is auth-related and should trigger a refresh
 */
export function isAuthError(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    const errorMessage = error.message.toLowerCase()

    return (
        errorMessage.includes('session timeout') ||
        errorMessage.includes('authentication token required') ||
        errorMessage.includes('row-level security policy') ||
        errorMessage.includes('403') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('auth')
    )
}

/**
 * Gets a valid token, handling refresh if needed
 */
export async function getValidToken(): Promise<string | null> {
    try {
        const token = await getCurrentUserToken()

        if (!token) {
            logger.warn('AUTH', 'getValidToken: No token available')
            return null
        }

        if (isTokenExpired(token)) {
            logger.warn('AUTH', 'getValidToken: Token is expired, triggering refresh')
            window.location.reload()
            return null
        }

        return token
    } catch (error) {
        logger.error('AUTH', 'getValidToken: Error getting token:', error)

        if (isAuthError(error)) {
            logger.info('AUTH', 'getValidToken: Auth error detected, triggering page reload')
            window.location.reload()
        }

        return null
    }
}

/**
 * Handles API call errors by checking for auth issues and triggering refresh
 */
export function handleApiError(error: unknown, operation: string): never {
    logger.error('API', `API Error in ${operation}:`, error)

    if (isAuthError(error)) {
        logger.info('AUTH', `Auth error detected in ${operation}, triggering page reload`)
        window.location.reload()
    }

    throw error
}

/**
 * Wrapper for API calls that handles auth errors automatically
 */
export async function withAuthErrorHandling<T>(
    apiCall: () => Promise<T>,
    operation: string
): Promise<T> {
    try {
        return await apiCall()
    } catch (error) {
        handleApiError(error, operation)
    }
}

// Add utilities to window for debugging in browser console
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).isTokenExpired = isTokenExpired;
    (window as unknown as Record<string, unknown>).isAuthError = isAuthError;
    (window as unknown as Record<string, unknown>).getValidToken = getValidToken;
    (window as unknown as Record<string, unknown>).handleApiError = handleApiError;
    (window as unknown as Record<string, unknown>).withAuthErrorHandling = withAuthErrorHandling;
}
