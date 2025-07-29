-- ===================================
-- ADD FOREIGN KEY BETWEEN POSTS AND PROFILES
-- ===================================
-- This will create a direct foreign key relationship so Supabase can join them automatically

-- Add a foreign key constraint from posts.user_id to profiles.id
-- Since both reference auth.users(id), this should be safe
ALTER TABLE posts 
ADD CONSTRAINT posts_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify the foreign key was created
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
AND tc.table_name = 'posts'
AND tc.constraint_name = 'posts_user_id_profiles_fkey';
