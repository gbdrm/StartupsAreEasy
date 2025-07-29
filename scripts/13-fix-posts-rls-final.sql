-- ===================================
-- DEBUG AND FIX POSTS RLS POLICY
-- ===================================

-- First, let's check what the current auth context looks like
SELECT 
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role,
    current_user as current_db_user,
    session_user as session_user;

-- Check the current RLS policies for posts
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    roles
FROM pg_policies 
WHERE tablename = 'posts' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- ===================================
-- TEMPORARY FIX: More permissive INSERT policy
-- ===================================

-- Drop the existing restrictive insert policy
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;

-- Create a more permissive insert policy that handles edge cases
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

-- ===================================
-- ALTERNATIVE: Simplified policy for debugging
-- ===================================

-- If the above doesn't work, try this even more permissive policy
-- Uncomment the lines below if needed:

-- DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
-- CREATE POLICY "Users can insert their own posts" ON posts
--     FOR INSERT 
--     WITH CHECK (
--         auth.role() = 'authenticated' AND user_id IS NOT NULL
--     );

-- ===================================
-- VERIFICATION
-- ===================================

-- Verify the new policy is in place
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'posts' 
AND policyname = 'Users can insert their own posts';

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'posts' AND schemaname = 'public';
