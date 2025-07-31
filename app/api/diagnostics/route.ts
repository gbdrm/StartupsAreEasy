import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client - use service role if available, otherwise anon key
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DiagnosticResult {
    name: string
    status: 'success' | 'warning' | 'error'
    message: string
    details?: any
    count?: number
}

export async function GET(request: NextRequest) {
    try {
        const results: DiagnosticResult[] = []

        // Test 1: Check database connection
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('count', { count: 'exact', head: true })

            if (error) throw error

            results.push({
                name: 'Database Connection',
                status: 'success',
                message: 'Successfully connected to database',
                count: data?.length || 0
            })
        } catch (err: any) {
            results.push({
                name: 'Database Connection',
                status: 'error',
                message: `Database connection failed: ${err.message}`,
                details: err
            })
        }

        // Test 2: Check all tables exist
        const tables = ['profiles', 'startups', 'posts', 'likes', 'comments']

        for (const table of tables) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })

                if (error) throw error

                results.push({
                    name: `${table.charAt(0).toUpperCase() + table.slice(1)} Table`,
                    status: 'success',
                    message: `Table exists and is accessible`,
                    count: count || 0
                })
            } catch (err: any) {
                results.push({
                    name: `${table.charAt(0).toUpperCase() + table.slice(1)} Table`,
                    status: 'error',
                    message: `Table error: ${err.message}`,
                    details: err
                })
            }
        }

        // Test 3: Check foreign key relationships
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
          id,
          startup:startups!posts_startup_id_fkey(id, name)
        `)
                .limit(1)

            if (error) throw error

            results.push({
                name: 'Foreign Key Relationships',
                status: 'success',
                message: 'Foreign key relationships are working',
                details: data
            })
        } catch (err: any) {
            results.push({
                name: 'Foreign Key Relationships',
                status: 'error',
                message: `Foreign key error: ${err.message}`,
                details: err
            })
        }

        // Test 4: Check auth.users table (with service role)
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const { data, error } = await supabase.auth.admin.listUsers()

                if (error) throw error

                results.push({
                    name: 'Auth Users Table',
                    status: 'success',
                    message: 'Auth users table is accessible',
                    count: data.users.length
                })
            } catch (err: any) {
                results.push({
                    name: 'Auth Users Table',
                    status: 'error',
                    message: `Auth users error: ${err.message}`,
                    details: err
                })
            }
        } else {
            results.push({
                name: 'Auth Users Table',
                status: 'warning',
                message: 'Service role key not available - cannot check auth.users',
                details: { note: 'Add SUPABASE_SERVICE_ROLE_KEY to environment variables for full auth diagnostics' }
            })
        }

        // Test 5: Check RLS policies
        try {
            // Test anonymous access to profiles (should work)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('username')
                .limit(1)

            // Don't test insert as it will cause constraint violations
            // RLS policies would block it anyway for anonymous users

            results.push({
                name: 'RLS Policies',
                status: !profileError ? 'success' : 'warning',
                message: !profileError
                    ? 'RLS policies allow public read access (insert test skipped to avoid constraint violations)'
                    : 'RLS policies may be too restrictive for read access',
                details: {
                    readWorking: !profileError,
                    profileError: profileError?.message,
                    note: 'Insert test skipped to avoid null id constraint violations'
                }
            })
        } catch (err: any) {
            results.push({
                name: 'RLS Policies',
                status: 'error',
                message: `RLS policy check failed: ${err.message}`,
                details: err
            })
        }        // Test 6: Check environment variables
        const requiredEnvVars = [
            'NEXT_PUBLIC_SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        ]

        const optionalEnvVars = [
            'SUPABASE_SERVICE_ROLE_KEY',
            'NEXT_PUBLIC_TELEGRAM_BOT_TOKEN'
        ]

        const envStatus = {
            required: requiredEnvVars.map(key => ({ key, exists: !!process.env[key] })),
            optional: optionalEnvVars.map(key => ({ key, exists: !!process.env[key] }))
        }

        const missingRequired = envStatus.required.filter(env => !env.exists)

        results.push({
            name: 'Environment Variables',
            status: missingRequired.length === 0 ? 'success' : 'error',
            message: missingRequired.length === 0
                ? 'All required environment variables are set'
                : `Missing required variables: ${missingRequired.map(env => env.key).join(', ')}`,
            details: envStatus
        })

        // Test 7: Check database functions
        try {
            const { data, error } = await supabase.rpc('get_posts_with_details')

            results.push({
                name: 'Database Functions',
                status: 'success',
                message: 'Database functions are working',
                details: { functionResult: data?.length || 0 }
            })
        } catch (err: any) {
            results.push({
                name: 'Database Functions',
                status: 'error',
                message: `Database function error: ${err.message}`,
                details: err
            })
        }

        const summary = {
            total: results.length,
            success: results.filter(r => r.status === 'success').length,
            warning: results.filter(r => r.status === 'warning').length,
            error: results.filter(r => r.status === 'error').length
        }

        return NextResponse.json({
            success: true,
            summary,
            results,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}
