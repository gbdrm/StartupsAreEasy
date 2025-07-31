-- ===================================
-- FIX STARTUPS RLS POLICY
-- ===================================
-- This fixes the RLS policy for startups table that's blocking idea creation

-- Check current startups policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check,
    roles
FROM pg_policies 
WHERE tablename = 'startups' AND schemaname = 'public'
ORDER BY cmd, policyname;

-- Fix the INSERT policy for startups
DROP POLICY IF EXISTS "Users can insert their own startups" ON startups;

CREATE POLICY "Users can insert their own startups" ON startups
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

-- Check if there are other startup policies that might need fixing
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'startups' 
ORDER BY cmd, policyname;

-- ===================================
-- OPTIONAL: Also check other tables that might have similar issues
-- ===================================

-- Check likes table policies
SELECT 
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename IN ('likes', 'comments')
ORDER BY tablename, cmd, policyname;

-- If likes or comments also have issues, you can fix them with similar policies:

-- Fix likes policies if needed:
-- DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
-- CREATE POLICY "Users can insert their own likes" ON likes
--     FOR INSERT 
--     WITH CHECK (
--         (auth.uid() IS NOT NULL AND auth.uid() = user_id)
--         OR (current_user = 'service_role')
--         OR (auth.role() = 'authenticated' AND user_id IS NOT NULL)
--     );

-- Fix comments policies if needed:
-- DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
-- CREATE POLICY "Users can insert their own comments" ON comments
--     FOR INSERT 
--     WITH CHECK (
--         (auth.uid() IS NOT NULL AND auth.uid() = user_id)
--         OR (current_user = 'service_role')
--         OR (auth.role() = 'authenticated' AND user_id IS NOT NULL)
--     );
