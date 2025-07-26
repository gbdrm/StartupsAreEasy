-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view likes" ON likes;
DROP POLICY IF EXISTS "Authenticated users can like posts" ON likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON likes;
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

-- Create more permissive policies for now (we'll tighten them later with proper auth)

-- Users policies - allow anyone to create users (for Telegram auth)
CREATE POLICY "Anyone can view users" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can create users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);

-- Posts policies
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Anyone can create posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete posts" ON posts FOR DELETE USING (true);

-- Likes policies
CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Anyone can create likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete likes" ON likes FOR DELETE USING (true);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Anyone can create comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update comments" ON comments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete comments" ON comments FOR DELETE USING (true);
