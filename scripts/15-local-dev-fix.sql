-- ===================================
-- LOCAL DEVELOPMENT FIX
-- ===================================
-- Run this in your LOCAL Supabase SQL Editor

-- Create a more permissive RLS policy for local development
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT 
    WITH CHECK (
        -- For local development with fake login, be more permissive
        user_id IS NOT NULL
        AND (
            -- Normal case: auth.uid() matches user_id
            auth.uid() = user_id
            OR
            -- Local dev case: allow if user_id exists in profiles
            EXISTS (SELECT 1 FROM profiles WHERE id = user_id)
            OR
            -- Service role can always insert
            current_user = 'service_role'
        )
    );

-- Alternative: Even more permissive for local development
-- Uncomment these lines if the above doesn't work:

-- DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
-- CREATE POLICY "Users can insert their own posts" ON posts
--     FOR INSERT 
--     WITH CHECK (user_id IS NOT NULL);

-- Verify the policy
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'posts' 
AND policyname = 'Users can insert their own posts';
