// API route for checking login token status
// Frontend polls this endpoint to check if Telegram auth completed

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { error: 'Token parameter required' },
                { status: 400 }
            );
        }

        // Validate token format - expect base64url format (48 chars) or legacy login_ format
        const isNewFormat = /^[A-Za-z0-9_-]{48}$/.test(token);
        const isLegacyFormat = token.startsWith('login_') && token.length >= 20;
        
        if (!isNewFormat && !isLegacyFormat) {
            return NextResponse.json(
                { error: 'Invalid token format' },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check if token exists and get session data
        const { data: tokenData, error } = await supabase
            .from('pending_tokens')
            .select('user_id, email, status, used, expires_at, created_at, telegram_chat_id, telegram_username, telegram_first_name, secure_password')
            .eq('token', token)
            .single();

        console.log(`Token lookup result:`, { tokenData, error });

        if (error) {
            if (error.code === 'PGRST116') {
                // Token not found - still waiting
                console.log(`Token ${token} not found - still waiting`);
                return NextResponse.json(
                    { status: 'pending', message: 'Waiting for authentication' },
                    { status: 200 }
                );
            }
            throw error;
        }

        // Check if token expired
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        const createdAt = new Date(tokenData.created_at);

        // Check both expires_at and max age (extended to 30 minutes to match Edge Function)
        const maxAge = 30 * 60 * 1000; // Extended to 30 minutes
        const age = now.getTime() - createdAt.getTime();

        console.log(`Token age check: ${Math.round(age / 1000 / 60)} minutes (max: ${maxAge / 1000 / 60} minutes)`);

        if (now > expiresAt || age > maxAge) {
            console.log(`Token expired: now=${now.toISOString()}, expiresAt=${expiresAt.toISOString()}, age=${Math.round(age / 1000 / 60)}min`);
            // Clean up expired token
            await supabase
                .from('pending_tokens')
                .delete()
                .eq('token', token);

            return NextResponse.json(
                { error: 'Token expired', status: 'expired' },
                { status: 400 }
            );
        }

        // Check if token already used
        if (tokenData.used) {
            return NextResponse.json(
                { error: 'Token already used', status: 'used' },
                { status: 400 }
            );
        }

        // Check if authentication is complete (status = 'complete')
        if (tokenData.status === 'complete') {
            console.log(`Auth complete for token ${token}, marking as used`);

            // Mark token as used
            await supabase
                .from('pending_tokens')
                .update({ used: true })
                .eq('token', token);

            return NextResponse.json({
                status: 'complete',
                email: tokenData.email,
                user_id: tokenData.user_id,
                secure_password: tokenData.secure_password || null, // Backward compatibility
                telegram_data: {
                    chat_id: tokenData.telegram_chat_id,
                    username: tokenData.telegram_username,
                    first_name: tokenData.telegram_first_name
                }
            });
        }

        // Still waiting for authentication
        console.log(`Token ${token} exists but status is '${tokenData.status}' - still pending`);
        return NextResponse.json(
            { status: 'pending', message: 'Waiting for authentication' },
            { status: 200 }
        );

    } catch (error) {
        console.error('Check login error:', error);

        return NextResponse.json(
            { error: 'Failed to check login status' },
            { status: 500 }
        );
    }
}

// Handle preflight requests
export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
