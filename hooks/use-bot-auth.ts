// Telegram Bot Authentication Hook
// Handles the new bot-based authentication flow

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AuthState {
    isLoading: boolean;
    error: string | null;
    isPolling: boolean;
}

interface UseBotkAuth {
    authState: AuthState;
    loginWithTelegramBot: () => Promise<void>;
    cancelLogin: () => void;
}

export function useBotAuth(): UseBotkAuth {
    const [authState, setAuthState] = useState<AuthState>({
        isLoading: false,
        error: null,
        isPolling: false
    });

    // Polling function with exponential backoff (ChatGPT suggestion)
    const pollForToken = useCallback(async (loginToken: string): Promise<{ access_token: string; refresh_token?: string } | null> => {
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max

        setAuthState(prev => ({ ...prev, isPolling: true }));

        const poll = async (): Promise<{ access_token: string; refresh_token?: string } | null> => {
            if (attempts++ > maxAttempts) {
                throw new Error('Login timeout - please try again');
            }

            try {
                const response = await fetch(`/api/check-login?token=${loginToken}`);
                const data = await response.json();

                if (data.status === 'complete' && data.access_token) {
                    logger.info('Bot auth completed successfully');
                    return {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token
                    };
                }

                if (data.status === 'expired' || data.status === 'used') {
                    throw new Error(data.error || 'Authentication session expired');
                }

                // Still pending - continue polling
                // Exponential backoff: 1s, 2s, 4s, then 10s intervals
                const delay = attempts < 3 ? Math.pow(2, attempts) * 1000 : 10000;
                await new Promise(resolve => setTimeout(resolve, delay));

                return poll();

            } catch (fetchError) {
                if (fetchError instanceof Error && fetchError.message.includes('timeout')) {
                    throw fetchError;
                }

                // For other errors, wait and retry
                const delay = 5000; // 5 seconds for error retry
                await new Promise(resolve => setTimeout(resolve, delay));
                return poll();
            }
        };

        try {
            return await poll();
        } finally {
            setAuthState(prev => ({ ...prev, isPolling: false }));
        }
    }, []);

    const loginWithTelegramBot = useCallback(async () => {
        try {
            setAuthState({
                isLoading: true,
                error: null,
                isPolling: false
            });

            // Generate secure login token (ChatGPT suggestion for format)
            const loginToken = `login_${crypto.randomUUID()}_${Date.now()}`;

            logger.info('Starting Telegram bot authentication', { loginToken });

            // Store token for recovery on page refresh
            localStorage.setItem('pending_login_token', loginToken);
            localStorage.setItem('login_started_at', Date.now().toString());

            // Open Telegram bot with login token
            const botUsername = 'startups_are_easy_bot'; // Your bot username
            const telegramUrl = `https://t.me/${botUsername}?start=${loginToken}`;

            logger.debug('Opening Telegram bot', { telegramUrl });

            // Open in new tab/window
            const popup = window.open(telegramUrl, '_blank');

            if (!popup) {
                throw new Error('Please allow popups and try again');
            }

            // Start polling for authentication completion
            try {
                const sessionData = await pollForToken(loginToken);

                if (!sessionData) {
                    throw new Error('Authentication failed - no session data received');
                }

                logger.info('Setting Supabase session with bot tokens');

                // Set Supabase session with received tokens
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: sessionData.access_token,
                    refresh_token: sessionData.refresh_token || ''
                });

                if (sessionError) {
                    logger.error('Failed to set Supabase session', sessionError);
                    throw new Error(`Session setup failed: ${sessionError.message}`);
                }

                // Clean up localStorage
                localStorage.removeItem('pending_login_token');
                localStorage.removeItem('login_started_at');

                logger.info('Bot authentication completed successfully');

                // Trigger page reload for auth state consistency (per instructions)
                window.location.reload();

            } catch (pollError) {
                logger.error('Bot authentication polling failed', pollError);

                // Clean up on error
                localStorage.removeItem('pending_login_token');
                localStorage.removeItem('login_started_at');

                throw pollError;
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            logger.error('Bot authentication error', error);

            setAuthState({
                isLoading: false,
                error: errorMessage,
                isPolling: false
            });
        }
    }, [pollForToken]);

    const cancelLogin = useCallback(() => {
        logger.info('Canceling bot authentication');

        // Clean up localStorage
        localStorage.removeItem('pending_login_token');
        localStorage.removeItem('login_started_at');

        // Reset state
        setAuthState({
            isLoading: false,
            error: null,
            isPolling: false
        });
    }, []);

    return {
        authState,
        loginWithTelegramBot,
        cancelLogin
    };
}
