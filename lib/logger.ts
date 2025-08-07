/**
 * Enhanced logging system with collapsible groups, context tags, and level control
 * Usage: logger.error('BOT-AUTH', 'Login failed', error, { userId: '123' })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogTag = 'APP' | 'BOT-AUTH' | 'AUTH' | 'API' | 'DB' | 'TELEGRAM' | 'UI' | 'SYSTEM' | string

interface LogConfig {
    enabled: boolean
    level: LogLevel
    timestamp: boolean
    showFullStacks: boolean
}

const config: LogConfig = {
    enabled: process.env.NODE_ENV === 'development',
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    timestamp: true,
    showFullStacks: false
}

const logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
}

const levelColors: Record<LogLevel, string> = {
    debug: '#6B7280',
    info: '#3B82F6',
    warn: '#F59E0B',
    error: '#EF4444'
}

function shouldLog(level: LogLevel): boolean {
    if (!config.enabled && level !== 'error') return false
    return logLevels[level] >= logLevels[config.level]
}

function formatMessage(level: LogLevel, tag: LogTag, message: string): string {
    const timestamp = config.timestamp ? new Date().toISOString().split('T')[1].split('.')[0] : ''
    const timePrefix = timestamp ? `${timestamp} ` : ''
    return `${timePrefix}[${tag}] ${message}`
}

function formatError(error: any): { message: string; stack?: string } {
    if (!error) return { message: '' }

    if (typeof error === 'string') {
        return { message: error }
    }

    if (error instanceof Error) {
        const stack = config.showFullStacks
            ? error.stack
            : error.stack?.split('\n')
                .filter(line => !line.includes('react-dom') && !line.includes('scheduler') && !line.includes('webpack'))
                .slice(0, 2)
                .join('\n')

        return {
            message: error.message,
            stack: stack
        }
    }

    return { message: String(error) }
}

export const logger = {
    debug: (tag: LogTag, message: string, context?: any) => {
        if (!shouldLog('debug')) return

        const formatted = formatMessage('debug', tag, message)
        if (context) {
            console.groupCollapsed(`%c${formatted}`, `color: ${levelColors.debug}`)
            console.log('Context:', context)
            console.groupEnd()
        } else {
            console.log(`%c${formatted}`, `color: ${levelColors.debug}`)
        }
    },

    info: (tag: LogTag, message: string, context?: any) => {
        if (!shouldLog('info')) return

        const formatted = formatMessage('info', tag, message)
        if (context) {
            console.groupCollapsed(`%c${formatted}`, `color: ${levelColors.info}`)
            console.log('Context:', context)
            console.groupEnd()
        } else {
            console.log(`%c${formatted}`, `color: ${levelColors.info}`)
        }
    },

    warn: (tag: LogTag, message: string, context?: any) => {
        if (!shouldLog('warn')) return

        const formatted = formatMessage('warn', tag, message)
        if (context) {
            console.groupCollapsed(`%c⚠️ ${formatted}`, `color: ${levelColors.warn}; font-weight: bold`)
            console.log('Context:', context)
            console.groupEnd()
        } else {
            console.warn(`%c⚠️ ${formatted}`, `color: ${levelColors.warn}; font-weight: bold`)
        }
    },

    error: (tag: LogTag, message: string, error?: any, context?: any) => {
        if (!shouldLog('error')) return

        const formatted = formatMessage('error', tag, message)
        const { message: errorMsg, stack } = formatError(error)

        console.groupCollapsed(`%c❌ ${formatted}${errorMsg ? ': ' + errorMsg : ''}`,
            `color: ${levelColors.error}; font-weight: bold`)

        if (stack) {
            console.log('Stack:', stack)
        }

        if (context) {
            console.log('Context:', context)
        }

        console.groupEnd()
    },

    // Convenience method for API calls
    api: (endpoint: string, method: string = 'GET', data?: any, error?: any) => {
        if (error) {
            logger.error('API', `${method} ${endpoint} failed`, error, data)
        } else {
            logger.debug('API', `${method} ${endpoint}`, data)
        }
    },

    // Authentication specific logging
    auth: {
        start: (method: string, context?: any) => logger.info('AUTH', `Starting ${method} authentication`, context),
        success: (method: string, context?: any) => logger.info('AUTH', `${method} authentication successful`, context),
        failed: (method: string, error?: any, context?: any) => logger.error('AUTH', `${method} authentication failed`, error, context),
    },

    // Bot specific logging  
    bot: {
        received: (command: string, context?: any) => logger.debug('TELEGRAM', `Bot received: ${command}`, context),
        sent: (message: string, context?: any) => logger.debug('TELEGRAM', `Bot sent: ${message}`, context),
        error: (action: string, error?: any, context?: any) => logger.error('TELEGRAM', `Bot ${action} failed`, error, context),
    }
}

// Runtime configuration
export const configureLogging = (newConfig: Partial<LogConfig>) => {
    Object.assign(config, newConfig)
    logger.info('SYSTEM', `Logging configured: level=${config.level}, enabled=${config.enabled}`)
}

// Utility to temporarily enable debug mode
export const debugMode = (enabled: boolean = true) => {
    configureLogging({ level: enabled ? 'debug' : 'info' })
}
