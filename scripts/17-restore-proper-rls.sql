-- ===================================
-- REVERT TO PROPER RLS POLICIES
-- ===================================
-- This reverts the RLS policies back to their original, secure state

-- Restore proper posts policy
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restore proper startups policy  
DROP POLICY IF EXISTS "Users can insert their own startups" ON startups;
CREATE POLICY "Users can insert their own startups" ON startups
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restore proper likes policy
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
CREATE POLICY "Users can insert their own likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restore proper comments policy
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verify the policies are back to normal
SELECT 
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename IN ('posts', 'startups', 'likes', 'comments')
AND cmd = 'INSERT'
ORDER BY tablename, policyname;
