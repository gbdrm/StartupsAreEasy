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
            const timestamp = new Date().toISOString()
            const wasHidden = !wasVisibleRef.current
            const isNowVisible = !document.hidden

            logger.info('UI', `PAGE VISIBILITY: Change detected - wasHidden: ${wasHidden}, isNowVisible: ${isNowVisible}`, { timestamp })

            setIsVisible(isNowVisible)
            wasVisibleRef.current = isNowVisible

            // If page was hidden and is now visible, check auth token validity
            if (wasHidden && isNowVisible) {
                logger.info('AUTH', `PAGE VISIBILITY: Page became visible after being hidden - starting auth validation`, { timestamp })

                // Add a small delay to avoid race conditions with logout
                logger.debug('AUTH', `PAGE VISIBILITY: Adding 100ms delay...`, { timestamp })
                await new Promise(resolve => setTimeout(resolve, 100))

                // Check if logout is in progress - skip validation entirely
                const logoutFlag = localStorage.getItem('logout-in-progress')
                logger.debug('AUTH', `PAGE VISIBILITY: Logout flag check: ${logoutFlag}`, { timestamp })
                if (logoutFlag) {
                    logger.info('AUTH', `PAGE VISIBILITY: Logout in progress, skipping auth validation`, { timestamp })
                    return
                }

                // Check if logout is in progress (common localStorage keys would be missing)
                const accessToken = localStorage.getItem("sb-access-token")
                const loginComplete = localStorage.getItem("telegram-login-complete")
                logger.debug('AUTH', `PAGE VISIBILITY: Token check - accessToken: ${!!accessToken}, loginComplete: ${!!loginComplete}`, { timestamp })

                const hasTokens = accessToken || loginComplete
                if (!hasTokens) {
                    logger.info('AUTH', `PAGE VISIBILITY: No auth tokens found - likely logged out, skipping validation`, { timestamp })
                    return
                }

                try {
                    logger.info('AUTH', `PAGE VISIBILITY: Starting getCurrentUserToken() call...`, { timestamp })
                    const tokenStartTime = Date.now()

                    const token = await getCurrentUserToken()

                    const tokenEndTime = Date.now()
                    const tokenDuration = tokenEndTime - tokenStartTime

                    logger.info('AUTH', `PAGE VISIBILITY: getCurrentUserToken() completed in ${tokenDuration}ms - hasToken: ${!!token}`, { timestamp })

                    if (!token) {
                        logger.warn('AUTH', `PAGE VISIBILITY: No valid token found after tab switch - auth may have expired`, { timestamp })
                        // Don't automatically reload here - let components handle it
                    } else {
                        logger.info('AUTH', `PAGE VISIBILITY: Auth token validated successfully after tab switch`, { timestamp })
                    }
                } catch (error) {
                    logger.error('AUTH', `PAGE VISIBILITY: Error validating auth token after tab switch`, error, { timestamp })
                    // Token validation failed - this will trigger auth refresh in components
                }
            } else {
                logger.debug('UI', `PAGE VISIBILITY: No auth validation needed - wasHidden: ${wasHidden}, isNowVisible: ${isNowVisible}`, { timestamp })
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, []) // Remove isVisible from dependencies since we use ref now

    return isVisible
}