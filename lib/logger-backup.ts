// Centralized logging utility for better control over debug output
// Logs only show in development unless explicitly enabled

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogConfig {
    enabled: boolean
    level: LogLevel
    timestamp: boolean
}

const config: LogConfig = {
    enabled: process.env.NODE_ENV === 'development',
    level: 'info',
    timestamp: true
}

const logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
}

function shouldLog(level: LogLevel): boolean {
    if (!config.enabled && level !== 'error') return false
    return logLevels[level] >= logLevels[config.level]
}

function formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = config.timestamp ? `[${new Date().toISOString()}]` : ''
    const levelTag = `[${level.toUpperCase()}]`
    return `${timestamp} ${levelTag} ${message}`
}

export const logger = {
    debug: (message: string, context?: any) => {
        if (shouldLog('debug')) {
            console.log(formatMessage('debug', message), context || '')
        }
    },

    info: (message: string, context?: any) => {
        if (shouldLog('info')) {
            console.log(formatMessage('info', message), context || '')
        }
    },

    warn: (message: string, context?: any) => {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message), context || '')
        }
    },

    error: (message: string, error?: any, context?: any) => {
        if (shouldLog('error')) {
            console.error(formatMessage('error', message), error || '', context || '')
        }
    },

    // Special method for API calls - only shows in development
    api: (endpoint: string, method: string = 'GET', data?: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${new Date().toISOString()}] [API] ${method} ${endpoint}`, data || '')
        }
    }
}

// Enable/disable logging at runtime (useful for debugging)
export const configureLogging = (newConfig: Partial<LogConfig>) => {
    Object.assign(config, newConfig)
}
