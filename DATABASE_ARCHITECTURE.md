# Database Architecture Reference

## Automatic Triggers

### User Profile Creation
- **Trigger**: `on_auth_user_created` on `auth.users`
- **Function**: `public.handle_new_user()`
- **Purpose**: Automatically creates a profile when a new auth user is created
- **Location**: Defined in `scripts/09-fix-trigger-function.sql`
- **Behavior**: 
  - Creates profile with username based on email or 'user_' + auth_id
  - Extracts first_name from email or metadata
  - Sets last_name from metadata if available
  - Handles conflicts gracefully with logging

### Other Triggers
- `update_profiles_updated_at` - Updates `updated_at` on profile changes
- `update_startups_updated_at` - Updates `updated_at` on startup changes  
- `generate_startup_slug` - Auto-generates URL slug for startups
- `update_posts_updated_at` - Updates `updated_at` on post changes
- `update_comments_updated_at` - Updates `updated_at` on comment changes

## RLS Policies
- All tables have Row Level Security enabled
- Policies require `auth.uid() = user_id` for write operations
- Read access is generally open (`true`)
- Located in various scripts, restored in `scripts/18-restore-proper-rls-policies.sql`

## Development Notes
- Creating auth users automatically creates profiles via trigger
- No manual profile creation needed for new users
- Use environment variables for dev credentials (never hardcode in SQL comments)
- Real Supabase auth sessions provide proper `auth.uid()` for RLS policies
