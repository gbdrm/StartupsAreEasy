/**
 * Storage utility functions to prevent conflicts between multiple tabs
 * and ensure consistent localStorage management
 */

import { logger } from './logger'

// Storage keys with consistent naming
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'sb-access-token',
    REFRESH_TOKEN: 'sb-refresh-token',
    USER_DATA: 'sb-user',
    LOGIN_COMPLETE: 'telegram-login-complete',
    AUTH_RELOAD_PENDING: 'auth-reload-pending',
    LOGOUT_IN_PROGRESS: 'logout-in-progress',
    PENDING_LOGIN_TOKEN: 'pending_login_token',
    LOGIN_STARTED_AT: 'login_started_at'
} as const

// Cross-tab communication via storage events
export class StorageManager {
    private static instance: StorageManager
    private listeners: Map<string, Set<(value: string | null) => void>> = new Map()
    private suppressNextEvent: Set<string> = new Set()

    private constructor() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', this.handleStorageEvent.bind(this))
    }

    static getInstance(): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager()
        }
        return StorageManager.instance
    }

    private handleStorageEvent(event: StorageEvent) {
        if (!event.key || this.suppressNextEvent.has(event.key)) {
            this.suppressNextEvent.delete(event.key)
            return
        }

        const listeners = this.listeners.get(event.key)
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(event.newValue)
                } catch (error) {
                    logger.error(`Error in storage listener for ${event.key}:`, error)
                }
            })
        }
    }

    // Set item with cross-tab notification
    setItem(key: string, value: string): void {
        try {
            // Suppress the storage event for this tab since we're the source
            this.suppressNextEvent.add(key)
            localStorage.setItem(key, value)
            logger.debug(`Storage: Set ${key}`)
        } catch (error) {
            logger.error(`Storage: Failed to set ${key}:`, error)
        }
    }

    // Get item with fallback
    getItem(key: string): string | null {
        try {
            return localStorage.getItem(key)
        } catch (error) {
            logger.error(`Storage: Failed to get ${key}:`, error)
            return null
        }
    }

    // Remove item with cross-tab notification
    removeItem(key: string): void {
        try {
            this.suppressNextEvent.add(key)
            localStorage.removeItem(key)
            logger.debug(`Storage: Removed ${key}`)
        } catch (error) {
            logger.error(`Storage: Failed to remove ${key}:`, error)
        }
    }

    // Listen for changes to a specific key
    addListener(key: string, callback: (value: string | null) => void): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set())
        }
        this.listeners.get(key)!.add(callback)

        // Return cleanup function
        return () => {
            this.listeners.get(key)?.delete(callback)
        }
    }

    // Clear all auth-related storage
    clearAuthStorage(): void {
        const authKeys = [
            STORAGE_KEYS.ACCESS_TOKEN,
            STORAGE_KEYS.REFRESH_TOKEN,
            STORAGE_KEYS.USER_DATA,
            STORAGE_KEYS.LOGIN_COMPLETE,
            STORAGE_KEYS.AUTH_RELOAD_PENDING,
            STORAGE_KEYS.LOGOUT_IN_PROGRESS,
            STORAGE_KEYS.PENDING_LOGIN_TOKEN,
            STORAGE_KEYS.LOGIN_STARTED_AT
        ]

        authKeys.forEach(key => this.removeItem(key))

        // Also clear any Supabase-managed keys
        const allKeys = Object.keys(localStorage)
        allKeys.forEach(key => {
            if (key.startsWith('supabase.') || key.startsWith('sb-')) {
                this.removeItem(key)
            }
        })

        logger.info('Storage: Cleared all auth-related storage')
    }

    // Check if storage is available
    static isStorageAvailable(): boolean {
        try {
            const test = '__storage_test__'
            localStorage.setItem(test, 'test')
            localStorage.removeItem(test)
            return true
        } catch {
            return false
        }
    }
}

// Convenience functions using the singleton
const storage = StorageManager.getInstance()

export const setStorageItem = (key: string, value: string) => storage.setItem(key, value)
export const getStorageItem = (key: string) => storage.getItem(key)
export const removeStorageItem = (key: string) => storage.removeItem(key)
export const addStorageListener = (key: string, callback: (value: string | null) => void) => 
    storage.addListener(key, callback)
export const clearAuthStorage = () => storage.clearAuthStorage()