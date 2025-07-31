# Database Schema Reference

## Critical Relationships

### Authentication & Profiles

```
auth.users (Supabase built-in)
    ↓ (1:1)
profiles.id → auth.users.id (FK, PRIMARY KEY)
```

**Key Points:**
- `profiles.id` IS the same as `auth.users.id` 
- `profiles.id` is both PRIMARY KEY and FOREIGN KEY to auth.users
- When a user signs up, a profile record is created with the same ID

### Comments Relationship - UPDATED!

```
comments.user_id → auth.users.id (FK)
comments.user_id → profiles.id (FK) [ADDED IN MIGRATION 21]
profiles.id → auth.users.id (FK)

Therefore: comments.user_id = profiles.id (same UUID + direct FK!)
```

**After Migration 21:**
- ✅ Direct FK constraint between comments.user_id and profiles.id
- ✅ Supabase can automatically join them
- ✅ Database enforces referential integrity
- ✅ Single-query joins are now possible

## Supabase Query Patterns

### ✅ CORRECT: Direct join works after migration
```sql
SELECT 
  comments.*,
  profiles!user_id (
    id, username, first_name, last_name, avatar_url
  )
FROM comments
```

### ✅ ALSO CORRECT: Two separate queries (still works, more flexible)
```sql
-- Query 1: Get comments
SELECT * FROM comments WHERE post_id IN (...)

-- Query 2: Get profiles for comment users  
SELECT * FROM profiles WHERE id IN (user_ids_from_comments)

-- Join in JavaScript using Map for O(1) lookup
```

## All Foreign Keys in Database

1. **profiles.id** → auth.users.id
2. **posts.user_id** → auth.users.id  
3. **comments.user_id** → auth.users.id
4. **comments.post_id** → posts.id
5. **likes.user_id** → auth.users.id
6. **likes.post_id** → posts.id
7. **startups.user_id** → auth.users.id

## Common Query Patterns

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

## Remember: 
- **profiles.id = auth.users.id** (same value, 1:1 relationship)
- All user_id fields in other tables reference **auth.users.id**
- To join with profiles, use the named foreign key: `profiles!table_column_fkey`
