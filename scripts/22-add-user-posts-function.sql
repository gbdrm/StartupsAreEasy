-- Create a new RPC function to get posts for a specific user (for profile pages)
-- This is different from get_posts_with_details which gets ALL posts

CREATE OR REPLACE FUNCTION get_user_posts_with_details(
    profile_user_id UUID,
    current_user_id UUID DEFAULT NULL
)
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
            WHEN current_user_id IS NOT NULL AND ul.user_id IS NOT NULL THEN true 
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
    LEFT JOIN likes ul ON p.id = ul.post_id AND ul.user_id = current_user_id
    WHERE p.user_id = profile_user_id  -- KEY DIFFERENCE: Filter by specific user
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_posts_with_details(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_posts_with_details(UUID, UUID) TO anon;
