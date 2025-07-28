-- ===================================================================
-- COMPLETE DATABASE RECREATION SCRIPT
-- ===================================================================
-- This script will drop all existing tables and recreate them from scratch
-- WARNING: This will delete ALL data in the database!

-- ===================================================================
-- 1. DROP ALL TABLES (in reverse dependency order)
-- ===================================================================

-- Drop views first
DROP VIEW IF EXISTS user_startup_summary CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS startups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop any remaining functions
DROP FUNCTION IF EXISTS get_posts_with_details(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_slug_from_name() CASCADE;

-- ===================================================================
-- 2. CREATE TABLES FROM SCRATCH
-- ===================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create slug generation function
CREATE OR REPLACE FUNCTION generate_slug_from_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.slug = LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug = REGEXP_REPLACE(NEW.slug, '^-+|-+$', '', 'g');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ===================================================================
-- PROFILES TABLE
-- ===================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    telegram_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles indexes
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_telegram_id ON profiles(telegram_id);

-- Profiles triggers
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- STARTUPS TABLE
-- ===================================================================
CREATE TABLE startups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    website_url TEXT,
    logo_url TEXT,
    industry TEXT,
    stage TEXT DEFAULT 'idea' CHECK (
        stage = ANY(ARRAY[
            'idea'::text,
            'planning'::text,
            'building'::text,
            'mvp'::text,
            'beta'::text,
            'launched'::text,
            'scaling'::text,
            'acquired'::text,
            'paused'::text
        ])
    ),
    founded_date DATE,
    location TEXT,
    team_size INTEGER,
    funding_raised BIGINT,
    target_market TEXT,
    estimated_timeline TEXT,
    looking_for TEXT[],
    launch_date DATE,
    launch_post_id UUID, -- Will reference posts(id) after posts table is created
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Startups indexes
CREATE INDEX idx_startups_user_id ON startups(user_id);
CREATE INDEX idx_startups_stage ON startups(stage);
CREATE INDEX idx_startups_user_stage ON startups(user_id, stage);
CREATE INDEX idx_startups_created_at ON startups(created_at DESC);
CREATE INDEX idx_startups_slug ON startups(slug);
CREATE INDEX idx_startups_is_public ON startups(is_public);

-- Startups triggers
CREATE TRIGGER update_startups_updated_at 
    BEFORE UPDATE ON startups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER generate_startup_slug 
    BEFORE INSERT OR UPDATE ON startups 
    FOR EACH ROW EXECUTE FUNCTION generate_slug_from_name();

-- ===================================================================
-- POSTS TABLE
-- ===================================================================
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'post' CHECK (
        type = ANY(ARRAY['post'::text, 'idea'::text, 'launch'::text, 'progress'::text])
    ),
    content TEXT NOT NULL,
    link TEXT,
    image TEXT,
    startup_id UUID REFERENCES startups(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_startup_id ON posts(startup_id);

-- Posts triggers
CREATE TRIGGER update_posts_updated_at 
    BEFORE UPDATE ON posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- LIKES TABLE
-- ===================================================================
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

-- Likes indexes
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- ===================================================================
-- COMMENTS TABLE
-- ===================================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Comments triggers
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- ADD FOREIGN KEY CONSTRAINTS THAT REFERENCE POSTS
-- ===================================================================
-- Now we can add the foreign key constraint for startups.launch_post_id
ALTER TABLE startups 
ADD CONSTRAINT startups_launch_post_id_fkey 
FOREIGN KEY (launch_post_id) REFERENCES posts(id) ON DELETE SET NULL;

-- ===================================================================
-- VIEWS
-- ===================================================================
-- User startup summary view
CREATE VIEW user_startup_summary AS
SELECT 
    s.user_id,
    COUNT(*) FILTER (WHERE s.stage = 'idea') as ideas_count,
    COUNT(*) FILTER (WHERE s.stage IN ('launched', 'scaling')) as launched_count,
    COUNT(*) FILTER (WHERE s.stage IN ('building', 'mvp', 'beta')) as building_count
FROM startups s
WHERE s.is_public = true
GROUP BY s.user_id;

-- ===================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Startups policies
CREATE POLICY "Public startups are viewable by everyone" ON startups
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert their own startups" ON startups
    FOR INSERT WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can update their own startups" ON startups
    FOR UPDATE USING (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "Users can delete their own startups" ON startups
    FOR DELETE USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Likes are viewable by everyone" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- ===================================================================
-- USEFUL FUNCTIONS
-- ===================================================================

-- Function to get posts with all related data
CREATE OR REPLACE FUNCTION get_posts_with_details(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    type TEXT,
    content TEXT,
    link_url TEXT,
    image_url TEXT,
    startup_id UUID,
    created_at TIMESTAMPTZ,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    avatar_url TEXT,
    likes_count BIGINT,
    comments_count BIGINT,
    liked_by_user BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.type,
        p.content,
        p.link as link_url,
        p.image as image_url,
        p.startup_id,
        p.created_at,
        pr.first_name,
        pr.last_name,
        pr.username,
        pr.avatar_url,
        COALESCE(l.likes_count, 0) as likes_count,
        COALESCE(c.comments_count, 0) as comments_count,
        CASE 
            WHEN user_id_param IS NOT NULL AND ul.user_id IS NOT NULL THEN true 
            ELSE false 
        END as liked_by_user
    FROM posts p
    LEFT JOIN profiles pr ON p.user_id = pr.id
    LEFT JOIN (
        SELECT post_id, COUNT(*) as likes_count 
        FROM likes 
        GROUP BY post_id
    ) l ON p.id = l.post_id
    LEFT JOIN (
        SELECT post_id, COUNT(*) as comments_count 
        FROM comments 
        GROUP BY post_id
    ) c ON p.id = c.post_id
    LEFT JOIN likes ul ON p.id = ul.post_id AND ul.user_id = user_id_param
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- GRANT PERMISSIONS
-- ===================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to anon users for reading public data
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON profiles, startups, posts, likes, comments TO anon;
GRANT EXECUTE ON FUNCTION get_posts_with_details(UUID) TO anon;

-- ===================================================================
-- SAMPLE DATA (Optional - for testing)
-- ===================================================================

-- Create a development user manually after running this script:
-- 1. Go to your Supabase Dashboard -> Authentication -> Users
-- 2. Create a new user or note an existing user's ID
-- 3. Insert a profile for that user:
--
-- INSERT INTO profiles (id, username, first_name, last_name, avatar_url) 
-- VALUES (
--     'YOUR-USER-ID-HERE'::UUID, 
--     'devuser', 
--     'Dev', 
--     'User', 
--     'https://via.placeholder.com/150'
-- ) ON CONFLICT (id) DO NOTHING;
