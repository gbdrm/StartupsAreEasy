-- Comprehensive database diagnostic for auth user creation issues
-- Run this in Supabase SQL Editor to identify the problem

-- 1. Check if auth schema and users table exist
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- 2. Check auth.users table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check for any triggers on auth.users table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
AND event_object_table = 'users';

-- 4. Check for foreign key constraints pointing TO auth.users
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (ccu.table_name = 'users' AND ccu.table_schema = 'auth')
ORDER BY tc.table_schema, tc.table_name;

-- 5. Check RLS policies on auth.users (if any)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users';

-- 6. Check if profiles table has proper structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Check current profiles table content
SELECT id, username, first_name, created_at
FROM public.profiles
LIMIT 5;

-- 8. Test if we can query auth.users directly (should work with service role)
SELECT count(*) as user_count FROM auth.users;

-- 9. Check for any check constraints on profiles
SELECT
    tc.constraint_name, 
    tc.table_name, 
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
AND tc.table_name = 'profiles'
AND tc.constraint_type = 'CHECK';

-- 10. Check for any unique constraints that might conflict
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name;
