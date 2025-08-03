// Test script to verify like functionality
console.log('🧪 Testing like functionality...')

// This will only work if we have proper environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Environment check:')
console.log('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING')
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'MISSING')

if (typeof window !== 'undefined') {
    console.log('🌐 Running in browser environment')

    // Test if we can access the functions
    if (window.getCurrentUserToken) {
        console.log('✅ getCurrentUserToken function available')
    } else {
        console.log('❌ getCurrentUserToken function not available')
    }

    if (window.toggleLikeDirect) {
        console.log('✅ toggleLikeDirect function available')
    } else {
        console.log('❌ toggleLikeDirect function not available')
    }
} else {
    console.log('📄 Running in server environment')
}
