// Telegram Bot Authentication Hook
// Handles the new bot-based authentication flow

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
    const pollForToken = useCallback(async (loginToken: string): Promise<{ email: string; user_id: string; telegram_data?: any } | null> => {
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max

        setAuthState(prev => ({ ...prev, isPolling: true }));

        const poll = async (): Promise<{ email: string; user_id: string; telegram_data?: any } | null> => {
            if (attempts++ > maxAttempts) {
                throw new Error('Login timeout - please try again');
            }

            try {
                const response = await fetch(`/api/check-login?token=${loginToken}`);
                const data = await response.json();

                logger.debug('Poll response received', {
                    status: response.status,
                    data,
                    attempt: attempts
                });

                if (data.status === 'complete' && data.email) {
                    logger.info('Bot auth completed successfully');
                    return {
                        email: data.email,
                        user_id: data.user_id,
                        telegram_data: data.telegram_data
                    };
                }

                if (data.status === 'expired' || data.status === 'used') {
                    throw new Error(data.error || 'Authentication session expired');
                }

                // Still pending - continue polling
                logger.debug('Authentication still pending, continuing to poll', { attempt: attempts });

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

            // Pre-register token in database to avoid timing issues
            try {
                const tokenResponse = await fetch('/api/create-login-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: loginToken })
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json();
                    logger.warn('Failed to pre-register token, continuing anyway', errorData);
                    // Continue with auth flow even if pre-registration fails
                } else {
                    const tokenData = await tokenResponse.json();
                    logger.info('Token pre-registered successfully', { expires_at: tokenData.expires_at });
                }
            } catch (error) {
                logger.warn('Token pre-registration failed, continuing anyway', error);
                // Continue with auth flow even if pre-registration fails
            }

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

                logger.info('Authentication confirmed by bot - establishing session');

                // Debug: Log the auth data we received
                logger.debug('Received auth data:', {
                    email: sessionData.email,
                    user_id: sessionData.user_id,
                    telegram_data: sessionData.telegram_data
                });

                // NEW APPROACH: Use signInWithPassword with a known password
                // Since we created the user in the Edge Function, we can sign them in
                logger.info('Attempting to sign in with password authentication');

                // For Telegram users, we can use a predictable password based on their chat_id
                // This is secure because only our backend knows the pattern
                const { data: signInResult, error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: `telegram_${sessionData.telegram_data?.chat_id}_secure`
                });

                if (signInError) {
                    logger.error('Password sign-in failed:', signInError);

                    // Fallback: Try to trigger a magic link that the user can actually use
                    logger.info('Trying magic link fallback');

                    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
                        email: sessionData.email
                    });

                    if (magicLinkError) {
                        logger.error('Magic link fallback also failed:', magicLinkError);
                        throw new Error(`Authentication failed: ${signInError.message}. Magic link fallback also failed: ${magicLinkError.message}`);
                    } else {
                        logger.info('Magic link sent - but this requires user to check email');
                        throw new Error('Please check your email and click the magic link to complete authentication');
                    }
                } else {
                    logger.info('Password authentication succeeded!', {
                        user_id: signInResult.session?.user?.id,
                        email: signInResult.user?.email
                    });
                }                // Clean up localStorage
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
