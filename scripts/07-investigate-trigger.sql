-- ===================================
-- INVESTIGATE AUTH.USERS TRIGGER
-- ===================================
-- Run this script in your Supabase SQL Editor to investigate the trigger
-- that's causing the "Database error creating new user" issue

-- 1. Check if the trigger exists and what it does
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check the handle_new_user function definition
SELECT 
    routine_name,
    routine_definition,
    routine_body,
    data_type,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Alternative way to get the function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 4. Check all triggers on auth.users table
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = regexp_replace(t.action_statement, '.*EXECUTE (?:PROCEDURE|FUNCTION) ([^(]+).*', '\1')
WHERE t.event_object_table = 'users' 
AND t.event_object_schema = 'auth';

-- 5. Check what tables the handle_new_user function might be trying to access
-- This will help us understand what's causing the conflict
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename IN ('profiles', 'users')
ORDER BY schemaname, tablename;

-- 6. Check foreign key constraints on profiles table
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'profiles';

-- 7. Check if there are any policies that might be blocking the trigger
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY tablename, policyname;

-- 8. Test if we can see the current user context during auth operations
-- This might help understand why the trigger is failing
SELECT current_user, current_role, session_user;
