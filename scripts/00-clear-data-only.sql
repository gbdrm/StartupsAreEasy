-- ===================================================================
-- CLEAR ALL DATA (Keep table structure)
-- ===================================================================
-- This script will delete all data but keep table structures intact
-- Use this if you want to keep existing table structure and just clear data

-- Disable RLS temporarily for cleanup
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE startups DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Delete data in reverse dependency order
DELETE FROM comments;
DELETE FROM likes;
DELETE FROM posts;
DELETE FROM startups;
DELETE FROM profiles;

-- Reset sequences
ALTER SEQUENCE IF EXISTS comments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS likes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS posts_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS startups_id_seq RESTART WITH 1;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Optional: Insert sample dev user (modify UUID as needed)
-- 1. Get your user ID from Supabase Dashboard -> Authentication -> Users
-- 2. Uncomment and modify the UUID below:
--
-- INSERT INTO profiles (id, username, first_name, last_name, avatar_url) 
-- VALUES (
--     'YOUR-USER-ID-HERE'::UUID, 
--     'devuser', 
--     'Dev', 
--     'User', 
--     'https://via.placeholder.com/150'
-- ) ON CONFLICT (id) DO NOTHING;
