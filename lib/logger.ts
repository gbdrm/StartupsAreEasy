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
    throttle: boolean // Throttle repeated messages
    maxLogEntries: number // Maximum logs to keep in memory
}

const config: LogConfig = {
    enabled: process.env.NODE_ENV === 'development',
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    timestamp: true,
    showFullStacks: false,
    throttle: true,
    maxLogEntries: 1000
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

// Throttling and performance monitoring
const logThrottleMap = new Map<string, { count: number, lastLogged: number }>()
const performanceTimers = new Map<string, number>()

// Clear throttle map periodically to prevent memory leaks
if (typeof window !== 'undefined') {
    setInterval(() => {
        const now = Date.now()
        for (const [key, data] of logThrottleMap.entries()) {
            if (now - data.lastLogged > 60000) { // Clear entries older than 1 minute
                logThrottleMap.delete(key)
            }
        }
    }, 30000) // Run cleanup every 30 seconds
}

function shouldThrottle(key: string): boolean {
    if (!config.throttle) return false
    
    const now = Date.now()
    const throttleData = logThrottleMap.get(key)
    
    if (!throttleData) {
        logThrottleMap.set(key, { count: 1, lastLogged: now })
        return false
    }
    
    // If same message within 5 seconds, throttle
    if (now - throttleData.lastLogged < 5000) {
        throttleData.count++
        return true
    }
    
    // If we've been throttling, log the count
    if (throttleData.count > 1) {
        console.log(`%c[THROTTLED] Previous message repeated ${throttleData.count - 1} times`, 'color: #9CA3AF; font-style: italic')
    }
    
    // Reset throttle data
    throttleData.count = 1
    throttleData.lastLogged = now
    return false
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

        const throttleKey = `debug:${tag}:${message}`
        if (shouldThrottle(throttleKey)) return

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
    },

    // Performance timing
    time: (label: string) => {
        performanceTimers.set(label, Date.now())
        logger.debug('PERF', `Timer started: ${label}`)
    },

    timeEnd: (label: string) => {
        const startTime = performanceTimers.get(label)
        if (!startTime) {
            logger.warn('PERF', `Timer not found: ${label}`)
            return
        }
        
        const duration = Date.now() - startTime
        performanceTimers.delete(label)
        logger.debug('PERF', `Timer ended: ${label}`, { duration: `${duration}ms` })
        return duration
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
