// Telegram Bot Authentication Hook
// Handles the new bot-based authentication flow

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { generateSecureLoginToken } from '@/lib/crypto-utils';

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

                logger.debug('BOT-AUTH', 'Poll response received', {
                    status: response.status,
                    data,
                    attempt: attempts
                });

                if (data.status === 'complete' && data.email) {
                    logger.info('BOT-AUTH', 'Bot auth completed successfully', {
                        email: data.email,
                        user_id: data.user_id,
                        hasSecurePassword: !!data.secure_password
                    });
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
                logger.debug('BOT-AUTH', 'Authentication still pending, continuing to poll', { attempt: attempts });

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
            // Ensure polling state is always reset
            setAuthState(prev => ({ 
                ...prev, 
                isPolling: false,
                isLoading: false 
            }));
        }
    }, []);

    const loginWithTelegramBot = useCallback(async () => {
        try {
            setAuthState({
                isLoading: true,
                error: null,
                isPolling: false
            });

            // Generate cryptographically secure login token
            const loginToken = generateSecureLoginToken();

            logger.info('BOT-AUTH', 'Starting Telegram bot authentication', { loginToken });

            // Pre-register token in database to avoid timing issues
            try {
                const tokenResponse = await fetch('/api/create-login-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: loginToken })
                });

                if (!tokenResponse.ok) {
                    const errorData = await tokenResponse.json();
                    logger.warn('BOT-AUTH', 'Failed to pre-register token, continuing anyway', errorData);
                    // Continue with auth flow even if pre-registration fails
                } else {
                    const tokenData = await tokenResponse.json();
                    logger.info('BOT-AUTH', 'Token pre-registered successfully', { expires_at: tokenData.expires_at });
                }
            } catch (error) {
                logger.warn('BOT-AUTH', 'Token pre-registration failed, continuing anyway', error);
                // Continue with auth flow even if pre-registration fails
            }

            // Store token for recovery on page refresh
            localStorage.setItem('pending_login_token', loginToken);
            localStorage.setItem('login_started_at', Date.now().toString());

            // Open Telegram bot with login token (properly encoded)
            const botUsername = 'startups_are_easy_bot'; // Your bot username
            const encodedToken = encodeURIComponent(loginToken);
            const telegramUrl = `https://t.me/${botUsername}?start=${encodedToken}`;

            logger.debug('BOT-AUTH', 'Opening Telegram bot', { telegramUrl, originalToken: loginToken, encodedToken });

            // Try to open in new tab/window
            const popup = window.open(telegramUrl, '_blank');

            if (!popup) {
                // Popup was blocked, but continue with polling
                // The UI will show manual instructions
                logger.warn('BOT-AUTH', 'Popup blocked, user will need to use manual method');
                logger.info('BOT-AUTH', 'Continuing with polling - UI will show fallback options');
            } else {
                // Popup opened successfully
                logger.info('BOT-AUTH', 'Telegram bot opened in new window/tab');
            }

            // Start polling for authentication completion
            try {
                const sessionData = await pollForToken(loginToken);

                if (!sessionData) {
                    throw new Error('Authentication failed - no session data received');
                }

                logger.auth.start('Telegram bot', { user_id: sessionData.user_id });

                // Debug: Log the auth data we received (simplified)
                logger.debug('BOT-AUTH', 'Auth data received', {
                    email: !!sessionData.email,
                    user_id: !!sessionData.user_id, 
                    has_telegram_data: !!sessionData.telegram_data
                });

                // Use the secure password that was generated server-side during user creation
                // Fall back by fetching from user metadata if not in pending_tokens
                let password: string | undefined;
                if (!password) {
                    logger.warn('BOT-AUTH', 'No secure password in pending_tokens, fetching from user metadata');
                    
                    // Try to get the password from user metadata via API route
                    try {
                        const passwordResponse = await fetch('/api/get-user-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: sessionData.user_id })
                        });
                        
                        if (passwordResponse.ok) {
                            const passwordData = await passwordResponse.json();
                            password = passwordData.secure_password;
                            if (password) {
                                logger.info('BOT-AUTH', 'Retrieved secure password from user metadata');
                            } else {
                                logger.warn('BOT-AUTH', 'No secure password in user metadata - using legacy fallback');
                                password = `telegram_${sessionData.user_id}_secure`;
                            }
                        } else {
                            logger.error('BOT-AUTH', 'Failed to fetch password from API');
                            password = `telegram_${sessionData.user_id}_secure`;
                        }
                    } catch (metaError) {
                        logger.error('BOT-AUTH', 'Failed to fetch user password', metaError);
                        password = `telegram_${sessionData.user_id}_secure`;
                    }
                }

                logger.debug('BOT-AUTH', 'Attempting password sign-in', {
                    email: sessionData.email,
                    passwordLength: password.length,
                    passwordType: password.startsWith('telegram_') ? 'legacy' : 'secure'
                });
                
                const { data: signInResult, error: signInError } = await supabase.auth.signInWithPassword({
                    email: sessionData.email,
                    password: password
                });

                if (signInError) {
                    logger.auth.failed('Telegram password', signInError, { 
                        email: sessionData.email,
                        passwordLength: password.length
                    });
                    throw new Error(`Password authentication failed: ${signInError.message}`);
                } else {
                    logger.auth.success('Telegram password', {
                        user_id: signInResult.session?.user?.id,
                        email: signInResult.user?.email
                    });
                }

                // Reset auth state before cleanup and reload
                setAuthState({
                    isLoading: false,
                    error: null,
                    isPolling: false
                });

                // Clean up localStorage
                localStorage.removeItem('pending_login_token');
                localStorage.removeItem('login_started_at');

                logger.info('BOT-AUTH', 'Authentication completed successfully');

                // Trigger page reload for auth state consistency (per instructions)
                setTimeout(() => {
                    window.location.reload();
                }, 100); // Small delay to allow state update

                } catch (pollError) {
                    logger.error('BOT-AUTH', 'Polling failed', pollError);

                    // Clean up on error
                    localStorage.removeItem('pending_login_token');
                    localStorage.removeItem('login_started_at');

                    throw pollError;
                }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            logger.error('BOT-AUTH', 'Authentication failed', error);

            setAuthState({
                isLoading: false,
                error: errorMessage,
                isPolling: false
            });
        }
    }, [pollForToken]);

    const cancelLogin = useCallback(() => {
        logger.info('BOT-AUTH', 'Canceling bot authentication');

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
