-- Add foreign key relationship between comments.user_id and profiles.id
-- This will enable direct Supabase joins: profiles!user_id

-- First, ensure data integrity - check if any comments reference non-existent profiles
DO $$
BEGIN
    -- Check for orphaned comments (comments with user_id not in profiles)
    IF EXISTS (
        SELECT 1 FROM comments c 
        LEFT JOIN profiles p ON c.user_id = p.id 
        WHERE p.id IS NULL
    ) THEN
        RAISE NOTICE 'Found comments with missing profiles. Creating missing profile records...';
        
        -- Create missing profiles for orphaned comments
        INSERT INTO profiles (id, username, first_name, last_name)
        SELECT DISTINCT 
            c.user_id,
            'user_' || SUBSTRING(c.user_id::text, 1, 8), -- Generate username from UUID
            'Unknown',
            'User'
        FROM comments c 
        LEFT JOIN profiles p ON c.user_id = p.id 
        WHERE p.id IS NULL;
        
        RAISE NOTICE 'Created missing profile records.';
    END IF;
END $$;

-- Now add the foreign key constraint
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_profiles 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add index for better performance on joins
CREATE INDEX IF NOT EXISTS idx_comments_user_profile_fk ON comments(user_id);

-- Update documentation comment
COMMENT ON CONSTRAINT fk_comments_profiles ON comments IS 
'Foreign key to profiles table - enables direct Supabase joins with profiles!user_id syntax';
