-- Function to get posts with user info, like counts, and user's like status
CREATE OR REPLACE FUNCTION get_posts_with_details(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  type TEXT,
  content TEXT,
  link_url TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  likes_count BIGINT,
  comments_count BIGINT,
  liked_by_user BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.avatar_url,
    p.type,
    p.content,
    p.link_url,
    p.image_url,
    p.created_at,
    COALESCE(like_counts.count, 0) as likes_count,
    COALESCE(comment_counts.count, 0) as comments_count,
    CASE 
      WHEN user_id_param IS NOT NULL AND user_likes.user_id IS NOT NULL THEN true
      ELSE false
    END as liked_by_user
  FROM posts p
  JOIN users u ON p.user_id = u.id
  LEFT JOIN (
    SELECT post_id, COUNT(*) as count
    FROM likes
    GROUP BY post_id
  ) like_counts ON p.id = like_counts.post_id
  LEFT JOIN (
    SELECT post_id, COUNT(*) as count
    FROM comments
    GROUP BY post_id
  ) comment_counts ON p.id = comment_counts.post_id
  LEFT JOIN likes user_likes ON p.id = user_likes.post_id AND user_likes.user_id = user_id_param
  ORDER BY p.created_at DESC;
END;
$$;
