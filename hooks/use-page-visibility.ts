import { useState, useEffect } from 'react'
import { getCurrentUserToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

export function usePageVisibility() {
    const [isVisible, setIsVisible] = useState(!document.hidden)

    useEffect(() => {
        const handleVisibilityChange = async () => {
            const wasHidden = !isVisible
            const isNowVisible = !document.hidden
            setIsVisible(isNowVisible)

            // If page was hidden and is now visible, check auth token validity
            if (wasHidden && isNowVisible) {
                logger.info('📄 Page became visible after being hidden - validating auth token...')
                
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
    }, [isVisible]) // Include isVisible in dependencies to track previous state

    return isVisible
}