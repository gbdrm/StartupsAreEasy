import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const jwtSecretRaw = Deno.env.get('JWT_SECRET');
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!jwtSecretRaw) throw new Error('JWT secret not set');
const jwtSecret = new TextEncoder().encode(jwtSecretRaw);
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://startupsareeasy.com',
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
        if (req.method === 'OPTIONS') {
            return new Response('ok', {
                status: 200,
                headers: corsHeaders
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
        const email = `telegram-${telegram_id}@telegram.local`;
        console.log(`[INFO] Using email: ${email}`);
        let userId: string | undefined;
        let user_metadata = { telegram_id, username, first_name };
        const { data: list, error: listError } = await supabase.auth.admin.listUsers({ email });
        if (listError) {
            console.error('[ERROR] Failed to list users:', listError);
            throw listError;
        }
        if (!list?.users?.length) {
            console.log('[INFO] User not found, creating...');
            const { error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirmed: true,
                user_metadata,
                app_metadata: {
                    provider: 'telegram'
                }
            });
            if (createError) {
                console.error('[ERROR] Failed to create user:', createError);
                throw createError;
            }
            // Fetch the user again to get the UUID
            const { data: newList, error: newListError } = await supabase.auth.admin.listUsers({ email });
            if (newListError) {
                console.error('[ERROR] Failed to fetch new user:', newListError);
                throw newListError;
            }
            userId = newList?.users?.[0]?.id;
        } else {
            userId = list.users[0].id;
            // Optionally update user_metadata if needed
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
            exp: now + 60 * 60 * 24 * 30, // 30 days
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
        return new Response('Internal error', {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
