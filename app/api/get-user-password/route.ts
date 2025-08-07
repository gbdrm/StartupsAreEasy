// API route to get user's secure password from metadata
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const { user_id } = await request.json();

        if (!user_id) {
            return NextResponse.json(
                { error: 'user_id parameter required' },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get user metadata containing the secure password
        const { data: { user }, error } = await supabase.auth.admin.getUserById(user_id);

        if (error) {
            console.error('Failed to get user metadata:', error);
            return NextResponse.json(
                { error: 'Failed to fetch user data' },
                { status: 500 }
            );
        }

        const securePassword = user?.user_metadata?.secure_password;

        return NextResponse.json({
            secure_password: securePassword || null,
            found: !!securePassword
        });

    } catch (error) {
        console.error('Get user password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}