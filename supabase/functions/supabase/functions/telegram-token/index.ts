import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate, Header, AlgorithmTypes } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';
//test 1
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const jwtSecret = new TextEncoder().encode(Deno.env.get('JWT_SECRET'));
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://startupsareeasy.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
console.log('[🟢 Function Deployed]');
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
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({
      email
    });
    if (listError) {
      console.error('[ERROR] Failed to list users:', listError);
      throw listError;
    }
    if (!list?.users?.length) {
      console.log('[INFO] User not found, creating...');
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        user_metadata: {
          telegram_id,
          username,
          first_name
        }
      });
      if (createError) {
        console.error('[ERROR] Failed to create user:', createError);
        throw createError;
      }
      console.log('[INFO] User created successfully');
    } else {
      console.log('[INFO] User already exists');
    }
    const header: Header = {
      alg: 'HS256' as AlgorithmTypes,
      typ: 'JWT',
    };
    console.log(header);
    const payload = {
      sub: telegram_id,
      email,
      role: 'authenticated',
      exp: getNumericDate(60 * 60 * 24 * 30)
    };
    console.log("Payload: " + payload);
    if (!jwtSecret || jwtSecret.length === 0) {
      throw new Error('JWT secret is missing or empty');
    }
    console.log("Create params: ", header, payload, jwtSecret);
    const access_token = await create(header, payload, jwtSecret);
    console.log('[INFO] JWT created');
    return new Response(JSON.stringify({
      access_token
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
