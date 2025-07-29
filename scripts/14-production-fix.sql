-- ===================================
-- PRODUCTION DATABASE FIX
-- ===================================
-- Run this in your PRODUCTION Supabase SQL Editor

-- 1. Fix the RLS policy for posts (allows authenticated users to create posts)
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT 
    WITH CHECK (
        -- Allow if auth.uid() matches user_id
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR 
        -- Allow service role to insert (for server-side operations)
        (current_user = 'service_role')
        OR
        -- Allow if the user is authenticated and user_id is not null
        (auth.role() = 'authenticated' AND user_id IS NOT NULL)
    );

-- 2. Verify the policy was created
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'posts' 
AND policyname = 'Users can insert their own posts';

-- ===================================
-- VERIFICATION
-- ===================================

-- Check all foreign key relationships between posts and startups
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (
    (tc.table_name = 'posts' AND ccu.table_name = 'startups')
    OR
    (tc.table_name = 'startups' AND ccu.table_name = 'posts')
)
ORDER BY tc.table_name, tc.constraint_name;
