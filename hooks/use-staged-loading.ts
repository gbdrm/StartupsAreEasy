"use client"

import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'

export type LoadingStage =
    | 'idle'
    | 'initializing'
    | 'checking-auth'
    | 'loading-posts'
    | 'loading-comments'
    | 'complete'
    | 'error'

interface StagedLoadingState {
    stage: LoadingStage
    progress: number
    message: string
    error?: string
}

const stageMessages: Record<LoadingStage, string> = {
    idle: 'Ready',
    initializing: 'Initializing application...',
    'checking-auth': 'Checking authentication...',
    'loading-posts': 'Loading posts...',
    'loading-comments': 'Loading comments...',
    complete: 'Ready',
    error: 'Error occurred'
}

const stageProgress: Record<LoadingStage, number> = {
    idle: 0,
    initializing: 10,
    'checking-auth': 25,
    'loading-posts': 50,
    'loading-comments': 75,
    complete: 100,
    error: 0
}

export function useStagedLoading() {
    const [state, setState] = useState<StagedLoadingState>({
        stage: 'idle',
        progress: 0,
        message: stageMessages.idle
    })

    const setStage = useCallback((stage: LoadingStage, customMessage?: string, error?: string) => {
        const message = customMessage || stageMessages[stage]
        const progress = stageProgress[stage]

        logger.info('UI', `Loading Stage: ${stage}`, { progress, message })

        setState({
            stage,
            progress,
            message,
            error
        })
    }, [])

    const setError = useCallback((error: string) => {
        logger.error('UI', 'Loading Error', error)
        setStage('error', `Error: ${error}`, error)
    }, [setStage])

    const reset = useCallback(() => {
        logger.info('UI', 'Resetting loading state')
        setStage('idle')
    }, [setStage])

    return {
        ...state,
        setStage,
        setError,
        reset,
        isLoading: state.stage !== 'idle' && state.stage !== 'complete' && state.stage !== 'error'
    }
}
