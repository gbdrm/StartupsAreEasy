// Supabase Edge Function for Telegram Bot Authentication
// This function receives auth confirmation from the Telegram bot
// and creates/manages user sessions

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate limiting map for basic abuse prevention
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
        const forwardedFor = req.headers.get('x-forwarded-for');
        const realIP = req.headers.get('x-real-ip');

        // Handle multiple IPs in x-forwarded-for (take the first/client IP)
        let clientIP = 'unknown';
        if (forwardedFor) {
            clientIP = forwardedFor.split(',')[0].trim();
        } else if (realIP) {
            clientIP = realIP.trim();
        }

        const userAgent = req.headers.get('user-agent') || 'unknown';
        const origin = req.headers.get('origin') || req.headers.get('referer') || 'unknown';

        // Basic rate limiting
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

        // Validate token format
        if (!token.startsWith('login_') || token.length < 20) {
            return new Response(
                JSON.stringify({ error: "Invalid token format" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log('Supabase client created with service role key');

        if (!supabaseUrl || !serviceRoleKey) {
            console.error(`Missing environment variables - URL: ${!!supabaseUrl}, Key: ${!!serviceRoleKey}`);
            return new Response(
                JSON.stringify({ error: "Server configuration error - missing environment variables" }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Verify the token in the pending_tokens table
        console.log(`Checking token: ${token}`);
        const { data: tokenData, error: tokenError } = await supabase
            .from("pending_tokens")
            .select("*")
            .eq("token", token)
            .single();

        if (tokenError || !tokenData) {
            console.error('Token verification failed:', tokenError);

            // Additional debugging - check if token exists at all
            const { data: allTokens, error: searchError } = await supabase
                .from("pending_tokens")
                .select("token, created_at, used")
                .limit(10);

            console.log('Recent tokens in database:', allTokens);
            console.log('Search error:', searchError);

            return new Response(
                JSON.stringify({ error: "Invalid or expired token" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check token expiration (extended to 30 minutes for better UX)
        const tokenAge = Date.now() - new Date(tokenData.created_at).getTime();
        const maxTokenAge = 30 * 60 * 1000; // Extended to 30 minutes

        console.log(`Token age: ${Math.round(tokenAge / 1000 / 60)} minutes (max: ${maxTokenAge / 1000 / 60} minutes)`);

        if (tokenAge > maxTokenAge) {
            console.log('Token expired, cleaning up');
            await supabase
                .from("pending_tokens")
                .delete()
                .eq("token", token);

            return new Response(
                JSON.stringify({ error: "Token expired" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create/find Supabase user - handle both old and new email formats
        let email = `tg-${chat_id}@telegram-auth.com`; // Default new format
        let userId: string | undefined;

        console.log(`Looking up existing profile for telegram_id: ${chat_id}`);

        // Check if profile already exists
        const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('telegram_id', chat_id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error checking existing profile:', profileError);
            throw new Error(`Failed to check existing profile: ${profileError.message}`);
        }

        userId = existingProfile?.id;
        console.log(`Found existing userId: ${userId}`);

        // If user exists, get their actual email from auth system
        if (userId) {
            console.log(`Getting actual email for existing user: ${userId}`);
            try {
                const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(userId);
                if (authUser && authUser.email) {
                    email = authUser.email; // Use existing user's actual email
                    console.log(`Using existing user's email: ${email}`);
                } else {
                    console.log(`Could not get email for user ${userId}, using default: ${email}`);
                }
            } catch (err) {
                console.log(`Error getting user email, using default: ${err}`);
            }
        }
        console.log(`Found existing userId: ${userId}`);

        // Create user if doesn't exist
        if (!userId) {
            console.log(`No profile found, creating new user...`);

            // First check if auth user already exists by email
            const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

            if (listError) {
                throw new Error(`Failed to list users: ${listError.message}`);
            }

            const existingAuthUser = existingUsers.users.find((u: any) => u.email === email);

            if (existingAuthUser) {
                console.log(`Found existing auth user: ${existingAuthUser.id}`);
                userId = existingAuthUser.id;
            } else {
                // Create new user with a known password for later sign-in
                const userPassword = `telegram_${chat_id}_secure`;
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email,
                    password: userPassword, // Set a password for later sign-in
                    email_confirm: true, // Auto-confirm email since this is Telegram auth
                    user_metadata: {
                        telegram_id: chat_id,
                        telegram_username: username || null,
                        telegram_first_name: first_name || null,
                        auth_method: 'telegram'
                    }
                });

                if (createError) {
                    console.error('User creation error:', createError);
                    throw new Error(`Failed to create user: ${createError.message}`);
                }

                if (!newUser.user?.id) {
                    throw new Error('User creation succeeded but no user ID returned');
                }

                userId = newUser.user.id;
                console.log(`Created new user: ${userId}`);
            }

            // Create or update the profile for the user
            const { error: profileUpsertError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    telegram_id: chat_id,
                    username: username || '',
                    first_name: first_name || ''
                });

            if (profileUpsertError) {
                console.error('Profile creation/update error:', profileUpsertError);
                // Don't fail the auth process for profile creation issues, but log it
                console.log('Continuing without profile creation...');
            }
        } else {
            // User already exists, just update the profile table if needed
            console.log(`Found existing user with ID: ${userId}`);

            // Update the profile in the profiles table
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    telegram_id: chat_id,
                    username: username || '',
                    first_name: first_name || ''
                });

            if (updateError) {
                console.error('Profile update error:', updateError);
                // Don't fail the auth process for profile update issues
            }
        }

        if (!userId) {
            throw new Error('Failed to get user ID');
        }

        // NEW APPROACH: Just mark the token as ready with user information
        // Don't try to generate session tokens - let frontend handle authentication
        console.log('Marking authentication as ready for frontend processing');

        // Store the completion data for frontend polling
        const { error: storeError } = await supabase
            .from("pending_tokens")
            .update({
                // Store user information instead of tokens
                email: email,
                user_id: userId,
                status: 'complete', // Mark as ready for frontend
                used: false, // Will be marked true when frontend retrieves it
                ip_address: clientIP,
                user_agent: userAgent,
                origin: origin,
                telegram_chat_id: chat_id,
                telegram_username: username || null,
                telegram_first_name: first_name || null
            })
            .eq("token", token);

        if (storeError) {
            console.error('Error storing auth completion:', storeError);
            throw new Error(`Failed to store auth completion: ${storeError.message}`);
        }

        console.log(`Authentication ready for chat_id: ${chat_id}, user_id: ${userId}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Authentication successful! You can now return to the app.",
                user_id: userId,
                telegram_data: {
                    chat_id,
                    username: username || null,
                    first_name: first_name || null
                }
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Telegram auth error:', error);

        return new Response(
            JSON.stringify({
                error: `Failed to generate authentication tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            }
        );
    }
});
