// Supabase Edge Function for Telegram Bot Authentication
// This function receives auth confirmation from the Telegram bot
// and creates/manages user sessions

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate limiting map for basic abuse prevention
// NOTE: This is in-memory only and resets on cold starts - suitable for initial protection
// For production scale, consider database-based rate limiting with pending_tokens table
const rateLimitMap = new Map<string, { attempts: number; resetTime: number }>();
const MAX_ATTEMPTS = 10; // per IP/chat_id per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

interface TelegramAuthRequest {
    token: string;
    chat_id: number;
    username?: string;
    first_name?: string;
    // Security tracking
    ip_address?: string;
    user_agent?: string;
    origin?: string;
}

serve(async (req) => {
    // Log the start of the request
    console.log(`Incoming request: ${req.method} ${req.url}`);
    console.log(`Headers: ${JSON.stringify([...req.headers])}`);

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body: TelegramAuthRequest = await req.json();
        const { token, chat_id, username, first_name } = body;

        // Extract security info for tracking
        const clientIP = req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const origin = req.headers.get('origin') || req.headers.get('referer') || 'unknown';

        // Basic rate limiting (ChatGPT suggestion)
        const rateLimitKey = `${clientIP}:${chat_id}`;
        const now = Date.now();
        const userLimit = rateLimitMap.get(rateLimitKey) || { attempts: 0, resetTime: now + RATE_WINDOW };

        if (now > userLimit.resetTime) {
            userLimit.attempts = 0;
            userLimit.resetTime = now + RATE_WINDOW;
        }

        if (userLimit.attempts >= MAX_ATTEMPTS) {
            return new Response(
                JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        userLimit.attempts++;
        rateLimitMap.set(rateLimitKey, userLimit);

        // Validate required fields
        if (!token || !chat_id) {
            return new Response(
                JSON.stringify({ error: "Missing token or chat_id" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Validate token format (ChatGPT suggestion enhancement)
        if (!token.startsWith('login_') || token.length < 20) {
            return new Response(
                JSON.stringify({ error: "Invalid token format" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Check if token exists and is valid
        const { data: existingToken, error: tokenError } = await supabase
            .from("pending_tokens")
            .select("used, created_at, expires_at")
            .eq("token", token)
            .single();

        if (tokenError && tokenError.code !== 'PGRST116') {
            throw new Error(`Token lookup failed: ${tokenError.message}`);
        }

        // Check if token already used
        if (existingToken?.used) {
            return new Response(
                JSON.stringify({ error: "Token already used" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check token age (max 10 minutes) - ChatGPT suggestion: bail early on expiration
        if (existingToken) {
            const tokenAge = new Date().getTime() - new Date(existingToken.created_at).getTime();
            const maxAge = 10 * 60 * 1000; // 10 minutes
            const isExpired = tokenAge > maxAge || new Date() > new Date(existingToken.expires_at);

            if (isExpired) {
                // Clean up expired token before returning error
                await supabase
                    .from("pending_tokens")
                    .delete()
                    .eq("token", token);

                return new Response(
                    JSON.stringify({ error: "Token expired" }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // Create/find Supabase user
        const email = `tg-${chat_id}@telegram.local`;

        // Try to get existing user first
        const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);

        let userId = existingUser?.user?.id;

        // Create user if doesn't exist
        if (!userId) {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true, // Skip email confirmation
                user_metadata: {
                    telegram_id: chat_id,
                    username: username || '',
                    first_name: first_name || '',
                    auth_provider: 'telegram',
                    created_via: 'telegram_bot'
                },
            });

            if (createError) {
                console.error('User creation error:', createError);
                throw new Error(`Failed to create user: ${createError.message}`);
            }

            userId = newUser.user.id;
        } else {
            // Update user metadata if user exists
            await supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    telegram_id: chat_id,
                    username: username || '',
                    first_name: first_name || '',
                    auth_provider: 'telegram',
                    last_login: new Date().toISOString()
                }
            });
        }

        if (!userId) {
            throw new Error('Failed to get user ID');
        }

        // Generate session tokens
        // Try generateAccessToken first (ChatGPT noted it might not be available)
        let sessionData;
        try {
            // Attempt direct token generation (preferred method)
            const { data: tokenData, error: tokenGenError } = await supabase.auth.admin.generateAccessToken(userId, {
                expiresIn: 3600 // 1 hour
            });

            if (tokenGenError) throw tokenGenError;
            sessionData = tokenData;

        } catch (tokenError) {
            console.log('Direct token generation failed, using magic link fallback:', tokenError);

            // Fallback to magic link method (ChatGPT suggestion)
            const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
                type: "magiclink",
                email,
                options: {
                    redirectTo: `${origin}/auth/callback`
                }
            });

            if (linkError) {
                throw new Error(`Failed to generate auth link: ${linkError.message}`);
            }

            // Extract tokens from magic link URL
            // WARNING: This URL parsing assumes Supabase exposes tokens in redirect URL params
            // This behavior is NOT officially documented and could change in future Supabase versions
            // Monitor Supabase changelog for changes to magic link format
            // TODO: Migrate to generateAccessToken() when officially supported
            const url = new URL(linkData.action_link);
            const accessToken = url.searchParams.get('access_token');
            const refreshToken = url.searchParams.get('refresh_token');

            if (!accessToken) {
                throw new Error('No access token in magic link - Supabase URL format may have changed');
            }

            sessionData = {
                access_token: accessToken,
                refresh_token: refreshToken
            };
        }

        // Store tokens in pending_tokens table
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        const { error: storeError } = await supabase
            .from("pending_tokens")
            .upsert({
                token,
                access_token: sessionData.access_token,
                refresh_token: sessionData.refresh_token || null,
                expires_at: expiresAt.toISOString(),
                used: false, // Will be marked true when retrieved by check-login API
                // Security tracking
                ip_address: clientIP,
                user_agent: userAgent,
                origin: origin,
                // Telegram info for debugging
                telegram_chat_id: chat_id,
                telegram_username: username || null,
                telegram_first_name: first_name || null
            });

        if (storeError) {
            console.error('Token storage error:', storeError);
            throw new Error(`Failed to store token: ${storeError.message}`);
        }

        console.log(`✅ Auth confirmed for Telegram user ${chat_id} (${username}), token: ${token}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Authentication confirmed",
                user_id: userId
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Telegram auth error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return new Response(
            JSON.stringify({
                error: "Authentication failed",
                details: errorMessage
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});

// Note: In-memory rate limiting will reset on cold starts
// For production-scale abuse protection, consider implementing
// database-based rate limiting using the pending_tokens table
