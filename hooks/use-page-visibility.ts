import { useState, useEffect, useRef } from 'react'
import { getCurrentUserToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

export function usePageVisibility() {
    const [isVisible, setIsVisible] = useState(true) // Default to visible
    const wasVisibleRef = useRef(true) // Track previous state

    useEffect(() => {
        // Set initial state after component mounts (client-side only)
        const initialVisibility = !document.hidden
        setIsVisible(initialVisibility)
        wasVisibleRef.current = initialVisibility

        // Set up page visibility listeners

        const handleVisibilityChange = async () => {
            const wasHidden = !wasVisibleRef.current
            const isNowVisible = !document.hidden
            setIsVisible(isNowVisible)
            wasVisibleRef.current = isNowVisible

            // If page was hidden and is now visible, check auth token validity
            if (wasHidden && isNowVisible) {
                logger.info('📄 Page became visible after being hidden - validating auth token...')

                // Add a small delay to avoid race conditions with logout
                await new Promise(resolve => setTimeout(resolve, 100))

                // Check if logout is in progress - skip validation entirely
                if (localStorage.getItem('logout-in-progress')) {
                    logger.debug('📄 Logout in progress, skipping auth validation')
                    return
                }

                // Check if logout is in progress (common localStorage keys would be missing)
                const hasTokens = localStorage.getItem("sb-access-token") || localStorage.getItem("telegram-login-complete")
                if (!hasTokens) {
                    logger.debug('📄 No auth tokens found - likely logged out, skipping validation')
                    return
                }

                try {
                    const token = await getCurrentUserToken()
                    if (!token) {
                        logger.warn('📄 No valid token found after tab switch - auth may have expired')
                        // Don't automatically reload here - let components handle it
                    } else {
                        logger.debug('📄 Auth token validated successfully after tab switch')
                    }
                } catch (error) {
                    logger.error('📄 Error validating auth token after tab switch:', error)
                    // Token validation failed - this will trigger auth refresh in components
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, []) // Remove isVisible from dependencies since we use ref now

    return isVisible
}