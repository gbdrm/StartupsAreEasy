import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const corsHeaders = {
    "Access-Control-Allow-Origin": "https://startupsareeasy.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
};
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
serve(async (req) => {
    console.log('start serve');
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            status: 200,
            headers: corsHeaders
        });
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: corsHeaders
        });
    }
    try {
        const payload = await req.json();
        console.log("📦 Payload:", payload);
        const isValid = await verifyTelegramPayload(payload);
        console.log("✅ Payload valid:", isValid);
        if (!isValid) {
            return new Response(JSON.stringify({
                error: 'Invalid Telegram login'
            }), {
                status: 401,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        const telegramId = payload.id.toString();
        const email = `telegram-${telegramId}@telegram.local`;
        const username = payload.username || `tg_${telegramId}`;
        console.log("📨 Checking user by email:", email);
        let user;
        try {
            const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
                email
            });
            if (listError) {
                console.error("❌ Error while listing users:", listError);
                return new Response(JSON.stringify({
                    error: 'Failed to get user by email',
                    details: listError.message
                }), {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }
            const user = userList?.users?.[0];
        } catch (err) {
            console.error("❌ Error while getting user:", err);
            return new Response(JSON.stringify({
                error: 'Failed to get user by email',
                details: err?.message
            }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        if (!user) {
            console.log("📨 Creating user with email:", email);
            const createUser = await supabase.auth.admin.createUser({
                email,
                user_metadata: {
                    telegram_id: telegramId,
                    username,
                    first_name: payload.first_name,
                    last_name: payload.last_name,
                    avatar_url: payload.photo_url
                }
            });
            if (createUser.error || !createUser.data?.user) {
                console.error("❌ User creation failed:", createUser.error);
                return new Response(JSON.stringify({
                    error: 'User creation failed',
                    details: createUser.error?.message
                }), {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }
            user = createUser;
        }
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email
        });
        console.log("🪄 Link data:", linkData);
        if (linkError || !linkData?.access_token) {
            return new Response(JSON.stringify({
                error: 'Failed to generate token',
                details: linkError?.message
            }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        return new Response(JSON.stringify({
            access_token: linkData.access_token,
            refresh_token: linkData.refresh_token
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({
            error: 'Unexpected error',
            details: err?.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
async function verifyTelegramPayload(payload) {
    const { hash, ...authData } = payload;
    const sorted = Object.keys(authData).sort().map((key) => `${key}=${authData[key]}`).join('\n');
    const secretKey = new TextEncoder().encode(TELEGRAM_BOT_TOKEN);
    const secret = await crypto.subtle.digest('SHA-256', secretKey);
    const cryptoKey = await crypto.subtle.importKey('raw', secret, {
        name: 'HMAC',
        hash: 'SHA-256'
    }, false, [
        'sign'
    ]);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(sorted));
    const digest = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return digest === hash;
}
