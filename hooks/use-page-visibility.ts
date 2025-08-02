import { useState, useEffect } from 'react'

export function usePageVisibility() {
    const [isVisible, setIsVisible] = useState(!document.hidden)

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden)

            if (!document.hidden) {
                console.log('📄 Page became visible - checking auth status...')
                // When page becomes visible again, we might need to refresh auth
                // This will be handled by components that use this hook
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    return isVisible
}