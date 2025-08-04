// Debug utilities for logout diagnostics
// Run these in browser console during testing

window.debugLogout = {
    // Check current state
    checkState() {
        console.log('=== CURRENT AUTH STATE ===');
        console.log('Environment:', {
            NODE_ENV: process?.env?.NODE_ENV,
            hostname: window.location.hostname,
            isProduction: window.location.hostname !== 'localhost'
        });

        console.log('LocalStorage tokens:', {
            accessToken: !!localStorage.getItem('sb-access-token'),
            refreshToken: !!localStorage.getItem('sb-refresh-token'),
            loginComplete: !!localStorage.getItem('telegram-login-complete'),
            logoutFlag: !!localStorage.getItem('logout-in-progress')
        });

        console.log('Page visibility:', {
            hidden: document.hidden,
            visibilityState: document.visibilityState
        });

        console.log('All localStorage keys:', Object.keys(localStorage).filter(k =>
            k.includes('sb-') || k.includes('auth') || k.includes('telegram')
        ));
    },

    // Test manual signout
    testManualSignout() {
        console.log('=== TESTING MANUAL SIGNOUT ===');
        window.dispatchEvent(new CustomEvent('manual-signout', {
            detail: { timestamp: Date.now(), source: 'debug' }
        }));
        console.log('Manual signout event dispatched');
    },

    // Clear all auth data manually
    clearAllAuth() {
        console.log('=== CLEARING ALL AUTH DATA ===');
        const keys = Object.keys(localStorage);
        const authKeys = keys.filter(k =>
            k.startsWith('sb-') || k.includes('auth') || k.includes('telegram')
        );
        console.log('Clearing keys:', authKeys);
        authKeys.forEach(key => localStorage.removeItem(key));
        console.log('All auth data cleared');
    },

    // Test getCurrentUserToken timing
    async testTokenCall() {
        console.log('=== TESTING getCurrentUserToken() ===');
        const start = Date.now();
        try {
            // This should match your getCurrentUserToken implementation
            const isProduction = window.location.hostname !== 'localhost';
            if (isProduction) {
                const token = localStorage.getItem('sb-access-token');
                console.log('Production bypass - token found:', !!token);
                return token;
            } else {
                console.log('Development - calling supabase.auth.getSession()...');
                // Would need to import supabase for real test
                console.log('Note: Need to import supabase to test this properly');
            }
        } catch (error) {
            console.error('Token call error:', error);
        } finally {
            const duration = Date.now() - start;
            console.log(`Token call completed in ${duration}ms`);
        }
    }
};

console.log('🔬 Debug utilities loaded! Use:');
console.log('- debugLogout.checkState() - Check current auth state');
console.log('- debugLogout.testManualSignout() - Test manual signout event');
console.log('- debugLogout.clearAllAuth() - Clear all auth data');
console.log('- debugLogout.testTokenCall() - Test token retrieval timing');
