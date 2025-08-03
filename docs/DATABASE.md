# Database Reference

## Schema & Relationships

### Authentication & Profiles

```
auth.users (Supabase built-in)
    ↓ (1:1)
profiles.id → auth.users.id (FK, PRIMARY KEY)
```

**Key Points:**
- `profiles.id` IS the same as `auth.users.id` 
- `profiles.id` is both PRIMARY KEY and FOREIGN KEY to auth.users
- When a user signs up, a profile record is created automatically via trigger

### All Foreign Key Relationships

1. **profiles.id** → auth.users.id
2. **posts.user_id** → auth.users.id  
3. **comments.user_id** → auth.users.id
4. **comments.post_id** → posts.id
5. **likes.user_id** → auth.users.id
6. **likes.post_id** → posts.id
7. **startups.user_id** → auth.users.id

## Database Functions (RPC)

### get_posts_with_details(user_id_param UUID)
- **Purpose**: Get ALL posts for home page feed
- **Parameters**: `user_id_param` (for liked_by_user status only)
- **Returns**: ALL posts from ALL users with likes/comments counts
- **Usage**: Home page

### get_user_posts_with_details(profile_user_id UUID, current_user_id UUID)
- **Purpose**: Get posts from specific user for profile pages
- **Parameters**: 
  - `profile_user_id`: The user whose posts to fetch
  - `current_user_id`: Current user (for liked_by_user status)
- **Returns**: Posts ONLY from the specified user
- **Usage**: Profile pages

## Automatic Triggers

### User Profile Creation
- **Trigger**: `on_auth_user_created` on `auth.users`
- **Function**: `public.handle_new_user()`
- **Purpose**: Automatically creates a profile when a new auth user is created
- **Behavior**: 
  - Creates profile with username based on email or 'user_' + auth_id
  - Extracts first_name from email or metadata
  - Sets last_name from metadata if available

### Other Automatic Updates
- `update_profiles_updated_at` - Updates `updated_at` on profile changes
- `update_startups_updated_at` - Updates `updated_at` on startup changes  
- `generate_startup_slug` - Auto-generates URL slug for startups
- `update_posts_updated_at` - Updates `updated_at` on post changes
- `update_comments_updated_at` - Updates `updated_at` on comment changes

## Row Level Security (RLS)

- All tables have RLS enabled
- **Write policies**: Require `auth.uid() = user_id` 
- **Read policies**: Generally open for public content
- Policies automatically work with real Supabase auth sessions

## Query Patterns

### Get user profile by auth user ID:
```sql
SELECT * FROM profiles WHERE id = 'auth-user-id'
```

### Get comments with user info:
```sql
SELECT 
  comments.*,
  profiles!comments_user_id_fkey (username, first_name, last_name, avatar_url)
FROM comments
```

### Get posts with user info:
```sql  
SELECT 
  posts.*,
  profiles!posts_user_id_fkey (username, first_name, last_name, avatar_url)
FROM posts
```

## Development Setup

1. Run all SQL scripts in `scripts/` folder in order
2. Creating auth users automatically creates profiles via trigger
3. Use environment variables for dev credentials
4. Real Supabase auth sessions provide proper `auth.uid()` for RLS policies
