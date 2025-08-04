import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const jwtSecretRaw = Deno.env.get('JWT_SECRET');
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!jwtSecretRaw) throw new Error('JWT secret not set');
const jwtSecret = new TextEncoder().encode(jwtSecretRaw);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for now
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
function base64url(input) {
    return btoa(String.fromCharCode(...input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
serve(async (req) => {
    try {
        console.log('[INFO] Telegram function called with method:', req.method);

        if (req.method === 'OPTIONS') {
            return new Response('ok', {
                status: 200,
                headers: corsHeaders
            });
        }

        if (req.method === 'GET') {
            // Simple health check endpoint
            return new Response(JSON.stringify({
                status: 'ok',
                message: 'Telegram function is running',
                env_check: {
                    supabaseUrl: !!supabaseUrl,
                    supabaseServiceRoleKey: !!supabaseServiceRoleKey,
                    jwtSecretRaw: !!jwtSecretRaw,
                    botToken: !!botToken
                },
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Check environment variables
        if (!supabaseUrl || !supabaseServiceRoleKey || !jwtSecretRaw || !botToken) {
            console.error('[ERROR] Missing environment variables:', {
                supabaseUrl: !!supabaseUrl,
                supabaseServiceRoleKey: !!supabaseServiceRoleKey,
                jwtSecretRaw: !!jwtSecretRaw,
                botToken: !!botToken
            });
            return new Response('Server configuration error', {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        const bodyText = await req.text();
        console.log('[INFO] Raw request body:', bodyText);
        if (!bodyText) {
            return new Response('Missing request body', {
                status: 400,
                headers: corsHeaders
            });
        }
        let parsedData;
        try {
            parsedData = JSON.parse(bodyText);
        } catch (err) {
            console.error('[ERROR] Failed to parse JSON input:', err);
            return new Response('Invalid JSON input', {
                status: 400,
                headers: corsHeaders
            });
        }
        const parsed = new URLSearchParams(parsedData);
        console.log('[DEBUG] Parsed entries:');
        for (const [k, v] of parsed.entries()) {
            console.log(`${k} = ${v}`);
        }
        const hash = parsed.get('hash');
        parsed.delete('hash');
        const dataCheckString = [
            ...parsed.entries()
        ].map(([k, v]) => `${k}=${v}`).sort().join('\n');
        console.log('[INFO] Data check string:\n', dataCheckString);
        const botTokenSha256 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(botToken));
        const secretKey = await crypto.subtle.importKey('raw', botTokenSha256, {
            name: 'HMAC',
            hash: 'SHA-256'
        }, false, [
            'sign'
        ]);
        const sig = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(dataCheckString));
        const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
        console.log('[INFO] Calculated hash:', hex);
        console.log('[INFO] Provided hash:', hash);
        if (hex !== hash) {
            console.warn('[WARN] Hash mismatch. Possible forged payload.');
            return new Response('Invalid Telegram payload', {
                status: 401,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        const telegram_id = parsed.get('id');
        const first_name = parsed.get('first_name') || '';
        const username = parsed.get('username') || '';

        console.log(`[DEBUG] Parsed telegram_id: "${telegram_id}" (typeof: ${typeof telegram_id})`);

        const email = `telegram-${telegram_id}@telegram.local`;
        console.log(`[INFO] Using email: ${email}`);
        let userId;
        let user_metadata = {
            telegram_id,
            username,
            first_name
        };

        // First, try to find existing user by telegram_id in profiles table
        console.log(`[INFO] Searching for existing user by telegram_id: ${telegram_id}`);
        const { data: existingProfileByTelegramId, error: profileSearchError } = await supabase
            .from('profiles')
            .select('id')
            .eq('telegram_id', telegram_id ? parseInt(telegram_id) : 0)
            .single();

        let existingUserId = null;
        if (!profileSearchError && existingProfileByTelegramId) {
            existingUserId = existingProfileByTelegramId.id;
            console.log(`[INFO] Found existing user by telegram_id: ${existingUserId}`);
        } else {
            console.log(`[INFO] No existing user found by telegram_id, searching by email...`);

            // Fallback: search by email (for users created with correct email pattern)
            const { data: list, error: listError } = await supabase.auth.admin.listUsers({
                email
            });
            if (listError) {
                console.error('[ERROR] Failed to list users by email:', listError);
                throw listError;
            }
            if (list?.users?.length) {
                existingUserId = list.users[0].id;
                console.log(`[INFO] Found existing user by email: ${existingUserId}`);
            }
        }

        if (existingUserId) {
            // User exists, use their ID
            userId = existingUserId;
            console.log(`[INFO] Using existing user: ${userId}`);
        } else {
            // User doesn't exist, create new one
            console.log('[INFO] User not found, creating...');
            console.log('[INFO] User not found, creating...');

            // Add detailed logging before user creation
            console.log('[DEBUG] About to create user with:');
            console.log('[DEBUG] - Email:', email);
            console.log('[DEBUG] - User metadata:', JSON.stringify(user_metadata));
            console.log('[DEBUG] - App metadata: { provider: "telegram" }');

            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirmed: true,
                user_metadata,
                app_metadata: {
                    provider: 'telegram'
                }
            });

            if (createError) {
                console.error('[ERROR] Failed to create user:', createError);
                console.error('[ERROR] Error details:', JSON.stringify(createError, null, 2));
                console.error('[ERROR] Error name:', createError.name);
                console.error('[ERROR] Error message:', createError.message);
                console.error('[ERROR] Error status:', createError.status);
                console.error('[ERROR] Error code:', createError.code);

                // Return a more detailed error response
                return new Response(JSON.stringify({
                    error: 'User creation failed',
                    message: createError.message,
                    code: createError.code,
                    details: createError
                }), {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }

            userId = newUser.user?.id;

            if (!userId) {
                console.error('[ERROR] Could not get user ID from created user');
                throw new Error('Could not get user ID from created user');
            }

            // Check if profile already exists (likely created by trigger)
            console.log('[INFO] Checking if profile exists for user:', userId);
            const { data: existingProfile, error: checkError } = await supabase
                .from('profiles')
                .select('id, username, telegram_id')
                .eq('id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('[ERROR] Failed to check existing profile:', checkError);
                throw checkError;
            }

            if (existingProfile) {
                // Profile exists (created by trigger), update it with Telegram data
                console.log('[INFO] Profile exists, updating with Telegram data for user:', userId);
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        username: username || existingProfile.username,
                        first_name: first_name,
                        telegram_id: telegram_id ? parseInt(telegram_id) : existingProfile.telegram_id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                if (updateError) {
                    console.error('[ERROR] Failed to update profile:', updateError);
                    throw updateError;
                }
            } else {
                // Profile doesn't exist (trigger failed?), create it
                console.log('[INFO] Profile doesn\'t exist, creating for user:', userId);
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        username: username || `user_${telegram_id}`,
                        first_name: first_name,
                        telegram_id: telegram_id ? parseInt(telegram_id) : null
                    });

                if (insertError) {
                    console.error('[ERROR] Failed to insert profile:', insertError);
                    throw insertError;
                }
            }
        }

        if (!userId) {
            console.error('[ERROR] Could not determine user UUID');
            return new Response('Could not determine user UUID', {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: userId,
            email,
            role: 'authenticated',
            aud: 'authenticated',
            iss: 'supabase',
            exp: now + 60 * 60 * 24 * 30,
            iat: now,
            email_verified: true,
            phone_verified: false,
            app_metadata: {
                provider: 'telegram'
            },
            user_metadata
        };
        console.log('[DEBUG] JWT header:', header);
        console.log('[DEBUG] JWT payload:', payload);
        const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
        const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
        const unsignedToken = `${encodedHeader}.${encodedPayload}`;
        const jwtKey = await crypto.subtle.importKey('raw', jwtSecret, {
            name: 'HMAC',
            hash: 'SHA-256'
        }, false, [
            'sign'
        ]);
        const jwtSig = await crypto.subtle.sign('HMAC', jwtKey, new TextEncoder().encode(unsignedToken));
        const encodedSig = base64url(new Uint8Array(jwtSig));
        const access_token = `${unsignedToken}.${encodedSig}`;
        console.log('[INFO] JWT created');
        // Generate a refresh token (you might want to store this in your database)
        const refresh_token = crypto.randomUUID();
        return new Response(JSON.stringify({
            access_token,
            refresh_token
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (err) {
        console.error('[ERROR] Telegram login failed:', err);

        // Return more detailed error information for debugging
        const errorResponse = {
            error: 'Internal error',
            message: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
