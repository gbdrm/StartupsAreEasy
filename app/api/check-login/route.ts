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

        // Validate token format
        if (!token.startsWith('login_') || token.length < 20) {
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
            .select('access_token, refresh_token, used, expires_at, created_at')
            .eq('token', token)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Token not found - still waiting
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

        // Check both expires_at and max age (10 minutes)
        const maxAge = 10 * 60 * 1000; // 10 minutes
        const age = now.getTime() - createdAt.getTime();

        if (now > expiresAt || age > maxAge) {
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

        // If access_token exists, auth is complete
        if (tokenData.access_token) {
            // Mark token as used
            await supabase
                .from('pending_tokens')
                .update({ used: true })
                .eq('token', token);

            return NextResponse.json({
                status: 'complete',
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token
            });
        }

        // Still waiting for authentication
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
