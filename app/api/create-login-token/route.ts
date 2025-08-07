// API route for creating login tokens in the database
// This ensures tokens exist before Telegram bot tries to verify them

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

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

        // Create token in database with extended expiration
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        const { data, error } = await supabase
            .from('pending_tokens')
            .insert({
                token,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString(),
                used: false
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create token:', error);

            // Check if token already exists
            if (error.code === '23505') { // Unique constraint violation
                return NextResponse.json(
                    { message: 'Token already exists', status: 'exists' },
                    { status: 200 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to create token' },
                { status: 500 }
            );
        }

        console.log(`Token created successfully: ${token}, expires: ${expiresAt.toISOString()}`);

        return NextResponse.json({
            status: 'created',
            token: data.token,
            expires_at: data.expires_at
        });

    } catch (error) {
        console.error('Token creation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
