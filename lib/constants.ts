// Environment and feature flags
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
export const HAS_FAKE_LOGIN = !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID

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
    TELEGRAM_LOGIN: "https://jymlmpzzjlepgqbimzdf.functions.supabase.co/tg-login"
} as const
