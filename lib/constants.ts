// Environment and feature flags
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

// Extra safety: fake login only allowed in development AND localhost
export const HAS_FAKE_LOGIN = IS_DEVELOPMENT &&
    !!(process.env.NEXT_PUBLIC_DEV_EMAIL && process.env.NEXT_PUBLIC_DEV_PASSWORD) &&
    (typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

// UI Constants
export const AVATAR_SIZES = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-16 w-16",
    "2xl": "h-24 w-24"
} as const

// Storage Keys
export const STORAGE_KEYS = {
    FAKE_USER_SESSION: "fake-user-session",
    SUPABASE_ACCESS_TOKEN: "sb-access-token"
} as const

// API Endpoints
export const API_ENDPOINTS = {
    TELEGRAM_LOGIN: process.env.NEXT_PUBLIC_TELEGRAM_FUNCTION_URL || "https://jymlmpzzjlepgqbimzdf.functions.supabase.co/tg-login"
} as const
