-- Restore proper RLS policies by removing security exceptions
-- This removes the permissive policies that allowed unauth access

-- Drop permissive policies that bypass authentication
DROP POLICY IF EXISTS "Allow unauth to view posts" ON posts;
DROP POLICY IF EXISTS "Allow unauth to view startups" ON startups;
DROP POLICY IF EXISTS "Allow unauth to view profiles" ON profiles;
DROP POLICY IF EXISTS "Allow unauth to view comments" ON comments;
DROP POLICY IF EXISTS "Allow unauth to view likes" ON likes;

-- Drop insert policies that bypass authentication  
DROP POLICY IF EXISTS "Allow unauth to create posts" ON posts;
DROP POLICY IF EXISTS "Allow unauth to create startups" ON startups;
DROP POLICY IF EXISTS "Allow unauth to create comments" ON comments;
DROP POLICY IF EXISTS "Allow unauth to create likes" ON likes;

-- Create proper secure RLS policies

-- Profiles: Users can read all profiles but only update their own
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Startups: Users can read all startups but only create/update their own
CREATE POLICY "Anyone can view startups" ON startups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create startups" ON startups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own startups" ON startups FOR UPDATE USING (auth.uid() = user_id);

-- Posts: Users can read all posts but only create/update their own
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);

-- Comments: Users can read all comments but only create/update their own
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);

-- Likes: Users can read all likes but only create/delete their own
CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON likes FOR DELETE USING (auth.uid() = user_id);
